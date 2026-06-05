/*
	RemoteBrokerProxy.js  (live page side)
	--------------------------------------

	A drop-in stand-in for a local PluginToy broker, used by PluginWidgetHost
	when it runs in the OBS / live page (where there is no ctApp / PluginToy in
	the same context). It speaks the plugin-rpc protocol to the dashboard's
	PluginToy over a raw WebSocket to the widget server, relayed by the main
	process (pluginForward.js) to the dashboard (PluginBridge.js).

	Exposes the SAME interface PluginWidgetHost expects from a broker:
	  - request(type, payload) -> Promise
	  - onBroker(name, cb)     -> unsubscribe
	  - resolveCommandAck(token, ok, reason)
	  - destroy()

	NOTE: command events are broadcast to every live widget of a plugin, so if
	two widgets of the same plugin are open they BOTH run the handler (V1's
	self-contained widget state - the headless runner that fixes this is a later
	phase). In practice a plugin has one widget source open.
*/

// lib
import { v4 as uuidv4 } from 'uuid';


export class RemoteBrokerProxy {

	/**
	 * @param {string} slug - the plugin slug
	 */
	constructor(slug) {

		this.slug = slug;
		this.instanceId = uuidv4();

		this._pending = new Map();      // reqId -> { resolve, reject }
		this._listeners = new Map();    // event name -> Set<fn>
		this._sendQueue = [];           // messages buffered until the socket opens
		this._open = false;
		this._closed = false;

		this._connect();
	}


	/**
	 * Widget server port, mirroring PluginWidgetHost's resolution.
	 *
	 * @returns {number}
	 */
	_port() {
		const q = new URLSearchParams(location.search);
		// prefer window.initPort (the real widget-server port) over location.port,
		// which in dev is the Vite server (8080), not the Express server (3001).
		return parseInt(q.get('port') || window.initPort || location.port || '3001', 10) || 3001;
	}


	/**
	 * Open (and keep open) the WebSocket to the widget server.
	 */
	_connect() {

		if (this._closed)
			return;

		try {
			this.ws = new WebSocket(`ws://localhost:${this._port()}`);
		} catch (e) {
			console.error('[RemoteBrokerProxy] failed to open socket', e);
			return;
		}

		this.ws.addEventListener('open', () => {
			this._open = true;
			// announce ourselves so the relay forwards our broker events
			this._raw({ type: 'plugin-rpc', kind: 'hello', slug: this.slug, instanceId: this.instanceId });
			for (const m of this._sendQueue)
				this._raw(m);
			this._sendQueue.length = 0;
		});

		this.ws.addEventListener('message', (ev) => this._onMessage(ev));

		this.ws.addEventListener('close', () => {
			this._open = false;
			if (!this._closed)
				setTimeout(() => this._connect(), 1000); // reconnect
		});
	}


	/**
	 * Send a raw message (buffer it if the socket isn't open yet).
	 *
	 * @param {Object} msg
	 */
	_raw(msg) {
		if (this._open && this.ws && this.ws.readyState === 1)
			this.ws.send(JSON.stringify(msg));
		else
			this._sendQueue.push(msg);
	}


	/**
	 * Handle an inbound message (a response to our req, or a pushed event).
	 *
	 * @param {MessageEvent} ev
	 */
	_onMessage(ev) {

		let msg;
		try { msg = JSON.parse(ev.data); }
		catch (e) { return; }

		if (!msg || msg.type !== 'plugin-rpc')
			return;

		if (msg.kind === 'res') {
			// responses are broadcast; only ours match instanceId
			if (msg.instanceId && msg.instanceId !== this.instanceId)
				return;
			const p = this._pending.get(msg.reqId);
			if (!p) return;
			this._pending.delete(msg.reqId);
			if (msg.error)
				p.reject(new Error(msg.error));
			else
				p.resolve(msg.result);
			return;
		}

		if (msg.kind === 'evt') {
			if (msg.slug !== this.slug)
				return;
			const set = this._listeners.get(msg.name);
			if (set) for (const fn of set) {
				try { fn(msg.detail); }
				catch (e) { console.error('[RemoteBrokerProxy] listener threw', e); }
			}
			return;
		}
	}


	// --- broker interface (matches PluginToy) ---------------------------

	/**
	 * @param {string} type
	 * @param {Object} [payload]
	 * @returns {Promise<*>}
	 */
	request(type, payload = {}) {
		return new Promise((resolve, reject) => {
			const reqId = uuidv4();
			this._pending.set(reqId, { resolve, reject });
			this._raw({
				type: 'plugin-rpc',
				kind: 'req',
				slug: this.slug,
				instanceId: this.instanceId,
				reqId,
				reqType: type,
				payload,
			});
		});
	}

	/**
	 * @param {string} name
	 * @param {Function} fn
	 * @returns {Function} unsubscribe
	 */
	onBroker(name, fn) {
		if (!this._listeners.has(name))
			this._listeners.set(name, new Set());
		this._listeners.get(name).add(fn);
		return () => {
			const set = this._listeners.get(name);
			if (set) set.delete(fn);
		};
	}

	/**
	 * @param {string} token
	 * @param {boolean} ok
	 * @param {string} [reason]
	 */
	resolveCommandAck(token, ok, reason) {
		this._raw({ type: 'plugin-rpc', kind: 'ack', slug: this.slug, token, ok, reason });
	}

	/**
	 * Close the socket and stop reconnecting.
	 */
	destroy() {
		this._closed = true;
		try { if (this.ws) this.ws.close(); }
		catch (e) { /* noop */ }
	}
}
