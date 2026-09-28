/*
	SocketServer.js
	---------------

	The WebSocket server that syncs socket refs between the dashboard, OBS
	browser sources and any browser tab showing a widget. Replaces the old
	`socket-ref` npm package's server.

	Why it was rewritten (see misc/lag-and-socket-investigation.md, Round 3):
	the old server sent EVERY change of EVERY key to EVERY connected socket and
	let clients throw away the ~90% they didn't care about. A GroupWidget loads
	one iframe per item, each opening ~10 sockets, so a group of six pointed at
	a busy chat (Lofi Girl) meant ~60 sockets all receiving the full chat log
	on every message - in the main process, where a saturated loop freezes the
	whole app.

	What this server does instead:

	  - Routing. A socket only receives keys it subscribed to (via `init`).
	  - Muxing-friendly. One socket can subscribe to any number of keys, so the
	    new client opens one socket per page instead of one per variable. Old
	    one-key-per-socket clients still work unchanged: an `init` is simply a
	    subscription to that one key.
	  - Parse once. Every inbound frame is JSON-parsed exactly once and handed
	    to typed handlers (`chat`, `plugin-rpc`, `echo`, ...). Previously the
	    socket-ref server, chatForward and pluginForward each parsed every
	    frame separately.
	  - Forward, don't re-serialize. A client update is relayed to subscribers
	    as the exact text frame it arrived in, instead of being re-stringified.
	  - Backpressure. A slow client never builds an unbounded backlog: once
	    its send buffer passes a threshold we keep only the latest value per
	    key and flush when it drains (values are latest-state, so this is
	    lossless).
	  - Survives restarts. Stored values and registered handlers live on this
	    object, not on the ws.WebSocketServer, so restarting the HTTP/WS
	    servers (e.g. a port change) no longer drops chat forwarding / plugin
	    RPC or wipes state.
	  - Metrics. stats() feeds the --diag log and the dev Debug page.

	Wire protocol (JSON text frames):

	  client -> server
	    { type:'init',   key }                      subscribe + request current value
	    { type:'update', key, value, timestamp }     write (type may be omitted - legacy)
	    { type:'unsub',  key }                       unsubscribe
	    { type:'ct-hello', v, page, env }            optional label for diagnostics
	    { type:<other>, ... }                        dispatched to onMessage(type) handlers

	  server -> client
	    { type:'init', key, value, timestamp }       reply to init (value null if unknown)
	    { type:'update', key, value, timestamp }     a subscribed key changed
	                                                 (relayed frames may omit type;
	                                                  clients treat anything that
	                                                  isn't 'init' as an update)
*/

// ws server
import { WebSocketServer } from 'ws';


/** Once a client has this many bytes queued, coalesce instead of sending. */
const BACKPRESSURE_BYTES = 1 << 20; // 1 MB

/** How often to try flushing coalesced values to backed-up clients. */
const PENDING_FLUSH_MS = 50;

/** How often the per-second rate window rolls over. */
const RATE_WINDOW_MS = 1000;


/**
 * Main-process WebSocket server for socket refs, plus a typed message bus
 * for the non-ref traffic that shares the same port.
 */
export class SocketServer {

	constructor() {

		/** @type {WebSocketServer|null} */
		this.wss = null;

		// key -> { value, timestamp }. Survives detach()/attach() so a server
		// restart doesn't wipe state that clients then re-seed with defaults.
		this.store = new Map();

		// key -> Set<socket> of subscribers
		this.subscribers = new Map();

		// type -> Set<fn(msg, socket)>
		this.messageHandlers = new Map();
		this.connectionHandlers = new Set();
		this.disconnectHandlers = new Set();

		// bookkeeping
		this._nextSocketId = 1;
		this._drainTimer = null;
		this._rateTimer = null;

		this._resetMetrics();
	}


	// ------------------------------------------------------------------
	// lifecycle
	// ------------------------------------------------------------------

	/**
	 * Start accepting WebSocket connections on an existing HTTP server.
	 * Safe to call again after detach() (server restart).
	 *
	 * @param {import('http').Server} httpServer
	 * @returns {WebSocketServer} the underlying ws server
	 */
	attach(httpServer) {

		if (this.wss)
			this.detach();

		const wss = new WebSocketServer({ server: httpServer });
		this.wss = wss;

		wss.on('connection', (socket, req) => this._onConnection(socket, req));

		this._drainTimer = setInterval(() => this._drainPending(), PENDING_FLUSH_MS);
		if (typeof this._drainTimer.unref === 'function') this._drainTimer.unref();

		this._rateTimer = setInterval(() => this._rollRates(), RATE_WINDOW_MS);
		if (typeof this._rateTimer.unref === 'function') this._rateTimer.unref();

		return wss;
	}


