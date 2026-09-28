/*
	diagnostics.js
	--------------

	Opt-in main-process diagnostics for hunting freezes and socket overload.

	Enable by launching with --diag (e.g. from PowerShell:
	`& "...\Chat-Toys.exe" --diag`) or with the env var CT_DIAG=1.

	When enabled, one line per second goes to <userData>/logs/diag.log:

	  loop lag (how late the main event loop is running), socket connections,
	  subscriptions, messages/bytes per second, the slowest broadcast, clients
	  that are backed up, and the heaviest keys.

	Plus, the part that makes this useful for a FREEZE: a watchdog thread.
	A frozen main thread can't write anything, so a worker thread watches for
	the main thread's heartbeat and, if it stops, writes "MAIN THREAD STALLED"
	lines (with the last stats the main thread reported) every second until it
	recovers or the process dies. The tail of diag.log is then a record of
	what the app was doing when it locked up.

	All writes are synchronous appends so they survive a crash, and every
	write is wrapped so diagnostics can never take the app down themselves.

	The lightweight loop-lag probe also runs in dev (NODE_ENV=development)
	without logging, so the Debug page can show it; socketStatsSnapshot()
	feeds that page over IPC.
*/

// node / electron
import { app, ipcMain } from 'electron';
import { join } from 'path';
const fs = require('fs');
const { Worker } = require('worker_threads');


/** Probe interval for event-loop lag. */
const PROBE_MS = 100;

/** A single probe this late gets its own log line immediately. */
const STALL_LINE_MS = 250;

/** Watchdog declares a stall after this long without a heartbeat. */
const WATCHDOG_STALL_MS = 1000;


let enabled = false;
let logPath = null;
let socketServer = null;
let probeTimer = null;
let summaryTimer = null;
let watchdog = null;

// loop-lag bookkeeping
let lastProbe = 0;
let lagMaxWindow = 0;     // max lag since the last --diag summary line
let lagMaxRoll = 0;       // max lag in the current second (Debug page)
let lagMaxLastSec = 0;    // previous second's max, published to the Debug page
let stallsTotal = 0;


/**
 * @returns {Boolean} true when --diag / CT_DIAG=1 was given
 */
export function isDiagEnabled() {
	return process.argv.includes('--diag') || process.env.CT_DIAG === '1';
}


function writeLine(line) {
	if (!logPath)
		return;
	try {
		fs.appendFileSync(logPath, `${new Date().toISOString()} ${line}\n`);
	} catch (_) { /* never let logging crash the app */ }
}


/** Main-thread event-loop lag probe. */
function startProbe() {
	if (probeTimer)
		return;
	lastProbe = Date.now();
	probeTimer = setInterval(() => {
		const now = Date.now();
		const lag = Math.max(0, now - lastProbe - PROBE_MS);
		lastProbe = now;
		if (lag > lagMaxWindow)
			lagMaxWindow = lag;
		if (lag > lagMaxRoll)
			lagMaxRoll = lag;
		if (lag >= STALL_LINE_MS) {
			stallsTotal++;
			if (enabled)
				writeLine(`LOOP STALL main thread was blocked ~${lag}ms`);
		}
		// heartbeat for the watchdog thread
		if (watchdog) {
			try { watchdog.postMessage({ t: now }); } catch (_) { /* ignore */ }
		}
	}, PROBE_MS);
	if (typeof probeTimer.unref === 'function') probeTimer.unref();

	// per-second max for the Debug page (independent of the log summary)
	const roll = setInterval(() => {
		lagMaxLastSec = lagMaxRoll;
		lagMaxRoll = 0;
	}, 1000);
	if (typeof roll.unref === 'function') roll.unref();
}


/** One compact line per second while --diag is on. */
function summaryLine() {

	const lag = lagMaxWindow;
	lagMaxWindow = 0;

	let line = `loop maxLag=${lag}ms`;

	if (socketServer) {
		const s = socketServer.stats();
		const r = s.rates;
		const top = r.topKeys.slice(0, 4)
			.map(k => `${k.key}(${Math.round(k.bytesOutPerSec / 1024)}KB/s x${k.subscribers})`)
			.join(' ');
		line += ` | ws clients=${s.clients} subs=${s.subscriptions} in=${r.msgsInPerSec}/s out=${r.msgsOutPerSec}/s`
			+ ` outKB=${Math.round(r.bytesOutPerSec / 1024)}/s bcastMax=${r.broadcastMsMax}ms`
			+ ` backedUp=${s.backedUpClients} maxBuf=${Math.round(s.maxBufferedBytes / 1024)}KB`
			+ (top ? ` | top ${top}` : '');
	}

	writeLine(line);

	// give the watchdog the latest picture, so a stall line can say what
	// the app looked like just before it locked up
	if (watchdog) {
		try { watchdog.postMessage({ brief: line }); } catch (_) { /* ignore */ }
	}
}


