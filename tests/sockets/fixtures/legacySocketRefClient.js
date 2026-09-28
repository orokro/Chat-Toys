/*
	socketRefClient.js
	------------------

	provides exports for:
	- socketRef
	- socketShallowRef

	Which are similar to ref and shallowRef, but are synced with a server via a WebSocket.
*/

// vue
import { ref, shallowRef, watch, computed } from 'vue';

// well provide a global port here, if sockets don't specific their own port
let globalPortSetting = 3001;

// setting to show connection for debugging port
let showConnectionLogs = false;

/**
 * Sets the global port number to use when sockets don't specify their port number
 * 
 * @param {Number} portNumber - port number to use for the global port number
 */
export function setGlobalSocketRefPort(portNumber){
	globalPortSetting = portNumber;
}


/**
 * Enable or disable connection logs for debugging
 * 
 * @param {Boolean} enable - optional, if true, enable connection logs
 */
export function enableConnectionLogs(enable=true){
	showConnectionLogs = enable;
}


// FinalizationRegistry for cleanup when the ref is no longer used
const registry = new FinalizationRegistry(({ socketRefState }) => {
	if (socketRefState?.cleanup) socketRefState.cleanup();
});


/**
 * Get a vue ref that is synced with a server via a WebSocket
 * 
 * @param {String} keyOrObj - The key for the socketRef, or an object with options
 * @param {*} defaultValue - The default value for the socketRef
 * @returns {ref} - A ref that is synced with a server via a WebSocket
 */
export function socketRef(keyOrObj, defaultValue) {
	return createSocketRef(ref, keyOrObj, defaultValue, false);
}


/**
 * Get a vue shallowRef that is synced with a server via a WebSocket
 * 
 * @param {String} keyOrObj - The key for the socketRef, or an object with options
 * @param {*} defaultValue - The default value for the socketRef
 * @returns {shallowRef} - A shallowRef that is synced with a server via a WebSocket
 */
export function socketShallowRef(keyOrObj, defaultValue) {
	return createSocketRef(shallowRef, keyOrObj, defaultValue, false);
}


/**
 * Get a vue ref that is synced with a server via a WebSocket
 * 
 * @param {String} keyOrObj - The key for the socketRef, or an object with options
 * @param {*} defaultValue - The default value for the socketRef
 * @returns {ref} - A ref that is synced with a server via a WebSocket
 */
export function socketRefReadOnly(keyOrObj, defaultValue) {
	return createSocketRef(ref, keyOrObj, defaultValue, true);
}


/**
 * Get a vue shallowRef that is synced with a server via a WebSocket
 * 
 * @param {String} keyOrObj - The key for the socketRef, or an object with options
 * @param {*} defaultValue - The default value for the socketRef
 * @returns {shallowRef} - A shallowRef that is synced with a server via a WebSocket
 */
export function socketShallowRefReadOnly(keyOrObj, defaultValue) {
	return createSocketRef(shallowRef, keyOrObj, defaultValue, true);
}


/**
 * Get a vue ref that is synced with a server via a WebSocket, async version waiting for connection
 * 
 * @param {String} keyOrObj - The key for the socketRef, or an object with options
 * @param {*} defaultValue - The default value for the socketRef
 * @returns {ref} - A ref that is synced with a server via a WebSocket
 */
export function socketRefAsync(keyOrObj, defaultValue) {
	return new Promise((resolve, reject) => {
		const newRef = createSocketRef(ref, keyOrObj, defaultValue, false, () => {
			resolve(newRef);
		});
	});
}


/**
 * Get a vue shallowRef that is synced with a server via a WebSocket, async version waiting for connection
 * 
 * @param {String} keyOrObj - The key for the socketRef, or an object with options
 * @param {*} defaultValue - The default value for the socketRef
 * @returns {shallowRef} - A shallowRef that is synced with a server via a WebSocket
 */
export function socketShallowRefAsync(keyOrObj, defaultValue) {
	return new Promise((resolve, reject) => {
		const newRef = createSocketRef(shallowRef, keyOrObj, defaultValue, false, () => {
			resolve(newRef);
		});
	});
}