	/**
	 * Stop the ws server and drop all live connections. Stored values and
	 * registered handlers are kept for the next attach().
	 */
	detach() {

		clearInterval(this._drainTimer);
		clearInterval(this._rateTimer);
		this._drainTimer = null;
		this._rateTimer = null;

		const wss = this.wss;
		this.wss = null;
		this.subscribers.clear();

		if (!wss)
			return;

		for (const socket of wss.clients) {
			try { socket.terminate(); } catch (_) { /* already gone */ }
		}
		try { wss.close(); } catch (_) { /* already closed */ }
	}


	// ------------------------------------------------------------------
	// handler registration (persist across attach/detach)
	// ------------------------------------------------------------------

	/**
	 * Handle inbound messages of a given `type` that aren't socket-ref
	 * protocol messages (e.g. 'chat', 'plugin-rpc', 'echo').
	 *
	 * @param {String} type
	 * @param {(msg:Object, socket:import('ws').WebSocket) => void} fn
	 * @returns {Function} unregister
	 */
	onMessage(type, fn) {
		if (!this.messageHandlers.has(type))
			this.messageHandlers.set(type, new Set());
		this.messageHandlers.get(type).add(fn);
		return () => this.messageHandlers.get(type)?.delete(fn);
	}


	/**
	 * @param {(socket, req) => void} fn
	 * @returns {Function} unregister
	 */
	onConnection(fn) {
		this.connectionHandlers.add(fn);
		return () => this.connectionHandlers.delete(fn);
	}


	/**
	 * @param {(socket) => void} fn
	 * @returns {Function} unregister
	 */
	onDisconnect(fn) {
		this.disconnectHandlers.add(fn);
		return () => this.disconnectHandlers.delete(fn);
	}


	// ------------------------------------------------------------------
	// connection handling
	// ------------------------------------------------------------------

	_onConnection(socket, req) {

		socket._ct = {
			id: this._nextSocketId++,
			ip: req?.socket?.remoteAddress || '',
			ua: req?.headers?.['user-agent'] || '',
			page: '',
			env: '',
			subs: new Set(),
			pending: null,          // Map<key, frame> while backed up
			connectedAt: Date.now(),
			msgsIn: 0,
			msgsOut: 0,
		};
		this.metrics.connectionsOpened++;

		socket.on('message', (data, isBinary) => this._onFrame(socket, data, isBinary));
		socket.on('close', () => this._onClose(socket));
		socket.on('error', () => { /* 'close' follows; nothing else to do */ });

		for (const fn of this.connectionHandlers)
			this._safeCall(fn, socket, req);
	}


	_onClose(socket) {

		const info = socket._ct;
		if (!info || info.closed)
			return;
		info.closed = true;

		for (const key of info.subs)
			this._removeSubscriber(key, socket);
		info.subs.clear();
		info.pending = null;

		this.metrics.connectionsClosed++;

		for (const fn of this.disconnectHandlers)
			this._safeCall(fn, socket);
	}


	_onFrame(socket, data, isBinary) {

		const info = socket._ct;
		const size = data?.length || 0;
		this.metrics.msgsIn++;
		this.metrics.bytesIn += size;
		this.window.msgsIn++;
		this.window.bytesIn += size;
		if (info) info.msgsIn++;

		// the one and only parse of this frame
		let msg;
		try {
			msg = JSON.parse(isBinary ? Buffer.from(data).toString() : data);
		} catch (_) {
			return; // not JSON - nobody on this server wants it
		}
		if (!msg || typeof msg !== 'object')
			return;

		// legacy clients omit type on updates
		const type = msg.type || 'update';

		switch (type) {

			case 'init':
				if (typeof msg.key === 'string')
					this._handleInit(socket, msg.key);
				return;

			case 'update':
				if (typeof msg.key === 'string' && msg.value !== undefined)
					this._handleUpdate(socket, msg, isBinary ? null : data);
				return;

			case 'unsub':
				if (typeof msg.key === 'string')
					this._removeSubscriber(msg.key, socket);
				return;

			case 'ct-hello':
				if (info) {
					info.page = String(msg.page || '').slice(0, 300);
					info.env = String(msg.env || '').slice(0, 20);
				}
				return;

			default: {
				const handlers = this.messageHandlers.get(type);
				if (!handlers)
					return;
				for (const fn of handlers)
					this._safeCall(fn, msg, socket);
			}
		}
	}


	// ------------------------------------------------------------------
	// socket-ref protocol
	// ------------------------------------------------------------------