/**
 * Worker thread that logs when the main thread stops heart-beating. It is
 * inline (eval) so there's no extra file for the build to ship.
 */
function startWatchdog() {

	const code = `
		const { parentPort, workerData } = require('worker_threads');
		const fs = require('fs');
		const write = (l) => { try { fs.appendFileSync(workerData.logPath, new Date().toISOString() + ' ' + l + '\\n'); } catch (_) {} };
		let last = Date.now();
		let lastBrief = '(no stats yet)';
		let stalledSince = 0;
		parentPort.on('message', (m) => {
			if (m.brief) { lastBrief = m.brief; return; }
			if (stalledSince) {
				write('WATCHDOG main thread RECOVERED after ~' + (Date.now() - stalledSince) + 'ms');
				stalledSince = 0;
			}
			last = Date.now();
		});
		setInterval(() => {
			const gap = Date.now() - last;
			if (gap < ${WATCHDOG_STALL_MS}) return;
			if (!stalledSince) {
				stalledSince = last;
				write('WATCHDOG MAIN THREAD STALLED (no heartbeat for ' + gap + 'ms). Last stats: ' + lastBrief);
			} else {
				write('WATCHDOG still stalled: ' + gap + 'ms');
			}
		}, 1000);
	`;

	try {
		watchdog = new Worker(code, { eval: true, workerData: { logPath } });
		watchdog.unref();
		watchdog.on('error', (e) => writeLine(`watchdog error ${e && e.message}`));
	} catch (e) {
		writeLine(`watchdog failed to start: ${e && e.message}`);
		watchdog = null;
	}
}


/**
 * Start diagnostics. Safe to call once at startup; does nothing heavy unless
 * --diag / CT_DIAG=1 is set.
 *
 * @param {Object} opts
 * @param {import('./sockets/SocketServer.js').SocketServer} opts.socketServer
 */
export function startDiagnostics({ socketServer: server } = {}) {

	socketServer = server || null;
	enabled = isDiagEnabled();

	// Debug page: live socket stats on demand
	ipcMain.handle('socket-stats', () => socketStatsSnapshot());

	if (enabled || process.env.NODE_ENV === 'development')
		startProbe();

	if (!enabled)
		return;

	try {
		const dir = join(app.getPath('userData'), 'logs');
		fs.mkdirSync(dir, { recursive: true });
		logPath = join(dir, 'diag.log');
	} catch (e) {
		console.error('[diag] could not create log dir', e);
		return;
	}

	writeLine(`==== --diag session start: ChatToys ${app.getVersion()} electron ${process.versions.electron} pid ${process.pid} ====`);
	console.log(`[diag] writing diagnostics to ${logPath}`);

	startWatchdog();

	summaryTimer = setInterval(summaryLine, 1000);
	if (typeof summaryTimer.unref === 'function') summaryTimer.unref();

	process.on('uncaughtException', (err) => writeLine(`uncaughtException ${err && (err.stack || err)}`));
	process.on('unhandledRejection', (err) => writeLine(`unhandledRejection ${err && (err.stack || err)}`));
	app.on('render-process-gone', (e, wc, d) => writeLine(`render-process-gone reason=${d && d.reason} exitCode=${d && d.exitCode}`));
	app.on('child-process-gone', (e, d) => writeLine(`child-process-gone type=${d && d.type} reason=${d && d.reason}`));
	app.on('before-quit', () => writeLine('==== app quitting ===='));
}


/**
 * Everything the Debug page shows about the socket layer.
 *
 * @returns {Object}
 */
export function socketStatsSnapshot() {
	const s = socketServer ? socketServer.stats({ clients: true }) : null;
	return {
		t: Date.now(),
		diag: enabled,
		logPath,
		loop: { lagMaxLastSecMs: lagMaxLastSec, probing: !!probeTimer, stallsTotal },
		server: s,
	};
}
