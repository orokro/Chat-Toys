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

	// --- internal state -------------------------------------------------
	let port = null;                 // private MessagePort, handed over at load
	let nextId = 1;                  // request/response correlation
	const pending = new Map();       // id -> { resolve, reject }
	const listeners = new Map();     // event name -> Set<fn>
	const preBuffer = [];            // requests issued before the port arrives

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
			if (msg.name === 'load')
				readyResolve(msg.detail || {});
			emit(msg.name, msg.detail);
			return;
		}
	}

	// --- public surface -------------------------------------------------

	const CT = {

		/** @type {?Object} static info: { slug, id, version, class, widget:{slug,key,box} } */
		info: null,

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
