/*
	socketRef.js
	------------

	Vue refs that stay in sync across the dashboard, OBS browser sources and
	browser tabs over a WebSocket. Same API as the old `socket-ref` npm
	package - every existing call site keeps working - but a very different
	transport underneath:

	  - ONE WebSocket per page (per server URL), not one per variable. All
	    refs on the page are multiplexed over it. A GroupWidget with six
	    iframes now opens ~7 sockets instead of ~60.
	  - The server only sends this page the keys it subscribed to.
	  - Refs on the same page that share a key share one subscription and are
	    updated locally, without a round trip.
	  - Writes are coalesced per tick and capped at ~100/s per key, but the
	    LATEST value always goes out (the old client dropped writes for a full
	    second when it hit its rate limit, which could leave a stale value).
	  - Reconnect uses backoff with jitter and re-subscribes everything. After
	    a reconnect the newest value wins, so a server restart doesn't reset
	    state back to defaults.
	  - A ref's subscription goes away when the ref is garbage collected, or
	    immediately via disposeSocketRef(ref).

	Deliberately UNCHANGED ref semantics (code relies on them):

	  - Until a ref's first init reply, local changes are NOT sent; the init
	    reply (server value, or the ref's default if the server has none)
	    overwrites them. This stops a freshly-loaded widget from clobbering
	    the app's real state with whatever it set during mount.
	  - Latest-timestamp-wins.
	  - Read-only variants return a computed and never write.
	  - watch(..., { flush: 'sync' }) on the ref, i.e. only `.value = ...`
	    assignments sync (in-place mutation of a deep ref's object does not).
*/

// vue
import { ref, shallowRef, watch, computed, isRef } from 'vue';


// ----------------------------------------------------------------------
// module config
// ----------------------------------------------------------------------

/** Port used by refs that don't specify their own. */
let globalPortSetting = 3001;

/** Verbose connection logging for debugging. */
let showConnectionLogs = false;

/** Minimum gap between two sends of the same key (=> <= ~100/s per key). */
const MIN_SEND_INTERVAL_MS = 10;

/** Reconnect backoff bounds. */
const RECONNECT_MIN_MS = 250;
const RECONNECT_MAX_MS = 5000;

/** Hidden property linking a returned ref/computed to its binding. */
const BINDING = Symbol('ctSocketBinding');


/**
 * Sets the global port number to use when sockets don't specify their port.
 * If a page-level connection already exists on another port it is moved to
 * the new one (all subscriptions carry over).
 *
 * @param {Number} portNumber
 */
export function setGlobalSocketRefPort(portNumber) {
	if (portNumber === globalPortSetting)
		return;
	globalPortSetting = portNumber;
	for (const conn of connections.values()) {
		if (conn.usesGlobalPort)
			conn.retarget();
	}
}


/**
 * Enable or disable connection logs for debugging.
 *
 * @param {Boolean} enable
 */
export function enableConnectionLogs(enable = true) {
	showConnectionLogs = enable;
}


function log(...args) {
	if (showConnectionLogs)
		console.log('[socketRef]', ...args);
}


// ----------------------------------------------------------------------
// helpers
// ----------------------------------------------------------------------

/**
 * Values are JSON over the wire, so a JSON round trip is the faithful way to
 * give a second ref on the same page its own copy (same thing it would have
 * received from the network).
 */
function cloneValue(value) {
	if (value === null || typeof value !== 'object')
		return value;
	try {
		return JSON.parse(JSON.stringify(value));
	} catch (_) {
		return value;
	}
}


/** Best-effort label of where this page runs, for the server's diagnostics. */
function detectEnv() {
	try {
		const ua = navigator.userAgent || '';
		if (ua.includes('OBS')) return 'obs';
		if (ua.includes('Electron')) return 'electron';
		return 'browser';
	} catch (_) {
		return '';
	}
}


function pageLabel() {
	try {
		return (location.pathname || '') + (location.search || '');
	} catch (_) {
		return '';
	}
}


