/*
	perfDiag.js
	-----------

	Dev-only, opt-in performance/leak instrumentation for widgets.

	The point of this module is to turn "the widget feels like it slows to a
	crawl over a long stream" into DATA. It samples the three things that can
	grow unbounded in a long-lived widget page and logs them on an interval so a
	real live-chat test (e.g. watching a fast third-party stream in OBS or a
	Chrome tab for an hour) shows exactly which one is climbing:

	  - JS heap (performance.memory.usedJSHeapSize) -> memory leak / GC pressure
	  - live WebSocket count                        -> socket accumulation
	  - DOM node count                              -> detached-node / render leak

	It is OFF by default and has ZERO effect unless explicitly enabled, so it is
	safe to ship. Enable it per-page (no rebuild needed) by either:
	  - adding ?diag=1 (or just ?diag) to the widget URL, or
	  - running  localStorage.setItem('ct_perfDiag','1')  then reloading.

	Because it must count sockets created by socket-ref, importing this module
	installs a tiny counting wrapper around window.WebSocket AT IMPORT TIME (only
	when enabled). Import it as early as possible in a widget - ideally the first
	import - so the wrapper is in place before any socket is opened.
*/


/**
 * Decide whether diagnostics are enabled for this page. Checks the URL query
 * (?diag / ?diag=1) first, then a localStorage flag. Fully guarded so it can
 * never throw in an odd embedding (OBS CEF, sandbox, etc.).
 *
 * @returns {Boolean}
 */
function diagEnabled() {
	try {
		const q = new URLSearchParams(window.location.search || '');
		if (q.has('diag')) {
			const v = q.get('diag');
			return v === '' || v === '1' || v === 'true';
		}
	} catch (_) { /* ignore */ }
	try {
		if (window.localStorage && window.localStorage.getItem('ct_perfDiag') === '1')
			return true;
	} catch (_) { /* ignore */ }
	return false;
}


// Resolve once at module load.
const ENABLED = diagEnabled();

// Live WebSocket count, maintained by the wrapper below.
let liveSockets = 0;
// Cumulative sockets ever opened (so we can see churn vs. steady-state).
let totalSocketsOpened = 0;


/**
 * Wrap window.WebSocket with a subclass that keeps a live-instance count.
 * Installed only when diagnostics are enabled, and only once.
 */
function installSocketCounter() {

	if (!ENABLED)
		return;
	if (typeof window === 'undefined' || !window.WebSocket || window.WebSocket.__ctDiagWrapped)
		return;

	const Native = window.WebSocket;

	class CountingWebSocket extends Native {
		constructor(...args) {
			super(...args);
			liveSockets++;
			totalSocketsOpened++;
			const dec = () => {
				liveSockets = Math.max(0, liveSockets - 1);
			};
			// a socket leaves the live set once it closes (cleanly or on error)
			this.addEventListener('close', dec, { once: true });
		}
	}

	// preserve constants (CONNECTING/OPEN/CLOSING/CLOSED) and identity marker
	CountingWebSocket.__ctDiagWrapped = true;
	try {
		window.WebSocket = CountingWebSocket;
	} catch (_) { /* some environments freeze it - ignore */ }
}

installSocketCounter();


/**
 * Take one sample of the live metrics.
 *
 * @returns {{ t:Number, heapMB:(Number|null), dom:Number, sockets:Number, totalSockets:Number }}
 */
function sample() {

	let heapMB = null;
	try {
		// performance.memory is Chromium-only and non-standard; guard it.
		const mem = window.performance && window.performance.memory;
		if (mem && typeof mem.usedJSHeapSize === 'number')
			heapMB = Math.round(mem.usedJSHeapSize / (1024 * 1024));
	} catch (_) { /* ignore */ }

	let dom = 0;
	try {
		dom = document.getElementsByTagName('*').length;
	} catch (_) { /* ignore */ }

	return {
		t: Date.now(),
		heapMB,
		dom,
		sockets: liveSockets,
		totalSockets: totalSocketsOpened
	};
}


/**
 * Start sampling on an interval and logging one line per sample. Idempotent -
 * a second call is ignored. No-op unless diagnostics are enabled.
 *
 * @param {Object} [opts]
 * @param {String} [opts.label] - short tag to identify this page in the logs
 * @param {Number} [opts.intervalMs] - sample period (default 5000)
 * @returns {Function} a stop() function (no-op when disabled)
 */
export function startPerfDiag({ label = 'widget', intervalMs = 5000 } = {}) {

	if (!ENABLED)
		return () => {};

	// guard against double-start on the same page
	if (window.__ctPerfDiag && window.__ctPerfDiag._running)
		return window.__ctPerfDiag.stop;

	const first = sample();
	const state = {
		_running: true,
		label,
		startedAt: first.t,
		first,
		last: first,
		samples: [first],
		stop: null
	};

	console.log(
		`%c[perfDiag:${label}] started`,
		'color:#5cf',
		`heap=${first.heapMB == null ? 'n/a' : first.heapMB + 'MB'} dom=${first.dom} sockets=${first.sockets}`
	);

	const id = setInterval(() => {

		const s = sample();
		state.last = s;
		state.samples.push(s);
		// keep the buffer bounded (this module must not become a leak itself)
		if (state.samples.length > 720)
			state.samples.shift();

		const dtMin = ((s.t - state.startedAt) / 60000);
		const dHeap = (s.heapMB == null || first.heapMB == null) ? null : (s.heapMB - first.heapMB);
		const dDom = s.dom - first.dom;

		console.log(
			`[perfDiag:${label}] +${dtMin.toFixed(1)}m  ` +
			`heap=${s.heapMB == null ? 'n/a' : s.heapMB + 'MB'}${dHeap == null ? '' : ` (Δ${dHeap >= 0 ? '+' : ''}${dHeap})`}  ` +
			`dom=${s.dom} (Δ${dDom >= 0 ? '+' : ''}${dDom})  ` +
			`sockets=${s.sockets}  totalOpened=${s.totalSockets}`
		);

	}, Math.max(1000, intervalMs));

	state.stop = () => {
		if (!state._running)
			return;
		state._running = false;
		clearInterval(id);
		console.log(`%c[perfDiag:${label}] stopped`, 'color:#5cf');
	};

	window.__ctPerfDiag = state;
	return state.stop;
}


/**
 * Whether diagnostics are active on this page (handy for conditionals).
 * @returns {Boolean}
 */
export function perfDiagEnabled() {
	return ENABLED;
}