/**
 * Create a ref that is synced with a server via a WebSocket
 * 
 * @param {ref|shallowRef} refType - The type of ref to create, ref or shallowRef
 * @param {String|Object} keyOrObj - The key for the socketRef, or an object with options
 * @param {*} initialValue - The default value for the socketRef
 * @param {Boolean} readyOnly - OPTIONAL; If true, the ref will be read-only
 * @param {Function} onInitialConnect - OPTIONAL; A callback to run when the socket connects
 * @returns {ref|shallowRef} - A ref that is synced with a server via a WebSocket
 */
function createSocketRef(refType, keyOrObj, initialValue, readyOnly, onInitialConnect) {

	// if we got a string for our second param, wrap it into an options object
	const options = typeof keyOrObj === 'string' ? { key: keyOrObj } : keyOrObj;

	// get options or defaults
	const key = options.key;
	const ip = options.ip || 'localhost';
	const port = options.port || undefined;

	// create the ref that will be synced with the server
	const state = refType(initialValue);

	// create a weak ref to the state so we can clean up when it's no longer used
	const weakState = new WeakRef(state);

	// the rest of the websocket syncing logic will be handled in the SocketRefState class
	// we pass in weakState, because the only valid strong reference to the state is the ref itself
	// that this function returns. This way, we can clean up the state when the ref is no longer used.
	const socketRefState = new SocketRefState(weakState, key, initialValue, ip, port, readyOnly, onInitialConnect);

	// we're going to return state, which is a ref. This means outside code can change it's .value.
	// thus, we will watch the state ref before we return it, so we can call the socket code to update the server
	socketRefState.stopWatch = watch(state, (newVal, oldValue) => {

		if (socketRefState.isProcessingSocketMessage) return;

		if (socketRefState.ready) {
			socketRefState.write(newVal);
		}
	}, { flush: 'sync' });

	// register the state with the finalization registry, so we can clean up when the ref is no longer used
	registry.register(state, { socketRefState });

	// only return this
	if(readyOnly){
		return computed(() => weakState.deref().value);
	}

	// return the ref
	return state;
}


/**
 * Class to handle the WebSocket syncing for a socketRef
 */
class SocketRefState {

	/**
	 * Create a new SocketRefState
	 * 
	 * @param {WeakRef} weakState - WeakRef to the state ref
	 * @param {String} key - The key used for syncing with the server
	 * @param {*} defaultValue - The default value for the socketRef
	 * @param {String} ip - The IP address of the server
	 * @param {String|Number|null} port - The port of the server - or null if not set
	 * @param {Boolean} readyOnly - True if the ref is read-only
	 * @param {Function} onInitialConnect - A callback to run when the socket connects
	 */
	constructor(weakState, key, defaultValue, ip, port, readyOnly, onInitialConnect) {

		// store the weakState, key, defaultValue, and timestamp
		this.weakState = weakState;
		this.key = key;
		this.defaultValue = defaultValue;
		this.readyOnly = readyOnly;
		this.onInitialConnect = onInitialConnect;

		// true if we have a pending write while the socket is not ready
		this.pendingWrite = null;

		// for writing, we'll need a timestamp
		this.timestamp = 0;

		// Rate limiting
		this.updatesLastSecond = 0;
		this.lastRateLimitReset = Date.now();
		this.rateLimitedUntil = 0;

		// flag to prevent infinite loops when updating from socket
		this.isProcessingSocketMessage = false;

		// save connection details
		this.ip = ip;
		this.port = (port==null || port==undefined) ? undefined : port;

		// this will become a function that stops the watchers in the socketRef or socketShallowRef closure
		// this will be set after construction in said closure. See createSocketRef above.
		this.stopWatch = null;

		// create a flag for when the socket is ready
		this.ready = false;

		// connect to the server
		this.connect();
	}