// ----------------------------------------------------------------------
// connection (one per server URL per page)
// ----------------------------------------------------------------------

/** @type {Map<string, Connection>} */
const connections = new Map();


function getConnection(ip, port) {
	const usesGlobalPort = (port === undefined || port === null);
	const id = `${ip}|${usesGlobalPort ? 'global' : port}`;
	let conn = connections.get(id);
	if (!conn) {
		conn = new Connection(ip, usesGlobalPort ? undefined : port);
		connections.set(id, conn);
	}
	return conn;
}


class Connection {

	constructor(ip, port) {
		this.ip = ip;
		this.port = port;
		this.usesGlobalPort = (port === undefined);

		/** @type {Map<string, Channel>} */
		this.channels = new Map();

		this.socket = null;
		this.open = false;
		this.reconnectDelay = RECONNECT_MIN_MS;
		this.reconnectTimer = null;

		// channels with a write waiting to go out
		this.dirty = new Set();
		this.flushQueued = false;
		this.flushTimer = null;

		// counters for getSocketStats()
		this.stats = { connects: 0, msgsIn: 0, msgsOut: 0, bytesIn: 0, bytesOut: 0 };

		this.connect();
	}


	get url() {
		const port = this.usesGlobalPort ? globalPortSetting : this.port;
		return `ws://${this.ip}:${port}`;
	}


	connect() {

		clearTimeout(this.reconnectTimer);
		this.reconnectTimer = null;

		const url = this.url;
		log('connecting to', url);

		let socket;
		try {
			socket = new WebSocket(url);
		} catch (e) {
			this.scheduleReconnect();
			return;
		}
		this.socket = socket;

		socket.onopen = () => {
			if (socket !== this.socket) return;
			log('connected to', url);
			this.open = true;
			this.stats.connects++;
			this.reconnectDelay = RECONNECT_MIN_MS;

			this.sendRaw({ type: 'ct-hello', v: 2, page: pageLabel(), env: detectEnv() });

			// (re)subscribe every key this page cares about
			for (const channel of this.channels.values()) {
				channel.ready = false;
				this.sendRaw({ type: 'init', key: channel.key });
			}
		};

		socket.onmessage = (event) => {
			if (socket !== this.socket) return;
			this.stats.msgsIn++;
			this.stats.bytesIn += (event.data && event.data.length) || 0;

			let msg;
			try {
				msg = JSON.parse(event.data);
			} catch (_) {
				return;
			}
			if (!msg || typeof msg.key !== 'string')
				return;

			const channel = this.channels.get(msg.key);
			if (!channel)
				return; // unsubscribed in the meantime

			if (msg.type === 'init')
				channel.handleInit(msg);
			else
				channel.handleUpdate(msg);
		};

		socket.onclose = () => {
			if (socket !== this.socket) return;
			log('disconnected from', url);
			const wasOpen = this.open;
			this.open = false;
			this.socket = null;
			if (wasOpen) {
				for (const channel of this.channels.values())
					channel.handleDisconnect();
			}
			this.scheduleReconnect();
		};

		socket.onerror = () => {
			log('error on', url);
			try { socket.close(); } catch (_) { /* ignore */ }
		};
	}


	scheduleReconnect() {
		if (this.reconnectTimer)
			return;
		const jitter = 0.8 + Math.random() * 0.4;
		const delay = Math.round(this.reconnectDelay * jitter);
		this.reconnectDelay = Math.min(RECONNECT_MAX_MS, this.reconnectDelay * 2);
		this.reconnectTimer = setTimeout(() => this.connect(), delay);
	}


	/** Point this connection at the (new) global port. */
	retarget() {
		const old = this.socket;
		this.socket = null;
		if (old) {
			if (this.open) {
				this.open = false;
				for (const channel of this.channels.values())
					channel.handleDisconnect();
			}
			try { old.close(); } catch (_) { /* ignore */ }
		}
		this.reconnectDelay = RECONNECT_MIN_MS;
		this.connect();
	}


