// socketRefClient.js
// Client-side socketRef module (safe for browser usage)

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
	const ip = options.ip || '127.0.0.1';
	const port = options.port || 3001;
	const state = refType(initialValue);
	const weakState = new WeakRef(state);

	const socketRefState = new SocketRefState(weakState, key, initialValue, ip, port);

	socketRefState.stopWatch = watch(state, (newVal) => {
		socketRefState.write(newVal);
	});

	registry.register(state, { socketRefState });

	return state;
}

class SocketRefState {
	constructor(weakState, key, defaultValue, ip, port) {
		this.weakState = weakState;
		this.key = key;
		this.defaultValue = defaultValue;
		this.timestamp = Date.now();
		this.url = `ws://${ip}:${port}`;
		this.stopWatch = null;
		this.connect();
	}

	connect() {
		this.socket = new WebSocket(this.url);
		this.socket.onopen = () => {
			this.sendCurrentValue();
		};

		this.socket.onmessage = (event) => {
			const msg = JSON.parse(event.data);
			if (msg.key !== this.key) return;
			if (msg.timestamp <= this.timestamp) return;

			const state = this.weakState.deref();
			if (!state) return;

			this.timestamp = msg.timestamp;
			state.value = msg.value;
		};

		this.socket.onclose = () => {
			setTimeout(() => this.connect(), 1000);
		};

		this.socket.onerror = () => {
			this.socket.close();
		};
	}

	sendCurrentValue() {
		const state = this.weakState.deref();
		if (!state) return;
		this.socket.send(JSON.stringify({
			key: this.key,
			value: state.value,
		}));
	}

	write(newValue) {
		this.timestamp = Date.now();
		if (this.socket && this.socket.readyState === WebSocket.OPEN) {
			this.socket.send(JSON.stringify({
				key: this.key,
				value: newValue,
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
