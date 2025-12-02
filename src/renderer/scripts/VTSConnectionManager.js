/*
	VTSConnectionManager.js
	-----------------------

	Handles connecting to the VTube Studio WebSocket API from the renderer,
	authenticates the plugin, and exposes a small abstraction layer for:

	- Connection state (enabled, port, status message, logs)
	- Event bus (onConnect / onDisconnect / onModelMoved)
	- Spawning / moving / destroying items (VTSItem wrapper)
	- Loading assets from the existing AssetManager by assetId and piping
	  them into VTS via ItemLoadRequest (using customDataBase64).
*/

/* eslint-disable no-console */

// vue
import { ref, shallowRef, watch } from 'vue';
import { chromeRef, chromeShallowRef } from './chromeRef';

/**
 * Small helper to cap an array’s length.
 * 
 * @param {Array<any>} arr 
 * @param {number} max 
 * @returns {Array<any>}
 */
function cappedPush(arr, item, max = 200) {
	const next = arr.slice();
	next.push(item);
	if (next.length > max)
		next.shift();
	return next;
}


/**
 * Wrapper for a single VTS item loaded into the scene.
 * 
 * This does not talk to VTS directly — it delegates back to the
 * owning VTSConnectionManager, so it shares the same socket / auth.
 */
export class VTSItem {

	/**
	 * @param {VTSConnectionManager} manager 
	 * @param {string} instanceId - VTS item instanceID
	 * @param {string} fileName   - VTS internal filename
	 * @param {Object} [transform]
	 * @param {number} [transform.positionX]
	 * @param {number} [transform.positionY]
	 * @param {number} [transform.size]
	 * @param {number} [transform.rotation]
	 * @param {boolean} [transform.flipped]
	 */
	constructor(manager, instanceId, fileName, transform = {}) {

		/** @type {VTSConnectionManager} */
		this.manager = manager;

		/** @type {string} */
		this.instanceId = instanceId;

		/** @type {string} */
		this.fileName = fileName;

		/** @type {boolean} */
		this.deleted = false;

		// last known transform
		this.positionX = transform.positionX ?? 0;
		this.positionY = transform.positionY ?? 0;
		this.size = transform.size ?? 0.33;
		this.rotation = transform.rotation ?? 0;
		this.flipped = transform.flipped ?? false;
	}

	/**
	 * True if this item is still “live” in VTS and our manager is authenticated.
	 * 
	 * @returns {boolean}
	 */
	isLive() {
		return !this.deleted && this.manager && this.manager.isReady();
	}

	/**
	 * Move/animate this item using ItemMoveRequest.
	 * 
	 * @param {Object} opts
	 * @param {number} [opts.positionX]
	 * @param {number} [opts.positionY]
	 * @param {number} [opts.size]
	 * @param {number} [opts.rotation]
	 * @param {boolean} [opts.flipped]
	 * @param {number} [opts.timeInSeconds] - 0 = instant
	 * @param {string} [opts.fadeMode] - "linear" | "easeIn" | "easeOut" | ...
	 * @param {boolean} [opts.userCanStop]
	 * @returns {Promise<boolean>} - true if VTS said success, false otherwise
	 */
	async move(opts = {}) {

		// if user deleted in VTS or connection is gone, do nothing
		if (!this.isLive())
			return false;

		// update local transform snapshot
		if (typeof opts.positionX === 'number')
            this.positionX = opts.positionX;
		if (typeof opts.positionY === 'number')
            this.positionY = opts.positionY;
		if (typeof opts.size === 'number')
            this.size = opts.size;
		if (typeof opts.rotation === 'number')
            this.rotation = opts.rotation;
		if (typeof opts.flipped === 'boolean')
			this.flipped = opts.flipped;

		const timeInSeconds = typeof opts.timeInSeconds === 'number' ? opts.timeInSeconds : 0;
		const fadeMode = opts.fadeMode || 'linear';
		const userCanStop = typeof opts.userCanStop === 'boolean' ? opts.userCanStop : true;

		const payload = {
			itemsToMove: [
				{
					itemInstanceID: this.instanceId,
					timeInSeconds,
					fadeMode,
					positionX: this.positionX,
					positionY: this.positionY,
					size: this.size,
					rotation: this.rotation,
					order: -1000,			// -1000 = “don’t change order”
					setFlip: true,
					flip: this.flipped,
					userCanStop
				}
			]
		};

		try {
			const res = await this.manager._send('ItemMoveRequest', payload);
			if (!res || !Array.isArray(res.movedItems))
				return false;

			const info = res.movedItems.find(i => i.itemInstanceID === this.instanceId);
			if (!info)
				return false;

			if (info.success) {
				return true;
			}

			// If VTS says this instance is gone, mark deleted.
			if (typeof info.errorID === 'number' && info.errorID !== -1) {
				this.deleted = true;
				this.manager._handleExternalItemDelete(this.instanceId);
			}

			return false;

		} catch (err) {
			console.warn('[VTSItem.move] Failed to move item', err);
			return false;
		}
	}