	sendRaw(obj) {
		if (!this.open || !this.socket)
			return false;
		let text;
		try {
			text = JSON.stringify(obj);
		} catch (e) {
			console.warn('[socketRef] could not serialize value for', obj && obj.key, e);
			return false;
		}
		try {
			this.socket.send(text);
		} catch (_) {
			return false;
		}
		this.stats.msgsOut++;
		this.stats.bytesOut += text.length;
		return true;
	}


	getChannel(key) {
		let channel = this.channels.get(key);
		if (!channel) {
			channel = new Channel(this, key);
			this.channels.set(key, channel);
			this.sendRaw({ type: 'init', key });
		}
		return channel;
	}


	dropChannel(channel) {
		if (this.channels.get(channel.key) !== channel)
			return;
		// don't lose a write that hasn't gone out yet
		if (this.dirty.has(channel))
			this.flushChannel(channel, Date.now(), true);
		this.dirty.delete(channel);
		this.channels.delete(channel.key);
		this.sendRaw({ type: 'unsub', key: channel.key });
	}


	queueWrite(channel) {
		this.dirty.add(channel);
		if (this.flushQueued)
			return;
		this.flushQueued = true;
		// coalesce every write made in the same tick into one send per key
		queueMicrotask(() => {
			this.flushQueued = false;
			this.flush();
		});
	}


	flush() {
		const now = Date.now();
		let nextDue = Infinity;

		for (const channel of [...this.dirty]) {
			const due = this.flushChannel(channel, now, false);
			if (due)
				nextDue = Math.min(nextDue, due);
		}

		// something was rate limited: come back when it's allowed out
		if (nextDue !== Infinity && !this.flushTimer) {
			this.flushTimer = setTimeout(() => {
				this.flushTimer = null;
				this.flush();
			}, Math.max(0, nextDue - Date.now()));
		}
	}


	/**
	 * Send a dirty channel's latest value if allowed.
	 *
	 * @returns {Number|null} when to retry (ms epoch) if rate limited
	 */
	flushChannel(channel, now, force) {

		if (!this.open || !channel.ready) {
			// connection is down: remember it; reconciled on reconnect
			this.dirty.delete(channel);
			channel.pending = { value: channel.value, timestamp: channel.timestamp };
			return null;
		}

		const due = channel.lastSentAt + MIN_SEND_INTERVAL_MS;
		if (!force && now < due)
			return due;

		this.dirty.delete(channel);
		channel.lastSentAt = now;
		const ok = this.sendRaw({
			type: 'update',
			key: channel.key,
			value: channel.value,
			timestamp: channel.timestamp,
		});
		if (!ok)
			channel.pending = { value: channel.value, timestamp: channel.timestamp };
		return null;
	}
}


// ----------------------------------------------------------------------
// channel (one per key per connection, shared by every ref for that key)
// ----------------------------------------------------------------------

class Channel {

	constructor(conn, key) {
		this.conn = conn;
		this.key = key;

		// last known value for this key on this page
		this.value = undefined;
		this.timestamp = 0;
		this.known = false;

		// ready = init reply received on the CURRENT connection
		this.ready = false;

		// a local write that couldn't be sent (connection was down)
		this.pending = null;

		this.lastSentAt = 0;

		/** @type {Set<WeakRef<Binding>>} */
		this.bindings = new Set();
	}


	liveBindings() {
		const out = [];
		for (const wr of this.bindings) {
			const b = wr.deref();
			if (b && !b.disposed)
				out.push(b);
			else
				this.bindings.delete(wr);
		}
		return out;
	}


	addBinding(binding) {
		this.bindings.add(new WeakRef(binding));

		// channel already live on this connection: bring the newcomer up to
		// date now instead of waiting for a network round trip
		if (this.ready) {
			if (this.known)
				binding.apply(cloneValue(this.value));
			else if (!binding.readOnly)
				this.adoptLocal(binding.defaultValue, binding, true);
			else
				binding.apply(binding.defaultValue);
			binding.markReady();
		}
	}