	_handleInit(socket, key) {

		// subscribe
		let set = this.subscribers.get(key);
		if (!set) {
			set = new Set();
			this.subscribers.set(key, set);
		}
		set.add(socket);
		socket._ct?.subs.add(key);

		// reply with the current value (null when we've never seen the key)
		const existing = this.store.get(key);
		const frame = JSON.stringify({
			type: 'init',
			key,
			value: existing ? existing.value : null,
			timestamp: existing ? existing.timestamp : Date.now(),
		});

		// init replies are never coalesced away - the client can't become
		// ready without one
		this._send(socket, frame);
	}


	_handleUpdate(socket, msg, rawFrame) {

		const key = msg.key;
		const hasTs = typeof msg.timestamp === 'number' && Number.isFinite(msg.timestamp);
		const timestamp = hasTs ? msg.timestamp : Date.now();

		// latest-timestamp-wins; older or equal writes are dropped
		const existing = this.store.get(key);
		if (existing && !(timestamp > existing.timestamp)) {
			this.metrics.updatesStale++;
			return;
		}

		this.store.set(key, { value: msg.value, timestamp });
		this.metrics.updatesApplied++;

		// relay the frame as received when it's self-describing; otherwise
		// build one (only legacy clients that omit a timestamp hit this)
		const frame = (rawFrame && hasTs)
			? rawFrame
			: JSON.stringify({ type: 'update', key, value: msg.value, timestamp });

		this._broadcast(key, frame, socket);
	}


	_removeSubscriber(key, socket) {
		const set = this.subscribers.get(key);
		if (set) {
			set.delete(socket);
			if (set.size === 0)
				this.subscribers.delete(key);
		}
		socket._ct?.subs.delete(key);
		socket._ct?.pending?.delete(key);
	}


	/**
	 * Send a key's frame to that key's subscribers only, excluding the writer.
	 *
	 * @param {String} key
	 * @param {String|Buffer} frame
	 * @param {import('ws').WebSocket} [exclude]
	 */
	_broadcast(key, frame, exclude = null) {

		const set = this.subscribers.get(key);
		const keyStats = this._keyStats(key);
		const size = frame.length;
		keyStats.updates++;
		keyStats.lastSize = size;
		this.window.keyUpdates.set(key, (this.window.keyUpdates.get(key) || 0) + 1);

		if (!set || set.size === 0)
			return;

		const t0 = performance.now();
		let sent = 0;

		for (const client of set) {
			if (client === exclude || client.readyState !== client.OPEN)
				continue;
			if (this._sendOrQueue(client, key, frame))
				sent++;
		}

		const ms = performance.now() - t0;
		this.metrics.broadcasts++;
		this.metrics.broadcastMsTotal += ms;
		if (ms > this.window.broadcastMsMax) this.window.broadcastMsMax = ms;
		if (ms > this.metrics.broadcastMsMax) this.metrics.broadcastMsMax = ms;

		keyStats.sends += sent;
		keyStats.bytesOut += sent * size;
		this.window.keyBytes.set(key, (this.window.keyBytes.get(key) || 0) + sent * size);
	}


	/**
	 * @returns {Boolean} true if sent now, false if coalesced for later
	 */
	_sendOrQueue(client, key, frame) {

		const info = client._ct;
		if (client.bufferedAmount > BACKPRESSURE_BYTES) {
			if (info) {
				if (!info.pending) info.pending = new Map();
				info.pending.set(key, frame);
			}
			this.metrics.coalesced++;
			this.window.coalesced++;
			return false;
		}

		info?.pending?.delete(key);
		this._send(client, frame);
		return true;
	}


	_send(client, frame) {
		try {
			// frames relayed from a client arrive as Buffers - make sure
			// they go back out as TEXT so browsers get a string, not a Blob
			client.send(frame, { binary: false });
		} catch (_) {
			return; // client going away
		}
		const size = frame.length;
		this.metrics.msgsOut++;
		this.metrics.bytesOut += size;
		this.window.msgsOut++;
		this.window.bytesOut += size;
		if (client._ct) client._ct.msgsOut++;
	}


	_drainPending() {

		const wss = this.wss;
		if (!wss)
			return;

		for (const client of wss.clients) {
			const pending = client._ct?.pending;
			if (!pending || pending.size === 0)
				continue;
			if (client.readyState !== client.OPEN) {
				pending.clear();
				continue;
			}
			for (const [key, frame] of pending) {
				if (client.bufferedAmount > BACKPRESSURE_BYTES)
					break; // re-saturated; keep the rest for next pass
				pending.delete(key);
				this._send(client, frame);
			}
		}
	}