	/**
	 * Convenience wrapper: just set position, keep other properties.
	 */
	async setPosition(x, y, timeInSeconds = 0) {
		return this.move({ positionX: x, positionY: y, timeInSeconds });
	}

	/**
	 * Convenience wrapper: set size.
	 */
	async setSize(size, timeInSeconds = 0) {
		return this.move({ size, timeInSeconds });
	}

	/**
	 * Convenience wrapper: set rotation (degrees).
	 */
	async setRotation(rotation, timeInSeconds = 0) {
		return this.move({ rotation, timeInSeconds });
	}

	/**
	 * Destroy this item instance in VTS via ItemUnloadRequest.
	 * 
	 * @returns {Promise<boolean>}
	 */
	async destroy() {

		if (!this.isLive())
			return false;

		const payload = {
			unloadAllInScene: false,
			unloadAllLoadedByThisPlugin: false,
			allowUnloadingItemsLoadedByUserOrOtherPlugins: true,
			instanceIDs: [this.instanceId],
			fileNames: []
		};

		try {
			const res = await this.manager._send('ItemUnloadRequest', payload);
			if (!res || !Array.isArray(res.unloadedItems))
				return false;

			const info = res.unloadedItems.find(i => i.instanceID === this.instanceId);
			if (!info)
				return false;

			// Mark deleted locally & tell manager to clean up the registry.
			this.deleted = true;
			this.manager._handleExternalItemDelete(this.instanceId);

			return true;

		} catch (err) {
			console.warn('[VTSItem.destroy] Failed to unload item', err);
			return false;
		}
	}
}


/**
 * Manages the connection to VTube Studio and exposes:
 * 
 * - Connection state + auto-reconnect
 * - Authentication (token flow + auth)
 * - Event subscriptions (ModelMovedEvent)
 * - Item utilities (spawn/move/unload)
 * - Logs for debugging, consumable in UI
 */
export class VTSConnectionManager {

