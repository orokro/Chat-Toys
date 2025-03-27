// socketRefClient.js
import { ref, shallowRef, watch } from 'vue';

const registry = new FinalizationRegistry(({ socketRefState }) => {
	if (socketRefState?.cleanup) socketRefState.cleanup();
});

export function socketRef(keyOrObj, defaultValue) {
	return createSocketRef(ref, keyOrObj, defaultValue);
}

export function socketShallowRef(keyOrObj, defaultValue) {
	return createSocketRef(shallowRef, keyOrObj, defaultValue);
}

function createSocketRef(refType, keyOrObj, initialValue) {
	const options = typeof keyOrObj === 'string' ? { key: keyOrObj } : keyOrObj;
	const key = options.key;
	const ip = options.ip || 'localhost';
	const port = options.port || 3001;
	const state = refType(initialValue);
	const weakState = new WeakRef(state);

	const socketRefState = new SocketRefState(weakState, key, initialValue, ip, port);

	socketRefState.stopWatch = watch(state, (newVal) => {
		if (socketRefState.ready) {
			socketRefState.write(newVal);
		}
	});

	registry.register(state, { socketRefState });

	return state;
}

class SocketRefState {
	constructor(weakState, key, defaultValue, ip, port) {
		this.weakState = weakState;
		this.key = key;
		this.defaultValue = defaultValue;
		this.timestamp = 0;
		this.url = `ws://${ip}:${port}`;
		this.stopWatch = null;
		this.ready = false;
		this.connect();
	}

	connect() {
		this.socket = new WebSocket(this.url);

		this.socket.onopen = () => {
			this.socket.send(JSON.stringify({
				type: 'init',
				key: this.key
			}));
		};

		this.socket.onmessage = (event) => {
			const msg = JSON.parse(event.data);
			if (msg.key !== this.key) return;

			const state = this.weakState.deref();
			if (!state) return;

			// Handle init response
			if (msg.type === 'init') {
				this.timestamp = msg.timestamp || Date.now();
				state.value = msg.value;
				this.ready = true;
				return;
			}

			// Normal update
			if (msg.timestamp <= this.timestamp) return;

			this.timestamp = msg.timestamp;
			state.value = msg.value;
		};

		this.socket.onclose = () => {
			this.ready = false;
			setTimeout(() => this.connect(), 1000);
		};

		this.socket.onerror = () => {
			this.socket.close();
		};
	}

	write(newValue) {
		this.timestamp = Date.now();
		if (this.socket && this.socket.readyState === WebSocket.OPEN) {
			this.socket.send(JSON.stringify({
				type: 'update',
				key: this.key,
				value: newValue,
				timestamp: this.timestamp
			}));
		}
	}

	cleanup() {
		if (this.stopWatch) {
			this.stopWatch();
			this.stopWatch = null;
		}
		if (this.socket) {
			this.socket.close();
			this.socket = null;
		}
	}
}