	/** Drop GC'd / disposed bindings; release the subscription if none left. */
	prune() {
		if (this.liveBindings().length === 0)
			this.conn.dropChannel(this);
	}


	/**
	 * Server reply to our `init` (first connect, or re-subscribe after a
	 * reconnect / port change).
	 */
	handleInit(msg) {

		const bindings = this.liveBindings();
		const serverValue = msg.value;
		const serverTs = msg.timestamp || 0;
		const serverHas = !(serverValue === null || serverValue === undefined);
		const writer = bindings.find(b => !b.readOnly) || null;
		const pending = this.pending;
		this.pending = null;
		this.ready = true;

		// did this key's value on the page change? (if not, refs that are
		// already in sync keep what they have - no reactivity blip)
		let changed = false;
		let owner = null;   // binding that already holds this.value's object
		let fresh = false;  // this.value is a freshly parsed network object

		if (pending && (!serverHas || pending.timestamp > serverTs)) {
			// wrote while disconnected and it's newer: publish it
			this.value = pending.value;
			this.timestamp = pending.timestamp;
			this.known = true;
			this.publish();
		} else if (this.known && writer && (!serverHas || this.timestamp > serverTs)) {
			// server lost our value (restart) or has an older one: re-seed it
			// with what we have instead of resetting everyone to defaults
			this.publish();
		} else if (serverHas) {
			if (!(this.known && serverTs === this.timestamp)) {
				this.value = serverValue;
				this.timestamp = serverTs;
				this.known = true;
				changed = true;
				fresh = true;
			}
		} else if (!this.known && writer) {
			// first sighting anywhere: seed with the writer's default
			this.value = writer.defaultValue;
			this.timestamp = this.nextTimestamp();
			this.known = true;
			changed = true;
			owner = writer;
			this.publish();
		}

		// update refs: everyone if the value changed, otherwise just refs
		// that have never been in sync (they may hold pre-sync local edits
		// or nothing at all, and must be overwritten - see file header)
		let first = true;
		for (const b of bindings) {
			if (changed) {
				if (b === owner || (fresh && first))
					b.apply(this.value);
				else
					b.apply(cloneValue(this.value));
				first = false;
			} else if (!b.ready) {
				b.apply(this.known ? cloneValue(this.value) : b.defaultValue);
			}
		}

		for (const b of bindings)
			b.markReady();
	}


	/**
	 * A subscribed key changed on the server.
	 */
	handleUpdate(msg) {

		const ts = msg.timestamp;
		if (typeof ts !== 'number' || ts <= this.timestamp)
			return;

		this.value = msg.value;
		this.timestamp = ts;
		this.known = true;
		this.pending = null;
		this.conn.dirty.delete(this); // an unsent older local write is now moot

		let first = true;
		for (const b of this.liveBindings()) {
			b.apply(first ? msg.value : cloneValue(msg.value));
			first = false;
		}
	}


	handleDisconnect() {
		this.ready = false;
		// anything queued but unsent becomes pending for the reconnect
		if (this.conn.dirty.has(this)) {
			this.conn.dirty.delete(this);
			this.pending = { value: this.value, timestamp: this.timestamp };
		}
	}


	/**
	 * A ref on this page was assigned locally.
	 */
	localWrite(value, origin) {
		this.adoptLocal(value, origin, false);
	}


	/**
	 * Make `value` this key's current value on this page, push it to the
	 * other refs, and send it to the server.
	 *
	 * @param {*} value
	 * @param {Binding} origin - ref whose object `value` is
	 * @param {Boolean} includeOrigin - also apply to origin (seeding a default)
	 */
	adoptLocal(value, origin, includeOrigin) {

		this.value = value;
		this.timestamp = this.nextTimestamp();
		this.known = true;

		// origin keeps its own object; every other ref gets a copy, exactly
		// as if the value had come to it over the network
		for (const b of this.liveBindings()) {
			if (b === origin) {
				if (includeOrigin)
					b.apply(value);
			} else {
				b.apply(cloneValue(value));
			}
		}

		this.publish();
	}


