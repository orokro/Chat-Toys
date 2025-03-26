// socketRefServer.js
// Node-only WebSocket server to coordinate socketRef state syncing

import { WebSocketServer } from 'ws';

export function socketRefServer(options = {}) {
	const port = options.port || 3001;
	let server = options.server || null;
	let wss;

	if (server) {
		// Use provided HTTP server
		wss = new WebSocketServer({ server });
	} else {
		// Create a standalone WebSocket server
		try {
			wss = new WebSocketServer({ port });
			console.log(`✅ socketRefServer listening on ws://localhost:${port}`);
		} catch (err) {
			throw new Error(`Unable to start socketRefServer on port ${port}: ${err.message}`);
		}
	}

	const keyStateMap = new Map(); // key => { value, timestamp }

	wss.on('connection', (socket) => {
		socket.on('message', (data) => {
			let msg;
			try {
				msg = JSON.parse(data);
			} catch (err) {
				console.warn('Invalid message received:', data);
				return;
			}

			const { key, value } = msg;
			if (!key || value === undefined) return;

			const now = Date.now();
			const existing = keyStateMap.get(key);

			// If key is new or this value is newer, update and broadcast
			if (!existing || now > existing.timestamp) {
				keyStateMap.set(key, { value, timestamp: now });
				broadcast(key, value, now);
			}
		});
	});

	function broadcast(key, value, timestamp) {
		const message = JSON.stringify({ key, value, timestamp });
		for (const client of wss.clients) {
			if (client.readyState === client.OPEN) {
				client.send(message);
			}
		}
	}

	return wss;
}