	/**
	 * @param {ChatToysApp} ctApp - main app instance
	 */
	constructor(ctApp) {

		// save reference to main app
		this.ctApp = ctApp;

		// -----------------------
		// Config / UI-facing refs
		// -----------------------

		// Whether VTS integrations are enabled at all
		this.enabled = chromeRef('vts_enabled', false);

		// Port VTS is listening on (ws://localhost:PORT)
		this.port = chromeRef('vts_port', 8001);

		// User-configured path to StreamingAssets (not strictly required
		// when using customDataBase64, but handy to have).
		this.streamingAssetsPath = chromeRef('vts_streaming_assets_path', '');

		// Simple “connected?” light for UI
		this.isConnected = ref(false);

		// true after successful AuthenticationRequest
		this.isAuthenticated = ref(false);

		// Human-readable status line for UI
		this.statusMessage = ref('VTS connection disabled');

		// Rolling log for the VTS tab (array of {time, level, message})
		this.logs = chromeShallowRef('vts_logs', []);

		// -----------------------
		// Internal connection state
		// -----------------------

		/** @type {WebSocket|null} */
		this._ws = null;

		this._currentRequestId = 0;
		/** @type {Map<string, {resolve:Function,reject:Function,messageType:string}>} */
		this._pendingRequests = new Map();

		// reconnect management
		this._reconnectDelayMs = 2000;
		this._maxReconnectDelayMs = 30000;
		this._reconnectTimerId = null;

		// Stored auth token
		this._authToken = chromeRef('vts_auth_token', null);

		// Plugin metadata shown to user in VTS popup
		this._pluginName = 'Chat Toys';
		this._pluginDeveloper = 'Chat Toys';

		// Registry of currently spawned items we know about
		/** @type {Map<string, VTSItem>} */
		this._items = new Map();

		// Simple event bus
		this._connectListeners = new Set();
		this._disconnectListeners = new Set();
		this._modelMovedListeners = new Set();

		// for debug in dev tools
		if (typeof window !== 'undefined')
			window.vtsConnMgr = this;

		// -----------------------
		// Reactivity wiring
		// -----------------------

		// Whenever enabled flips, connect / disconnect accordingly.
		watch(this.enabled, (val) => {
			if (val) {
				this._log('info', 'VTS integration enabled, connecting…');
				this._connect();
			} else {
				this._log('info', 'VTS integration disabled, closing connection…');
				this._teardownConnection('disabledByUser', false);
			}
		}, { immediate: true });

		// If port changes while enabled, reconnect on the new port.
		watch(this.port, () => {
			if (!this.enabled.value)
				return;
			this._log('info', `Port changed to ${this.port.value}, reconnecting…`);
			this._teardownConnection('portChanged', false);
			this._connect();
		});
	}

	// --------------------------------------------------
	// Public API
	// --------------------------------------------------

	/**
	 * True when socket is open AND session authenticated.
	 * 
	 * @returns {boolean}
	 */
	isReady() {
		return this.isConnected.value && this.isAuthenticated.value;
	}

	/**
	 * Subscribe to “connected” events.
	 * 
	 * @param {Function} cb 
	 */
	onConnect(cb) {
		this._connectListeners.add(cb);
	}

	/**
	 * Subscribe to “disconnected” events.
	 * 
	 * @param {Function} cb 
	 */
	onDisconnect(cb) {
		this._disconnectListeners.add(cb);
	}

	/**
	 * Subscribe to ModelMovedEvent.
	 * 
	 * @param {(payload: {
	 *   modelID: string,
	 *   positionX: number,
	 *   positionY: number,
	 *   scale: number,
	 *   rotation: number
	 * }) => void} cb 
	 */
	onModelMoved(cb) {
		this._modelMovedListeners.add(cb);
	}

	/**
	 * Unsubscribe from ModelMovedEvent.
	 * 
	 * @param {Function} cb 
	 */
	offModelMoved(cb) {
		this._modelMovedListeners.delete(cb);
	}

	/**
	 * Manually force a reconnect now.
	 */
	forceReconnect() {
		this._log('info', 'Manual reconnect requested.');
		this._teardownConnection('manualReconnect', false);
		if (this.enabled.value)
			this._connect();
	}

	/**
	 * Clear logs (handy for a “clear” button in UI).
	 */
	clearLogs() {
		this.logs.value = [];
	}