	/** Send the current value now-ish, or park it until we're connected. */
	publish() {
		if (this.ready && this.conn.open)
			this.conn.queueWrite(this);
		else
			this.pending = { value: this.value, timestamp: this.timestamp };
	}


	/**
	 * Date.now(), but strictly increasing for this key: two writes in the
	 * same millisecond must still be ordered or the server rejects the
	 * second as "not newer".
	 */
	nextTimestamp() {
		const now = Date.now();
		return now > this.timestamp ? now : this.timestamp + 1;
	}
}


// ----------------------------------------------------------------------
// binding (one per socketRef() call)
// ----------------------------------------------------------------------

class Binding {

	constructor(channel, state, defaultValue, readOnly, onInitialConnect) {
		this.channel = channel;
		this.state = state;
		this.defaultValue = defaultValue;
		this.readOnly = readOnly;
		this.onInitialConnect = onInitialConnect || null;

		this.ready = false;        // has received its first init
		this.applying = false;     // suppress our own watcher while applying
		this.disposed = false;
		this.stopWatch = null;
	}


	apply(value) {
		this.applying = true;
		try {
			this.state.value = value;
		} finally {
			this.applying = false;
		}
	}


	markReady() {
		if (this.ready)
			return;
		this.ready = true;
		const cb = this.onInitialConnect;
		this.onInitialConnect = null;
		if (cb) {
			try { cb(); } catch (e) { console.error('[socketRef] onInitialConnect error', e); }
		}
	}


	dispose() {
		if (this.disposed)
			return;
		this.disposed = true;
		if (this.stopWatch) {
			this.stopWatch();
			this.stopWatch = null;
		}
		this.channel.prune();
	}
}


// When a ref is garbage collected, release its subscription.
const registry = new FinalizationRegistry((channel) => {
	try { channel.prune(); } catch (_) { /* page tearing down */ }
});


// ----------------------------------------------------------------------
// public API (unchanged from the socket-ref package)
// ----------------------------------------------------------------------

/**
 * Create a ref that is synced with the server.
 *
 * @param {Function} refType - ref or shallowRef
 * @param {String|Object} keyOrObj - key, or { key, ip?, port? }
 * @param {*} initialValue - default value
 * @param {Boolean} readOnly - return a read-only computed, never write
 * @param {Function} [onInitialConnect] - called once, when first in sync
 */
function createSocketRef(refType, keyOrObj, initialValue, readOnly, onInitialConnect) {

	const options = typeof keyOrObj === 'string' ? { key: keyOrObj } : keyOrObj;
	const key = options.key;
	const ip = options.ip || 'localhost';
	const port = options.port || undefined;

	// A ref passed as the default is unwrapped to its value. ref(someRef)
	// returns someRef itself, which would alias the caller's ref (e.g.
	// keepAliveSocket passes its writable heartbeat ref as the default of a
	// read-only view of the same key). A sibling on the same key stays in
	// sync anyway, so a plain copy of the value is the right default.
	if (isRef(initialValue))
		initialValue = initialValue.value;

	const state = refType(initialValue);

	const conn = getConnection(ip, port);
	const channel = conn.getChannel(key);
	const binding = new Binding(channel, state, initialValue, readOnly, onInitialConnect);

	// the ref keeps its binding alive; the channel only holds it weakly,
	// so dropping the ref is enough to release the subscription
	Object.defineProperty(state, BINDING, { value: binding, enumerable: false });

	binding.stopWatch = watch(state, (newVal) => {
		if (binding.applying || binding.disposed || binding.readOnly)
			return;
		// before the first init reply local changes are not sent (see header)
		if (!binding.ready)
			return;
		channel.localWrite(newVal, binding);
	}, { flush: 'sync' });

	channel.addBinding(binding);
	registry.register(state, channel);

	if (readOnly) {
		const ro = computed(() => state.value);
		Object.defineProperty(ro, BINDING, { value: binding, enumerable: false });
		return ro;
	}
	return state;
}


