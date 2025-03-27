// socketRefServer.js
import { WebSocketServer } from 'ws';

export function socketRefServer(options = {}) {
	try {
		const port = options.port || 3001;
		let server = options.server || null;
		let wss;

		if (server) {
			wss = new WebSocketServer({ server });
		} else {
			wss = new WebSocketServer({ port });
			console.log(`✅ socketRefServer listening on ws://localhost:${port}`);
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

				const { type = 'update', key, value, timestamp } = msg;

				if (!key) return;

				if (type === 'init') {
					const existing = keyStateMap.get(key);
					socket.send(JSON.stringify({
						type: 'init',
						key,
						value: existing ? existing.value : null,
						timestamp: existing ? existing.timestamp : Date.now()
					}));
					return;
				}

				if (type === 'update' && value !== undefined) {
					const now = timestamp || Date.now();
					const existing = keyStateMap.get(key);

					if (!existing || now > existing.timestamp) {
						keyStateMap.set(key, { value, timestamp: now });
						broadcast(key, value, now);
					}
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
	} catch (err) {
		console.error(err);
	}
}