	/**
	 * Spawn an item into the scene from one of our assets by ID.
	 * 
	 * This:
	 * - fetches the asset via AssetManager.getFile(id)
	 * - converts to base64
	 * - sends ItemLoadRequest with customDataBase64
	 * - returns a VTSItem instance on success
	 * 
	 * @param {string} assetId - ID used by AssetManager
	 * @param {Object} [options]
	 * @param {number} [options.positionX]
	 * @param {number} [options.positionY]
	 * @param {number} [options.size]
	 * @param {number} [options.rotation]
	 * @param {number} [options.fadeTime]
	 * @param {number} [options.order]
	 * @param {boolean} [options.flipped]
	 * @param {boolean} [options.locked]
	 * @returns {Promise<VTSItem|null>}
	 */
	async spawnItemFromAsset(assetId, options = {}) {

		if (!this.isReady()) {
			this._log('warn', 'spawnItemFromAsset called while VTS not ready.');
			return null;
		}

		if (!this.ctApp || !this.ctApp.assetManager) {
			this._log('error', 'spawnItemFromAsset: AssetManager not available on ChatToysApp.');
			return null;
		}

		try {
			// ask AssetManager for a File/Blob for this asset
			const file = await this.ctApp.assetManager.getFile(assetId);
			if (!file) {
				this._log('error', `spawnItemFromAsset: No file found for assetId=${assetId}`);
				return null;
			}

			// convert the file into base64 so we can feed it as customDataBase64
			const base64 = await this._fileToBase64(file);

			const positionX = typeof options.positionX === 'number' ? options.positionX : 0;
			const positionY = typeof options.positionY === 'number' ? options.positionY : 0;
			const size = typeof options.size === 'number' ? options.size : 0.33;
			const rotation = typeof options.rotation === 'number' ? options.rotation : 0;
			const fadeTime = typeof options.fadeTime === 'number' ? options.fadeTime : 0.25;
			const order = typeof options.order === 'number' ? options.order : 0;
			const flipped = !!options.flipped;
			const locked = !!options.locked;

			const data = {
				fileName: file.name,
				positionX,
				positionY,
				size,
				rotation,
				fadeTime,
				order,
				failIfOrderTaken: false,
				smoothing: 0,
				censored: false,
				flipped,
				locked,
				unloadWhenPluginDisconnects: true,
				customDataBase64: base64,
				customDataAskUserFirst: true,
				customDataSkipAskingUserIfWhitelisted: true,
				customDataAskTimer: -1
			};

			const res = await this._send('ItemLoadRequest', data);
			if (!res || !res.instanceID) {
				this._log('error', 'ItemLoadRequest returned no instanceID.');
				return null;
			}

			const item = new VTSItem(this, res.instanceID, res.fileName || file.name, {
				positionX,
				positionY,
				size,
				rotation,
				flipped
			});

			this._items.set(item.instanceId, item);
			this._log('info', `Spawned VTS item "${file.name}" as instanceID=${item.instanceId}`);

			return item;

		} catch (err) {
			this._log('error', `spawnItemFromAsset failed: ${err?.message || err}`);
			return null;
		}
	}

	/**
	 * Get an item by instanceId if we know about it.
	 * 
	 * @param {string} instanceId 
	 * @returns {VTSItem|null}
	 */
	getItem(instanceId) {
		return this._items.get(instanceId) || null;
	}

	/**
	 * Remove all items we spawned in this session (best-effort helper).
	 * 
	 * @returns {Promise<void>}
	 */
	async unloadAllItemsLoadedByThisPlugin() {

		if (!this.isReady())
			return;

		try {
			const data = {
				unloadAllInScene: false,
				unloadAllLoadedByThisPlugin: true,
				allowUnloadingItemsLoadedByUserOrOtherPlugins: false,
				instanceIDs: [],
				fileNames: []
			};

			await this._send('ItemUnloadRequest', data);
			for (const item of this._items.values())
				item.deleted = true;
			this._items.clear();
			this._log('info', 'Requested unload of all items loaded by this plugin.');

		} catch (err) {
			this._log('error', `unloadAllItemsLoadedByThisPlugin failed: ${err?.message || err}`);
		}
	}

	// --------------------------------------------------
	// Connection + auth internals
	// --------------------------------------------------

	/**
	 * Internal: log into the rolling logs array.
	 * 
	 * @param {"info"|"warn"|"error"} level 
	 * @param {string} message 
	 */
	_log(level, message) {
		const time = new Date().toISOString();
		console[level === 'error' ? 'error' : 'log'](`[VTS][${level}] ${message}`);
		this.logs.value = cappedPush(this.logs.value, { time, level, message }, 300);
		this.statusMessage.value = message;
	}

