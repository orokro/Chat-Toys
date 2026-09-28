/*
	socketRefServer.js
	------------------

	provides a WebSocket server that can be used with socketRefClient.js

	This will allow you to sync refs between clients and a server.
*/

// our server
import { WebSocketServer } from 'ws';

/**
 * Creates a WebSocket server that can be used with socketRefClient.js
 * 
 * @param {Object} options - OPTIONAL; settings for the server
 * @returns {WebSocketServer} - The WebSocketServer instance
 */
export function socketRefServer(options = {}) {

	// handle options or defaults
	const port = options.port || 3001;
	let server = options.server || null;
	let wss;

	// create the server (or attach to an existing one)
	if (server) {
		wss = new WebSocketServer({ server });
	} else {
		wss = new WebSocketServer({ port });
		console.log(`socketRefServer listening on ws://localhost:${port}`);
	}

	// keep track of the state of each socketRef key we've seen
	const keyStateMap = new Map(); // key => { value, timestamp }

	// Backpressure: if a client's WebSocket send buffer exceeds this many
	// bytes, stop piling on full-value updates and instead coalesce to the
	// LATEST value per key, flushing once the buffer drains. socket-ref values
	// are latest-state, so dropping superseded intermediates is lossless - and
	// this is what stops a slow client (e.g. a busy OBS scene) from building an
	// unbounded server-side backlog that surfaces as gradual chat lag.
	const BACKPRESSURE_BYTES = 1 << 20; // 1 MB
	const PENDING_FLUSH_MS = 50;


	/**
	 * Broadcast a message to all clients
	 * 
	 * @param {String} key - The socketRef state key to broadcast
	 * @param {String} value - The value of the socketRef state
	 * @param {number} timestamp - The timestamp of the socketRef state	
	 * @param {WebSocket} excludeSocket - OPTIONAL; The socket to exclude from the broadcast
	 */
	function sendOrQueue(client, key, message) {

		// buffer backed up? coalesce - remember only the LATEST message for
		// this key and let the drain pump flush it later.
		if (client.bufferedAmount > BACKPRESSURE_BYTES) {
			if (!client._srPending) client._srPending = new Map();
			client._srPending.set(key, message);
			return;
		}

		// healthy: send now, and drop any now-stale pending value for this key
		if (client._srPending) client._srPending.delete(key);
		try { client.send(message); } catch (e) { /* client going away */ }
	}

	function broadcast(key, value, timestamp, excludeSocket = null) {

		const message = JSON.stringify({ key, value, timestamp });
		for (const client of wss.clients) {
			if (client !== excludeSocket && client.readyState === client.OPEN) {
				sendOrQueue(client, key, message);
			}
		}// next client
	}

	// Drain pump: periodically flush each client's coalesced pending updates
	// once its send buffer has room. Bounded, single timer for the server.
	const _drainPump = setInterval(() => {
		for (const client of wss.clients) {
			const pending = client._srPending;
			if (!pending || pending.size === 0) continue;
			if (client.readyState !== client.OPEN) { pending.clear(); continue; }
			for (const [key, message] of pending) {
				if (client.bufferedAmount > BACKPRESSURE_BYTES) break; // re-saturated; keep the rest
				try { client.send(message); } catch (e) { /* ignore */ }
				pending.delete(key);
			}
		}
	}, PENDING_FLUSH_MS);
	if (typeof _drainPump.unref === 'function') _drainPump.unref();
	wss.on('close', () => clearInterval(_drainPump));
	
	
	// handle incoming connections
	wss.on('connection', (socket) => {

		// handle incoming messages
		socket.on('message', (data) => {

			// parse the message
			let msg;
			try {
				msg = JSON.parse(data);
			} catch (err) {
				console.warn('Invalid message received:', data);
				return;
			}

			// break out the message, default type is update
			const { type = 'update', key, value, timestamp } = msg;

			// if we don't have a key, ignore the message
			if (!key) return;

			// handle init messages, when a client connects
			if (type === 'init') {

				// send it's existing value if it has one, otherwise null
				const existing = keyStateMap.get(key);
				socket.send(JSON.stringify({
					type: 'init',
					key,
					value: existing ? existing.value : null,
					timestamp: existing ? existing.timestamp : Date.now()
				}));
				return;
			}

			// handle update messages
			if (type === 'update' && value !== undefined) {
				const now = timestamp || Date.now();
				const existing = keyStateMap.get(key);

				// if we haven't seen this key before, or this update is newer, update the state
				if (!existing || now > existing.timestamp) {

					// save the new state and broadcast it to all clients
					keyStateMap.set(key, { value, timestamp: now });
					broadcast(key, value, now, socket);
				}
			}
		});
	});

	return wss;
	
}