/**
 * @param {String|Object} keyOrObj
 * @param {*} defaultValue
 * @returns {import('vue').Ref}
 */
export function socketRef(keyOrObj, defaultValue) {
	return createSocketRef(ref, keyOrObj, defaultValue, false);
}


/**
 * @param {String|Object} keyOrObj
 * @param {*} defaultValue
 * @returns {import('vue').ShallowRef}
 */
export function socketShallowRef(keyOrObj, defaultValue) {
	return createSocketRef(shallowRef, keyOrObj, defaultValue, false);
}


/**
 * @param {String|Object} keyOrObj
 * @param {*} defaultValue
 * @returns {import('vue').ComputedRef}
 */
export function socketRefReadOnly(keyOrObj, defaultValue) {
	return createSocketRef(ref, keyOrObj, defaultValue, true);
}


/**
 * @param {String|Object} keyOrObj
 * @param {*} defaultValue
 * @returns {import('vue').ComputedRef}
 */
export function socketShallowRefReadOnly(keyOrObj, defaultValue) {
	return createSocketRef(shallowRef, keyOrObj, defaultValue, true);
}


/**
 * Resolves once the ref is in sync with the server.
 *
 * @param {String|Object} keyOrObj
 * @param {*} defaultValue
 * @returns {Promise<import('vue').Ref>}
 */
export function socketRefAsync(keyOrObj, defaultValue) {
	return new Promise((resolve) => {
		let result = null;
		let fired = false;
		result = createSocketRef(ref, keyOrObj, defaultValue, false, () => {
			fired = true;
			if (result) resolve(result);
		});
		// already in sync (another ref on this page shares the key)
		if (fired) resolve(result);
	});
}


/**
 * Resolves once the shallow ref is in sync with the server.
 *
 * @param {String|Object} keyOrObj
 * @param {*} defaultValue
 * @returns {Promise<import('vue').ShallowRef>}
 */
export function socketShallowRefAsync(keyOrObj, defaultValue) {
	return new Promise((resolve) => {
		let result = null;
		let fired = false;
		result = createSocketRef(shallowRef, keyOrObj, defaultValue, false, () => {
			fired = true;
			if (result) resolve(result);
		});
		if (fired) resolve(result);
	});
}


/**
 * Run `cb` once the ref is in sync with the server (right away if it already
 * is). Writes made before that are overwritten by the server's reply (see
 * the file header), so an owner that computes its value locally should
 * (re)publish here. No-op for anything that isn't a socket ref.
 *
 * @param {import('vue').Ref} r
 * @param {Function} cb
 */
export function whenSocketRefReady(r, cb) {
	const b = r && r[BINDING];
	if (!b || b.disposed)
		return;
	if (b.ready) {
		cb();
		return;
	}
	const prev = b.onInitialConnect;
	b.onInitialConnect = () => {
		if (prev) prev();
		cb();
	};
}


/**
 * Stop syncing a ref now instead of waiting for garbage collection. The ref
 * keeps its last value but no longer sends or receives. No-op for anything
 * that isn't a socket ref.
 *
 * @param {import('vue').Ref|import('vue').ComputedRef} r
 */
export function disposeSocketRef(r) {
	const binding = r && r[BINDING];
	if (binding)
		binding.dispose();
}


/**
 * Client-side view of this page's connections, for the Debug page.
 *
 * @returns {Array<Object>}
 */
export function getSocketStats() {
	const out = [];
	for (const conn of connections.values()) {
		let refs = 0;
		const keys = [];
		for (const ch of conn.channels.values()) {
			const n = ch.liveBindings().length;
			refs += n;
			keys.push({ key: ch.key, refs: n, ready: ch.ready });
		}
		out.push({
			url: conn.url,
			open: conn.open,
			channels: conn.channels.size,
			refs,
			...conn.stats,
			keys: keys.sort((a, b) => a.key.localeCompare(b.key)),
		});
	}
	return out;
}