	/**
	 * Build next requestID for VTS messages.
	 * 
	 * @returns {string}
	 */
	_nextRequestId() {
		this._currentRequestId++;
		return `ctVTS-${Date.now()}-${this._currentRequestId}`;
	}

	/**
	 * Connect to the configured VTS port.
	 */
	_connect() {

		if (!this.enabled.value) {
			this._log('info', 'VTS integration disabled, skipping connect().');
			return;
		}

		if (this._ws && (this._ws.readyState === WebSocket.OPEN || this._ws.readyState === WebSocket.CONNECTING)) {
			this._log('info', 'VTS websocket already open/connecting, skipping new connect.');
			return;
		}

		const url = `ws://127.0.0.1:${this.port.value}/`;
		this._log('info', `Connecting to VTS on ${url} …`);

		try {
			this._ws = new WebSocket(url);

			this._ws.addEventListener('open', this._handleOpen);
			this._ws.addEventListener('close', this._handleClose);
			this._ws.addEventListener('error', this._handleError);
			this._ws.addEventListener('message', this._handleMessage);

		} catch (err) {
			this._log('error', `Failed to construct WebSocket to VTS: ${err?.message || err}`);
			this._scheduleReconnect();
		}
	}

	/**
	 * Cleanly tear down any existing websocket and pending requests.
	 * 
	 * @param {"disabledByUser"|"portChanged"|"manualReconnect"|"socketClosed"|"error"} reason 
	 * @param {boolean} shouldScheduleReconnect 
	 */
	_teardownConnection(reason, shouldScheduleReconnect = true) {

		this._log('info', `Tearing down VTS connection (reason=${reason})`);
		this.isConnected.value = false;
		this.isAuthenticated.value = false;

		// clear reconnect timer
		if (this._reconnectTimerId != null) {
			window.clearElectronTimeout?.(this._reconnectTimerId) || clearTimeout(this._reconnectTimerId);
			this._reconnectTimerId = null;
		}

		// close websocket + listeners
		if (this._ws) {
			try {
				this._ws.removeEventListener('open', this._handleOpen);
				this._ws.removeEventListener('close', this._handleClose);
				this._ws.removeEventListener('error', this._handleError);
				this._ws.removeEventListener('message', this._handleMessage);
				this._ws.close();
			} catch (err) {
				console.warn('[VTS] Error while closing websocket:', err);
			}
			this._ws = null;
		}

		// reject any pending requests
		for (const [, pending] of this._pendingRequests) {
			try {
				pending.reject(new Error('VTS connection closed.'));
			} catch {/* ignore */}
		}
		this._pendingRequests.clear();

		// notify listeners
		this._emitDisconnect();

		if (shouldScheduleReconnect && this.enabled.value)
			this._scheduleReconnect();
	}

	/**
	 * Exponential backoff reconnect scheduling.
	 */
	_scheduleReconnect() {

		if (!this.enabled.value)
			return;

		if (this._reconnectTimerId != null)
			return; // already scheduled

		const delay = this._reconnectDelayMs;
		this._log('info', `Reconnecting to VTS in ${(delay / 1000).toFixed(1)}s…`);

		const timer = window.setElectronTimeout
			? window.setElectronTimeout(() => {
				this._reconnectTimerId = null;
				this._connect();
			}, delay)
			: setTimeout(() => {
				this._reconnectTimerId = null;
				this._connect();
			}, delay);

		this._reconnectTimerId = timer;

		// double delay next time, up to max
		this._reconnectDelayMs = Math.min(this._reconnectDelayMs * 2, this._maxReconnectDelayMs);
	}

	/**
	 * Handle successful WebSocket open.
	 */
	_handleOpen = () => {
		this._log('info', 'Connected to VTS WebSocket.');
		this.isConnected.value = true;
		this._reconnectDelayMs = 2000; // reset backoff
		this._emitConnect();
		this._beginAuthFlow();
	};