	/**
	 * Connect to the server via WebSocket
	 */
	connect() {
		
		// convert ip and port to a WebSocket URL
		const port = this.port || globalPortSetting;
		this.url = `ws://${this.ip}:${port}`;

		if(showConnectionLogs)
			console.log('SocketRef: connecting to', this.url);

		// create a new websocket with our url
		this.socket = new WebSocket(this.url);

		// when we connect send the init message w/ our key
		this.socket.onopen = () => {

			if(showConnectionLogs)
				console.log('SocketRef: connected to', this.url);

			// send the init message
			this.socket.send(JSON.stringify({
				type: 'init',
				key: this.key
			}));
		};

		// when this socket receives a message, parse it and update the state
		this.socket.onmessage = (event) => {

			// parse the message
			const msg = JSON.parse(event.data);

			// if the key doesn't match, ignore the message
			if (msg.key !== this.key)
				return;

			// get the vue ref state
			const state = this.weakState.deref();
			if (!state)
				return;

			// start ignoring changes from the socket so we don't loop
			this.isProcessingSocketMessage = true;

			try {
				// Handle init response, which includes the current value from the server
				if (msg.type === 'init') {

					const serverTimestamp = msg.timestamp || 0;
					const serverValue = msg.value;

					const state = this.weakState.deref();
					if (!state) {
						// if we have a callback for the initial connect, run it
						if (this.onInitialConnect)
							this.onInitialConnect(false);
						return;
					}

					// Compare pending write vs server timestamp
					if (serverValue === null) {

						// Server has no value for this key
						if (this.pendingWrite) {
							state.value = this.pendingWrite.value;
							this.write(this.pendingWrite.value, this.pendingWrite.timestamp);
						} else {
							state.value = this.defaultValue;
							this.write(this.defaultValue);
						}
						this.timestamp = Date.now(); // mark this client as source of truth

					} else {

						// Server has value
						if (this.pendingWrite && this.pendingWrite.timestamp > serverTimestamp) {
							state.value = this.pendingWrite.value;
							this.write(this.pendingWrite.value, this.pendingWrite.timestamp);
							this.timestamp = this.pendingWrite.timestamp;
						} else {
							state.value = serverValue;
							this.timestamp = serverTimestamp;
						}
					}

					this.pendingWrite = null; // clear pending write
					this.ready = true;

					// if we have a callback for the initial connect, run it
					if (this.onInitialConnect)
						this.onInitialConnect();
					return;
				}

				// Normal update
				if (msg.timestamp <= this.timestamp)
					return;

				// update the timestamp and the state value
				// because we are updating the vue state, it will be reactive for the user
				this.timestamp = msg.timestamp;
				state.value = msg.value;

			} finally {
				this.isProcessingSocketMessage = false;
			}
		};

		// if the socket closes, try to reconnect
		this.socket.onclose = () => {
			this.ready = false;
			setTimeout(() => this.connect(), 1000);
			if(showConnectionLogs)
				console.log('SocketRef: disconnected from', this.url);
		};

		// if there's an error, close the socket
		this.socket.onerror = () => {
			this.socket.close();
			if(showConnectionLogs)
				console.log('SocketRef: error on', this.url);
		};
	}


	/**
	 * Send value updates to the server
	 * 
	 * @param {*} newValue - The new value to write to the server
	 */
	write(newValue, forceTimestamp = null) {

		// if this is a read-only ref, don't write
		if(this.readyOnly)
			return;

		// Rate Limiting Logic
		const now = Date.now();
		if (now < this.rateLimitedUntil) {
			return;
		}

		// Reset counter if more than 1 second has passed
		if (now - this.lastRateLimitReset > 1000) {
			this.updatesLastSecond = 0;
			this.lastRateLimitReset = now;
		}

		this.updatesLastSecond++;

		if (this.updatesLastSecond > 100) {
			console.warn(`SocketRef: Rate limit exceeded for key "${this.key}". Pausing updates for 1 second.`);
			this.rateLimitedUntil = now + 1000;
			return;
		}
		
		const ts = forceTimestamp || now;
		this.timestamp = ts;

		if (this.socket && this.socket.readyState === WebSocket.OPEN) {
			this.socket.send(JSON.stringify({
				type: 'update',
				key: this.key,
				value: newValue,
				timestamp: ts
			}));

		} else {
			// Track pending write if not yet ready
			this.pendingWrite = { value: newValue, timestamp: ts };
		}
	}


	/**
	 * Cleanup the socket and watchers
	 * 
	 * This should automatically be called when the state ref we created is garbage collected
	 */
	cleanup() {

		// stop the watcher
		if (this.stopWatch) {
			this.stopWatch();
			this.stopWatch = null;
		}

		// close the socket
		if (this.socket) {
			this.socket.close();
			this.socket = null;
		}
	}

}