/*
	ct-api.js
	---------

	Client-side SDK injected into every plugin widget iframe. Wraps the
	postMessage <-> host bridge in a friendly `window.CT` object.

	The iframe is opaque-origin sandboxed (sandbox="allow-scripts", NO
	allow-same-origin), so this is the ONLY way plugin code reaches the app.
	Every method here merely SENDS a request and awaits a reply - it holds no
	real capability. The trusted host (PluginWidgetHost -> PluginToy) gates
	each request against the plugin's granted permissions and does the work.

	Hosted by the app at /plugins/_sdk/ct-api.js and auto-injected into widget
	entry HTML by the Express serving route. Authors never ship a copy.

	NOTE: deliberately a zero-dependency IIFE. The message `kind`/`evt` strings
	are inlined copies of src/renderer/plugins/protocol.js - keep them in sync.
	We do NOT import the module so this file can be served raw to any iframe.
*/

(() => {

	'use strict';

	// --- inlined protocol constants (mirror protocol.js) ----------------
	const PORT_HANDSHAKE = 'CT_PORT_HANDSHAKE';
	const KIND = { HELLO: 'hello', INIT: 'init', REQ: 'req', RES: 'res', EVT: 'evt', ACK: 'ack', LOG: 'log' };

	// the plugin API level this app supports. The main process substitutes the
	// token when it serves this file (src/shared/pluginApi.json); left as-is it
	// reads as NaN and falls back to 1.
	const API_VERSION = Number('__CT_PLUGIN_API_VERSION__') || 1;

	// --- internal state -------------------------------------------------
	let port = null;                 // private MessagePort, handed over at load
	let nextId = 1;                  // request/response correlation
	const pending = new Map();       // id -> { resolve, reject }
	const listeners = new Map();     // event name -> Set<fn>
	const stateListeners = new Map(); // state key -> Set<fn>
	const preBuffer = [];            // requests issued before the port arrives
	let demoActive = false;          // cached widget-demo-mode flag (host-pushed)
	let visibility = { visible: true, active: true }; // cached OBS source visibility

	let readyResolve;
	const readyPromise = new Promise((res) => { readyResolve = res; });

	/**
	 * Send a brokered request to the host and await its reply. If the port
	 * hasn't been handed over yet, the request is buffered and flushed once
	 * the handshake completes, so authors can call CT methods immediately.
	 *
	 * @param {string} type - capability method, e.g. 'points.adjust'
	 * @param {Object} [payload] - method arguments
	 * @returns {Promise<*>} resolves with the result, rejects on denied/error
	 */
	function request(type, payload = {}) {
		return new Promise((resolve, reject) => {
			const id = nextId++;
			pending.set(id, { resolve, reject });
			const msg = { kind: KIND.REQ, id, type, payload };
			if (port)
				port.postMessage(msg);
			else
				preBuffer.push(msg);
		});
	}

	/**
	 * Register an event handler.
	 *
	 * @param {string} name - event name ('chat','command','obs','settings',...)
	 * @param {Function} fn - callback invoked with the event detail
	 * @returns {Function} unsubscribe function
	 */
	function on(name, fn) {
		if (!listeners.has(name))
			listeners.set(name, new Set());
		listeners.get(name).add(fn);
		return () => {
			const set = listeners.get(name);
			if (set) set.delete(fn);
		};
	}

	/**
	 * Fan an inbound event detail out to its registered listeners.
	 *
	 * @param {string} name - event name
	 * @param {*} detail - event payload
	 */
	function emit(name, detail) {
		const set = listeners.get(name);
		if (!set) return;
		for (const fn of set) {
			try { fn(detail); }
			catch (e) { console.error(`[CT] listener for "${name}" threw`, e); }
		}
	}

	/**
	 * Handle a single message arriving over the port (reply or pushed event).
	 *
	 * @param {Object} msg - the message object
	 */
	function handleMessage(msg) {

		if (!msg || typeof msg !== 'object')
			return;

		// static info handed over once, right after the port opens
		if (msg.kind === KIND.INIT) {
			CT.info = msg.info || null;
			return;
		}

		// reply to one of our requests
		if (msg.kind === KIND.RES) {
			const p = pending.get(msg.id);
			if (!p) return;
			pending.delete(msg.id);
			if (msg.error)
				p.reject(new Error(msg.error));
			else
				p.resolve(msg.result);
			return;
		}

		// pushed event
		if (msg.kind === KIND.EVT) {
			if (msg.name === 'load') {
				if (msg.detail && msg.detail.commands && typeof msg.detail.commands === 'object')
					CT.commands = msg.detail.commands;
				if (msg.detail && msg.detail.visibility) {
					visibility = { visible: !!msg.detail.visibility.visible, active: !!msg.detail.visibility.active };
					CT.visibility = { ...visibility };
				}
				readyResolve(msg.detail || {});
			}
			// command words changed (renamed / enabled / clash): cache, then listeners
			if (msg.name === 'commands' && msg.detail && typeof msg.detail === 'object')
				CT.commands = msg.detail;
			// OBS source shown/hidden: cache it, then fall through to listeners
			if (msg.name === 'visibility' && msg.detail) {
				visibility = { visible: !!msg.detail.visible, active: !!msg.detail.active };
				CT.visibility = { ...visibility };
			}
			// namespaced state change: { key, value } -> per-key listeners
			if (msg.name === 'state' && msg.detail) {
				const set = stateListeners.get(msg.detail.key);
				if (set) for (const fn of set) {
					try { fn(msg.detail.value); }
					catch (e) { console.error('[CT] state listener threw', e); }
				}
				return;
			}
			// widget demo mode toggled: cache it + fan the boolean out
			if (msg.name === 'demo' && msg.detail) {
				demoActive = !!msg.detail.active;
				CT.demo.active = demoActive;
				emit('demo', demoActive);
				return;
			}
			emit(msg.name, msg.detail);
			return;
		}
	}

	// --- public surface -------------------------------------------------

	const CT = {

		/** @type {?Object} static info: { slug, id, version, class, widget:{slug,key,box} } */
		info: null,

		/**
		 * The plugin API level of the app running this widget (an integer).
		 * The store only installs plugins whose manifest "apiVersion" is <= this,
		 * so a plugin can rely on everything up to its own apiVersion. Compare
		 * against it to use newer features optionally.
		 * @type {number}
		 */
		apiVersion: API_VERSION,

		/**
		 * Resolves once the host handshake completes. The resolved value
		 * mirrors SE's onWidgetLoad detail: { settings, info, obsLive }.
		 *
		 * @returns {Promise<Object>}
		 */
		ready() { return readyPromise; },

		/**
		 * Convenience: run a callback once, when the widget finishes loading.
		 *
		 * @param {Function} cb - called with { settings, info, obsLive }
		 */
		onLoad(cb) { readyPromise.then(cb); },

		/**
		 * Subscribe to live settings changes (from the options page).
		 *
		 * @param {Function} cb - called with the new settings object
		 * @returns {Function} unsubscribe
		 */
		onSettingsChange(cb) { return on('settings', cb); },

		// --- namespaced render state (host-owned socket; no perm needed) ---
		state: {
			/**
			 * @param {string} k - state key (scoped to this plugin)
			 * @returns {Promise<*>}
			 */
			get: (k) => request('state.get', { key: k }),
			/**
			 * @param {string} k - state key
			 * @param {*} v - JSON-serialisable value
			 * @returns {Promise<void>}
			 */
			set: (k, v) => request('state.set', { key: k, value: v }),
			/**
			 * Subscribe to changes of a state key. Fires with the current value
			 * immediately and on every change - this is how a widget renders
			 * from the state the headless runner writes.
			 *
			 * @param {string} k
			 * @param {Function} cb - called with the value
			 * @returns {Function} unsubscribe
			 */
			onChange(k, cb) {
				if (!stateListeners.has(k))
					stateListeners.set(k, new Set());
				stateListeners.get(k).add(cb);
				request('state.subscribe', { key: k });
				return () => {
					const set = stateListeners.get(k);
					if (set) set.delete(cb);
				};
			},
		},

		// --- commands (perm: commands:hook) ---
		/**
		 * Handle a chat command routed to this plugin. The callback receives an
		 * object with accept()/reject() that mirror the native Toy handshake:
		 * call accept() ONLY after the action succeeded (it deducts the user's
		 * points and, for redeems, confirms them); call reject(reason) on
		 * failure (no deduction; redeem auto-refund).
		 *
		 * @param {Function} cb - ({ command, user, params, accept, reject }) => void
		 */
		onCommand(cb) {
			on('command', (d) => {
				let settled = false;
				const ack = (ok, reason) => {
					if (settled) return;
					settled = true;
					(port || { postMessage() {} }).postMessage({ kind: KIND.ACK, token: d.token, ok, reason });
				};
				cb({
					command: d.command,
					user: d.user,
					params: d.params,
					accept: () => ack(true),
					reject: (reason) => ack(false, reason),
				});
			});
		},

		// --- chat (perms: chat:read / chat:send) ---
		/**
		 * @param {Function} cb - called with each incoming chat message
		 * @returns {Function} unsubscribe
		 */
		onChat(cb) { return on('chat', cb); },
		chat: {
			/**
			 * Post a system/on-screen message through the app.
			 * @param {string} text
			 * @returns {Promise<void>}
			 */
			send: (text) => request('chat.send', { text }),
		},

		// --- points (perms: points:read / points:adjust) ---
		points: {
			/** @param {string} user - user id @returns {Promise<number>} */
			get: (user) => request('points.get', { user }),
			/** @param {string} user @param {number} delta @returns {Promise<number>} */
			adjust: (user, delta) => request('points.adjust', { user, delta }),
			/** @param {string} user @param {number} amount @returns {Promise<number>} */
			set: (user, amount) => request('points.set', { user, amount }),
		},

		// --- per-viewer saved data (perm: userdata:store) ---
		// Remember things about a viewer across streams: a high score, a
		// collection, a streak. Private to your plugin (keyed by your manifest
		// id). `user` is the id you get as command.user.id / chat.userId.
		// Data is a plain JSON object; limits: ~4 KB per viewer, ~10 MB for your
		// whole plugin, and a write rate cap (see limits()). Over a limit the
		// call rejects with a clear message - nothing is cut short. The app never
		// reads your data, so its shape is yours: keep a version field in it if
		// you may change it later.
		userData: {
			/** @param {string} user @returns {Promise<?Object>} saved data or null */
			get: (user) => request('userData.get', { user }),
			/** @param {Array<string>} users - up to 500 @returns {Promise<Object<string, ?Object>>} */
			getMany: (users) => request('userData.getMany', { users }),
			/** Replace. @param {string} user @param {Object} data @returns {Promise<Object>} */
			set: (user, data) => request('userData.set', { user, data }),
			/** Merge top-level fields (a field set to null is removed). @returns {Promise<Object>} */
			update: (user, patch) => request('userData.update', { user, patch }),
			/** @param {string} user @returns {Promise<boolean>} */
			delete: (user) => request('userData.delete', { user }),
			/**
			 * Leaderboard by a numeric field ('highScore' or 'stats.wins').
			 * @param {string} field
			 * @param {{limit?: number, order?: 'desc'|'asc'}} [opts] - limit up to 100
			 * @returns {Promise<Array<{userId: string, name: ?string, value: number, data: Object}>>}
			 */
			top: (field, opts = {}) => request('userData.top', { field, limit: opts.limit, order: opts.order }),
			/** @returns {Promise<Object>} the size / rate limits */
			limits: () => request('userData.limits', {}),
		},

		// --- users (perm: users:read) ---
		users: {
			/** @param {string} user - user id @returns {Promise<Object>} */
			get: (user) => request('users.get', { user }),
		},

		// --- assets (perm: assets:read) ---
		assets: {
			/**
			 * Resolve an asset id or plugin-relative path to a fetchable URL.
			 * @param {string} idOrPath
			 * @returns {Promise<string>}
			 */
			url: (idOrPath) => request('assets.url', { ref: idOrPath }),
		},

		// --- widget demo mode (no perm; host-pushed) ---
		// Mirrors the app-wide "Widget Demo Mode" toggle. Use this to render
		// representative sample content so a streamer can position the widget
		// in OBS even when it would normally be empty/hidden.
		demo: {
			/** @type {boolean} current demo-mode state */
			active: false,
			/**
			 * Subscribe to demo-mode changes. Fires immediately with the current
			 * value, then on every toggle.
			 *
			 * @param {Function} cb - called with a boolean
			 * @returns {Function} unsubscribe
			 */
			onChange(cb) {
				const off = on('demo', cb);
				try { cb(demoActive); }
				catch (e) { console.error('[CT] demo listener threw', e); }
				return off;
			},
		},

		// --- command words (no perm; host-pushed) ---
		// The streamer can rename your commands, and if another running toy
		// already uses your default word you get a free one (join -> join2).
		// So never hard-code "Type !join": ask for the real word.

		/**
		 * Your commands as { [key]: { command, enabled, active } }: key is the
		 * manifest command key, command the word chat types (no '!'), active
		 * whether typing it reaches you (enabled and not answered by another
		 * toy). Filled at load; kept current.
		 * @type {Object<string, {command:string, enabled:boolean, active:boolean}>}
		 */
		commands: {},

		/**
		 * The word chat types for one of your commands (no '!').
		 *
		 * @param {string} key - the manifest command key
		 * @param {string} [fallback] - used until the app has sent the words (default: key)
		 * @returns {string}
		 */
		commandWord(key, fallback) {
			const c = CT.commands && CT.commands[key];
			return (c && c.command) || (fallback === undefined ? key : fallback);
		},

		/**
		 * Called with the new CT.commands whenever a word, enabled flag or
		 * clash changes. Re-render any "Type !..." text here.
		 *
		 * @param {Function} cb
		 * @returns {Function} unsubscribe
		 */
		onCommandsChange(cb) { return on('commands', cb); },

		// --- OBS source visibility (no perm; host-pushed) ---
		// Whether this browser source is currently shown in OBS. OBS keeps
		// hidden browser sources running, so a widget that should "start when
		// it comes on screen" (e.g. an end-screen credits roll) restarts here.
		// `active` = on the program output (live on stream), `visible` = shown
		// in any view. Outside OBS both stay true.

		/** @type {{visible:boolean, active:boolean}} current state */
		visibility: { visible: true, active: true },

		/**
		 * Called on every OBS show/hide transition with
		 * { visible, active, event }. `event` is true for a real OBS transition
		 * (the source was just shown or hidden) and false for a state sync.
		 * OBS never reports the initial state, so a source that loads while its
		 * scene is off-air only hears about it when it comes on.
		 *
		 * @param {Function} cb
		 * @returns {Function} unsubscribe
		 */
		onVisibility(cb) { return on('visibility', cb); },

		// --- stream session (perm: session:read) ---
		// Everyone who chatted during the current stream. Stream boundaries are
		// automatic (OBS live state when available, YouTube live ids, and long
		// gaps); the list is kept after a stream ends until the next one starts.
		session: {
			/**
			 * @returns {Promise<?Object>} { id, startedAt, live, chatterCount,
			 *   chatters: [{ id, name, platform, avatar, isMember, messages,
			 *   firstSeen, points?, pointsThisStream? }] } in first-seen order.
			 *   points / pointsThisStream are included only with points:read.
			 *   null if nobody has chatted yet.
			 */
			get: () => request('session.get'),
			/**
			 * Called (throttled) when a new chatter joins, a new stream starts, or
			 * live state changes, with { id, chatterCount, live }. Re-fetch with
			 * session.get() if you need the list.
			 *
			 * @param {Function} cb
			 * @returns {Function} unsubscribe
			 */
			onChange: (cb) => on('session', cb),
		},

		// --- obs (perm: obs:status) ---
		obs: {
			/** @returns {Promise<boolean>} */
			isLive: () => request('obs.isLive'),
			/** @param {Function} cb - called with { live } @returns {Function} unsubscribe */
			onLive: (cb) => on('obs', cb),
		},

		/**
		 * Low-level event subscription (future bus: 'redemption','bits',
		 * 'subscription','follow','raid', each behind its own events:* perm).
		 *
		 * @param {string} name
		 * @param {Function} cb
		 * @returns {Function} unsubscribe
		 */
		on,

		/**
		 * Route a log line to the app's on-screen logger.
		 *
		 * @param {...*} args
		 */
		log(...args) {
			if (port) port.postMessage({ kind: KIND.LOG, args });
		},
	};

	// --- bootstrap: receive our private port, then go live --------------
	window.addEventListener('message', (e) => {

		if (e.data !== PORT_HANDSHAKE || !e.ports || !e.ports[0])
			return;

		port = e.ports[0];
		port.onmessage = (ev) => handleMessage(ev.data);

		// flush anything the author queued before the port existed
		for (const msg of preBuffer)
			port.postMessage(msg);
		preBuffer.length = 0;

		// tell the host we're ready; it replies with init + load
		port.postMessage({ kind: KIND.HELLO });
	});

	window.CT = CT;

})();