	/**
	 * Handle socket close.
	 */
	_handleClose = () => {
		this._log('warn', 'VTS WebSocket closed.');
		this._teardownConnection('socketClosed', true);
	};

	/**
	 * Handle low-level socket error.
	 */
	_handleError = (event) => {
		this._log('error', `VTS WebSocket error: ${event?.message || 'unknown error'}`);
		// The close handler will do the teardown / reconnect.
	};

	/**
	 * Handle all incoming messages from VTS.
	 * 
	 * @param {MessageEvent} event 
	 */
	_handleMessage = (event) => {

		let msg;
		try {
			msg = JSON.parse(event.data);
		} catch (err) {
			this._log('warn', `Received non-JSON message from VTS: ${event.data}`);
			return;
		}

		const { messageType, requestID, data } = msg;

		// First handle responses matching a previous requestID.
		if (requestID && this._pendingRequests.has(requestID)) {
			const pending = this._pendingRequests.get(requestID);
			this._pendingRequests.delete(requestID);

			// APIError is a special global error message type
			if (messageType === 'APIError') {
				const errorId = data?.errorID;
				const reason = data?.message || 'Unknown APIError';
				const wrapped = new Error(`VTS APIError (id=${errorId}): ${reason}`);
				this._log('error', wrapped.message);
				pending.reject(wrapped);
				return;
			}

			// normal response
			pending.resolve(data || {});
			return;
		}

		// Otherwise, handle async messages (events) here.
		switch (messageType) {
			case 'ModelMovedEvent':
				this._handleModelMovedEvent(data);
				break;

			// (Optional) other events can be added here as needed.
			default:
				// spammy to log every random event, so only debug if needed
				break;
		}
	};

	/**
	 * Send a generic request to VTS and return the decoded `data` payload.
	 * 
	 * @param {string} messageType - e.g. "APIStateRequest"
	 * @param {Object} [data={}]
	 * @returns {Promise<any>}
	 */
	_send(messageType, data = {}) {

		return new Promise((resolve, reject) => {

			if (!this._ws || this._ws.readyState !== WebSocket.OPEN) {
				return reject(new Error('VTS WebSocket is not open.'));
			}

			const requestID = this._nextRequestId();
			const payload = {
				apiName: 'VTubeStudioPublicAPI',
				apiVersion: '1.0',
				requestID,
				messageType,
				data
			};

			this._pendingRequests.set(requestID, { resolve, reject, messageType });

			try {
				this._ws.send(JSON.stringify(payload));
			} catch (err) {
				this._pendingRequests.delete(requestID);
				reject(err);
			}
		});
	}

	/**
	 * Kick off the authentication flow:
	 *  - if we already have a token, try AuthenticationRequest
	 *  - otherwise, request a new token (AuthenticationTokenRequest) and then auth
	 */
	async _beginAuthFlow() {

		this.isAuthenticated.value = false;

		try {
			// If we already have a token stored, try to authenticate with it first.
			if (this._authToken.value) {
				this._log('info', 'Authenticating with stored VTS token…');
				await this._send('AuthenticationRequest', {
					pluginName: this._pluginName,
					pluginDeveloper: this._pluginDeveloper,
					authenticationToken: this._authToken.value
				});
				this.isAuthenticated.value = true;
				this._log('info', 'VTS authentication successful.');
				this._onAuthenticated();
				return;
			}

			// No token yet → ask user for permission and get new token.
			this._log('info', 'Requesting new VTS authentication token…');
			const tokenRes = await this._send('AuthenticationTokenRequest', {
				pluginName: this._pluginName,
				pluginDeveloper: this._pluginDeveloper
			});

			const token = tokenRes?.authenticationToken;
			if (!token) {
				this._log('error', 'VTS returned no authenticationToken.');
				return;
			}

			this._authToken.value = token;
			this._log('info', 'Got new VTS token, authenticating session…');

			await this._send('AuthenticationRequest', {
				pluginName: this._pluginName,
				pluginDeveloper: this._pluginDeveloper,
				authenticationToken: token
			});

			this.isAuthenticated.value = true;
			this._log('info', 'VTS authentication successful.');
			this._onAuthenticated();

		} catch (err) {
			this._log('error', `Authentication failed: ${err?.message || err}`);
			// If auth fails because token is bad, clear it so we can re-request next time.
			this._authToken.value = null;
		}
	}