	// ------------------------------------------------------------------
	// metrics
	// ------------------------------------------------------------------

	_resetMetrics() {
		this.startedAt = Date.now();
		this.metrics = {
			connectionsOpened: 0,
			connectionsClosed: 0,
			msgsIn: 0,
			msgsOut: 0,
			bytesIn: 0,
			bytesOut: 0,
			updatesApplied: 0,
			updatesStale: 0,
			coalesced: 0,
			broadcasts: 0,
			broadcastMsTotal: 0,
			broadcastMsMax: 0,
		};
		this.keyStats = new Map(); // key -> { updates, sends, bytesOut, lastSize }
		this.window = this._emptyWindow();
		this.rates = this._ratesFromWindow(this.window, RATE_WINDOW_MS);
	}


	_emptyWindow() {
		return {
			start: Date.now(),
			msgsIn: 0, msgsOut: 0, bytesIn: 0, bytesOut: 0,
			coalesced: 0, broadcastMsMax: 0,
			keyUpdates: new Map(), keyBytes: new Map(),
		};
	}


	_ratesFromWindow(w, elapsedMs) {
		const per = 1000 / Math.max(1, elapsedMs);
		const topKeys = [...w.keyBytes.entries()]
			.sort((a, b) => b[1] - a[1])
			.slice(0, 8)
			.map(([key, bytes]) => ({
				key,
				bytesOutPerSec: Math.round(bytes * per),
				updatesPerSec: +((w.keyUpdates.get(key) || 0) * per).toFixed(1),
				subscribers: this.subscribers.get(key)?.size || 0,
			}));
		return {
			msgsInPerSec: Math.round(w.msgsIn * per),
			msgsOutPerSec: Math.round(w.msgsOut * per),
			bytesInPerSec: Math.round(w.bytesIn * per),
			bytesOutPerSec: Math.round(w.bytesOut * per),
			coalescedPerSec: Math.round(w.coalesced * per),
			broadcastMsMax: +w.broadcastMsMax.toFixed(2),
			topKeys,
		};
	}


	_rollRates() {
		const now = Date.now();
		this.rates = this._ratesFromWindow(this.window, now - this.window.start);
		this.window = this._emptyWindow();
	}


	_keyStats(key) {
		let s = this.keyStats.get(key);
		if (!s) {
			s = { updates: 0, sends: 0, bytesOut: 0, lastSize: 0 };
			this.keyStats.set(key, s);
		}
		return s;
	}


	/**
	 * Snapshot for the --diag log and the dev Debug page. Plain JSON-safe
	 * object; cheap enough to call once a second.
	 *
	 * @param {Object} [opts]
	 * @param {Boolean} [opts.clients=false] - include a per-connection list
	 * @returns {Object}
	 */
	stats({ clients = false } = {}) {

		const wss = this.wss;
		let subscriptions = 0;
		let maxBuffered = 0;
		let backedUp = 0;
		const list = [];

		if (wss) {
			for (const socket of wss.clients) {
				const info = socket._ct || {};
				const buffered = socket.bufferedAmount || 0;
				subscriptions += info.subs ? info.subs.size : 0;
				if (buffered > maxBuffered) maxBuffered = buffered;
				if (info.pending && info.pending.size > 0) backedUp++;

				if (clients) {
					list.push({
						id: info.id,
						env: info.env || (/OBS/.test(info.ua || '') ? 'obs' : ''),
						page: info.page || '',
						ip: info.ip,
						subs: info.subs ? info.subs.size : 0,
						muxed: !!info.page, // sent ct-hello => new client
						buffered,
						pending: info.pending ? info.pending.size : 0,
						msgsIn: info.msgsIn || 0,
						msgsOut: info.msgsOut || 0,
						ageSec: Math.round((Date.now() - (info.connectedAt || Date.now())) / 1000),
					});
				}
			}
		}

		const out = {
			t: Date.now(),
			uptimeSec: Math.round((Date.now() - this.startedAt) / 1000),
			attached: !!wss,
			clients: wss ? wss.clients.size : 0,
			subscriptions,
			keys: this.store.size,
			subscribedKeys: this.subscribers.size,
			maxBufferedBytes: maxBuffered,
			backedUpClients: backedUp,
			rates: this.rates,
			totals: { ...this.metrics, broadcastMsTotal: Math.round(this.metrics.broadcastMsTotal) },
		};
		if (clients)
			out.clientList = list.sort((a, b) => b.msgsOut - a.msgsOut);
		return out;
	}


	_safeCall(fn, ...args) {
		try {
			fn(...args);
		} catch (e) {
			console.error('[SocketServer] handler error:', e && (e.stack || e));
		}
	}
}