	/**
	 * Called once per connection after successful AuthenticationRequest.
	 * Sets up event subscriptions, etc.
	 */
	async _onAuthenticated() {

		// Subscribe to ModelMovedEvent.
		try {
			await this._send('EventSubscriptionRequest', {
				eventName: 'ModelMovedEvent',
				subscribe: true,
				config: {
					// null/empty config subscribes to all models; this is fine for
					// your use case where you just want current model position.
				}
			});
			this._log('info', 'Subscribed to VTS ModelMovedEvent.');
		} catch (err) {
			this._log('warn', `Failed to subscribe to ModelMovedEvent: ${err?.message || err}`);
		}
	}

	/**
	 * Convert a File/Blob to base64 string (without the data: prefix).
	 * 
	 * @param {Blob} file 
	 * @returns {Promise<string>}
	 */
	_fileToBase64(file) {

		return new Promise((resolve, reject) => {

			const reader = new FileReader();
			reader.onload = () => {
				try {
					const result = reader.result;
					if (typeof result !== 'string')
						return reject(new Error('Unexpected FileReader result.'));

					// result will look like "data:image/png;base64,AAAA..."
					const commaIdx = result.indexOf(',');
					const base64 = commaIdx >= 0 ? result.slice(commaIdx + 1) : result;
					resolve(base64);

				} catch (err) {
					reject(err);
				}
			};
			reader.onerror = () => reject(reader.error || new Error('Failed to read file.'));
			reader.readAsDataURL(file);
		});
	}

	/**
	 * Notify all connect listeners.
	 */
	_emitConnect() {
		for (const cb of this._connectListeners) {
			try {
				cb();
			} catch (err) {
				console.error('[VTSConnectionManager] connect listener error', err);
			}
		}
	}

	/**
	 * Notify all disconnect listeners.
	 */
	_emitDisconnect() {
		for (const cb of this._disconnectListeners) {
			try {
				cb();
			} catch (err) {
				console.error('[VTSConnectionManager] disconnect listener error', err);
			}
		}
	}

	/**
	 * Handle ModelMovedEvent payload from VTS.
	 * 
	 * @param {any} data 
	 */
	_handleModelMovedEvent(data) {

		if (!data)
			return;

		// Try to normalize the event payload. The official docs say the model
		// position lives under data.modelPosition {positionX, positionY, size, rotation}.
		const modelID = data.modelID || data.modelId || null;
		const pos = data.modelPosition || data.position || {};

		const payload = {
			modelID,
			positionX: typeof pos.positionX === 'number' ? pos.positionX : 0,
			positionY: typeof pos.positionY === 'number' ? pos.positionY : 0,
			scale: typeof pos.size === 'number' ? pos.size : 1,
			rotation: typeof pos.rotation === 'number' ? pos.rotation : 0
		};

		for (const cb of this._modelMovedListeners) {
			try {
				cb(payload);
			} catch (err) {
				console.error('[VTSConnectionManager] modelMoved listener error', err);
			}
		}
	}

	/**
	 * Called when we detect (or suspect) that an item was deleted from VTS
	 * outside of our control (e.g. user deleted the item in the VTS UI).
	 * 
	 * @param {string} instanceId 
	 */
	_handleExternalItemDelete(instanceId) {

		const item = this._items.get(instanceId);
		if (!item)
			return;

		item.deleted = true;
		this._items.delete(instanceId);
		this._log('info', `Item instanceID=${instanceId} deleted in VTS (or unloaded).`);
	}
}
