/*
	OBSConnectionManager.js
	-----------------------

	Encapsulates connection logic to OBS WebSocket v5.x from the renderer.

	Features:
	- Persistent settings via chromeRef / chromeShallowRef
	- Endless retry loop while "enabled" is true (with backoff)
	- Clean shutdown when disabled
	- Live / offline detection via StreamStateChanged + GetStreamStatus
	- Simple event bus:
		- 'obs-connected'
		- 'obs-disconnected'
		- 'obs-stream-live'
		- 'obs-stream-offline'
		- 'obs-connection-error'
*/
// vue
import { ref, shallowRef, watch } from 'vue';

// obs / etc
import { OBSWebSocket, EventSubscription } from 'obs-websocket-js';

// our app
import { chromeRef, chromeShallowRef } from "../scripts/chromeRef";

// NOTE: This file assumes the following helpers are available globally or imported:
// - setElectronTimeout(fn, ms)
// - clearElectronTimeout(id)

/**
 * @typedef {Object} OBSConnectionManagerOptions
 * @property {string} [storagePrefix] Optional key prefix for persisted settings
 */

/**
 * OBSConnectionManager
 *
 * Manages a resilient connection to OBS over obs-websocket v5.x.
 */
export class OBSConnectionManager {

	/**
	 * @param {Object} chatToysApp - Root ChatToysApp instance
	 * @param {OBSConnectionManagerOptions} [options]
	 */
	constructor(chatToysApp, options) {

		/** @type {Object} */
		this.app = chatToysApp;

		/** @type {string} */
		this.storagePrefix = (options && options.storagePrefix) || 'chattoys.obs.';

		/*
			Persistent settings (UI fields)
			-------------------------------
			These are wrapped with chromeRef so changing them in the UI
			automatically saves to (and loads from) storage.
		*/

		// true if our OBS connection feature is enabled
		this.enabled = chromeRef(this.storagePrefix + 'enabled', false);

		// The port number for OBS WebSocket connection
		this.port = chromeRef(this.storagePrefix + 'port', 4455);

		// The password for OBS WebSocket connection
		this.password = chromeRef(this.storagePrefix + 'password', '');

		// Auto-refresh browser sources on connect
		this.enableAutoRefresh = chromeRef(this.storagePrefix + 'enableAutoRefresh', true);

		
		/*
			UI / reactive state
			-------------------
			Bind these directly into your Vue components for
			status lights, labels, etc.
		*/

		/** @type {import('vue').Ref<boolean>} */
		this.isConnected = ref(false);

		/** @type {import('vue').Ref<boolean>} */
		this.isStreaming = ref(false);

		/**
		 * Connection status:
		 * 'disabled' | 'connecting' | 'connected' | 'disconnected' | 'error'
		 * @type {import('vue').Ref<string>}
		 */
		this.connectionStatus = ref('disabled');

		/**
		 * Streaming status:
		 * 'disabled' | 'unknown' | 'offline' | 'live'
		 * @type {import('vue').Ref<string>}
		 */
		this.streamingStatus = ref('disabled');

		/**
		 * Human-readable status messages for the UI
		 * @type {import('vue').Ref<string>}
		 */
		this.statusMessage = ref('');

		/**
		 * Cache of the OBS scene/source hierarchy, rebuilt on every connect.
		 * Shape: { scenes: string[], trees: { [sceneName]: TreeNode[] }, allNames: string[] }
		 * where TreeNode = { name, id, isGroup, isScene, kind, children: TreeNode[]|null }.
		 * Powers the Tosser's source picker, "missing source" warnings, and the
		 * runtime collider resolver.
		 * @type {import('vue').ShallowRef<Object>}
		 */
		this.sourceCache = shallowRef({ scenes: [], trees: {}, allNames: [] });

		/*
			Internal state
		*/

		// reference to our obs-websocket-js instance
		this._obs = new OBSWebSocket();

		// true while a connection attempt is in progress
		this._isConnecting = false;

		// reconnection re-try settings
		this._initialRetryDelayMs = 1000;
		this._maxRetryDelayMs = 30000;
		this._currentRetryDelayMs = this._initialRetryDelayMs;
		this._retryTimeoutId = null;

		this._manualDisable = false;
		this._closingForReconnect = false;

		// for our internal event bus
		this._listeners = Object.create(null);

		// Set up event handlers + watchers
		this._setupObsEventHandlers();
		this._setupWatchers();

		// Initialize state based on initial enabled value
		if (this.enabled.value) {

            // "Enabled" at startup -> start connecting
			this.connectionStatus.value = 'connecting';
			this.streamingStatus.value = 'unknown';
			this._connectWithRetry();

		} else {
			this.connectionStatus.value = 'disabled';
			this.streamingStatus.value = 'disabled';
			this.statusMessage.value = 'OBS connection disabled.';
		}
	}


	// ---------------------------------------------------------------------
	// Public API
	// ---------------------------------------------------------------------

	/**
	 * Subscribe to internal events.
	 *
	 * @param {string} eventName
	 * @param {Function} handler
	 * @returns {Function} unsubscribe function
	 */
	on(eventName, handler) {

		// Create set if needed
		if (!this._listeners[eventName])
			this._listeners[eventName] = new Set();

		// add our callback
		this._listeners[eventName].add(handler);

		// Return unsubscribe function
		return () => this.off(eventName, handler);
	}


	/**
	 * Unsubscribe from an internal event.
	 *
	 * @param {string} eventName
	 * @param {Function} handler
	 */
	off(eventName, handler) {

		// find and remove
		const set = this._listeners[eventName];
		if (!set)
			return;

		set.delete(handler);
	}


	/**
	 * Convenience: subscribe to "OBS went live".
	 *
	 * @param {Function} handler
	 * @returns {Function} unsubscribe
	 */
	onOBSLive(handler) {
		return this.on('obs-stream-live', handler);
	}


	/**
	 * Convenience: subscribe to "OBS went offline".
	 *
	 * @param {Function} handler
	 * @returns {Function} unsubscribe
	 */
	onOBSOffline(handler) {
        return this.on('obs-stream-offline', handler);
	}


	/**
	 * Manually trigger a reconnect using current settings.
	 * Does nothing if the feature is disabled.
	 */
	reconnect() {

		// gtfo if disabled
		if (!this.enabled.value)
			return;

		this._manualDisable = false;
		this._closingForReconnect = true;

		this._clearRetryTimeout();

		this.statusMessage.value = 'Reconnecting to OBS...';
		this.connectionStatus.value = 'connecting';

		if (this.isConnected.value) {

			// This will fire ConnectionClosed which we handle.
			this._obs.disconnect().catch(() => {

				// Ignore; we'll fall back to normal retry flow.
				this._scheduleReconnect(250);
			});

		} else {

			this._scheduleReconnect(250);
		}
	}


	/**
	 * Clean up everything. Call this when ChatToysApp is destroyed.
	 */
	async destroy() {

		this._manualDisable = true;
		this._closingForReconnect = false;
		this._clearRetryTimeout();

		try {
			if (this.isConnected.value)
				await this._obs.disconnect();
		} catch (e) {
			// ignore
		}

		if (this._obs && typeof this._obs.removeAllListeners === 'function') {
			this._obs.removeAllListeners();
		}

		this.isConnected.value = false;
		this.isStreaming.value = false;
		this.connectionStatus.value = 'disabled';
		this.streamingStatus.value = 'disabled';
		this.statusMessage.value = 'OBS connection manager destroyed.';
	}


	// ---------------------------------------------------------------------
	// Private helpers
	// ---------------------------------------------------------------------

	/**
	 * Set up obs-websocket-js event handlers.
	 *
	 * @private
	 */
	_setupObsEventHandlers() {

		// Stream state (live / offline)
		// StreamStateChanged event body contains outputActive.
		this._obs.on('StreamStateChanged', (state) => {

			const active = !!state.outputActive;

			this.isStreaming.value = active;
			this.streamingStatus.value = active ? 'live' : 'offline';
			this.statusMessage.value = active
				? 'OBS detected stream is LIVE.'
				: 'OBS stream stopped.';

			this._emit(active ? 'obs-stream-live' : 'obs-stream-offline', state);
		});

		// obs-websocket-js internal connection lifecycle events
		this._obs.on('ConnectionOpened', () => {
			// Low-level socket opened; actual "connected" will be after identify
		});

		this._obs.on('Identified', () => {

			this.isConnected.value = true;
			this.connectionStatus.value = 'connected';
			this.statusMessage.value = 'Connected to OBS.';
			this._currentRetryDelayMs = this._initialRetryDelayMs;

			this._emit('obs-connected');

			// Sync initial stream state once connected
			this._syncInitialStreamState();

			// Auto-refresh ChatToys browser sources if enabled
			if (this.enableAutoRefresh && this.enableAutoRefresh.value) {
				this.refreshSources().catch((err) => {
					console.error(
						'[OBSConnectionManager] Auto-refresh of browser sources failed:',
						err
					);
				});
			}

			// Cache the scene/source hierarchy for the Tosser source picker etc.
			this.buildSourceCache().catch((err) => {
				console.error('[OBSConnectionManager] buildSourceCache failed:', err);
			});
		});

		this._obs.on('ConnectionClosed', (error) => {
			this._onConnectionClosed(error);
		});

		this._obs.on('ConnectionError', (error) => {
			this._handleConnectionError(error);
		});

		// Scene-item transform changes (a source moved/scaled/cropped) and
		// program-scene switches. The Tosser's collider tracker listens to
		// these to keep the auto-collider on the avatar source.
		this._obs.on('SceneItemTransformChanged', (data) => {
			this._emit('obs-scene-item-transform', data);
		});
		this._obs.on('CurrentProgramSceneChanged', (data) => {
			this._emit('obs-scene-changed', data);
		});
	}


	/**
	 * Wire up Vue watchers for settings changes.
	 *
	 * @private
	 */
	_setupWatchers() {

		// Enable toggle
		watch(this.enabled, (enabled) => {

			if (enabled) {

				this._manualDisable = false;
				this._closingForReconnect = false;

				this.connectionStatus.value = 'connecting';
				this.streamingStatus.value = 'unknown';
				this.statusMessage.value = 'Connecting to OBS...';

				this._currentRetryDelayMs = this._initialRetryDelayMs;
				this._connectWithRetry();

			} else {

				// User explicitly disabled the feature
				this._manualDisable = true;
				this._closingForReconnect = false;

				this._clearRetryTimeout();
				this.statusMessage.value = 'OBS connection disabled.';

				if (this.isConnected.value) {

					this._obs.disconnect().catch(() => {
						// ignore
					});
				}

				this.isConnected.value = false;
				this.isStreaming.value = false;

				this.connectionStatus.value = 'disabled';
				this.streamingStatus.value = 'disabled';

				this._emit('obs-disconnected');
			}
		});


		// Port changes -> reconnect if enabled
		watch(this.port, () => {

			if (!this.enabled.value)
				return;

			this.statusMessage.value = 'OBS port changed. Reconnecting...';
			this.reconnect();
		});


		// Password changes -> reconnect if enabled
		watch(this.password, () => {

			if (!this.enabled.value)
				return;

			this.statusMessage.value = 'OBS password changed. Reconnecting...';
			this.reconnect();
		});
	}


	/**
	 * Emit an internal event.
	 *
	 * @param {string} eventName
	 * @param {*} [payload]
	 * @private
	 */
	_emit(eventName, payload) {

		const set = this._listeners[eventName];
		if (!set || !set.size)
			return;

		for (const handler of Array.from(set)) {
			try {
				handler(payload);
			} catch (err) {
				console.error('[OBSConnectionManager] Listener error for', eventName, err);
			}
		}
	}


	/**
	 * Ensure we're attempting to connect while enabled.
	 *
	 * @private
	 */
	_connectWithRetry() {

		if (!this.enabled.value)
			return;

		if (this._isConnecting)
			return;

		this._isConnecting = true;
		this._connectOnce()
			.then(() => {
				// Success handled in Identified + _syncInitialStreamState
			})
			.catch((err) => {
				this._handleConnectionError(err);
				this._scheduleReconnect();
			})
			.finally(() => {
				this._isConnecting = false;
			});
	}


	/**
	 * Perform a single connection attempt.
	 *
	 * @returns {Promise<void>}
	 * @private
	 */
	async _connectOnce() {

		if (!this.enabled.value)
			return;

		const port = Number(this.port.value) || 4455;
		const url = `ws://127.0.0.1:${port}`;
		const password = this.password.value || undefined;

		this.connectionStatus.value = 'connecting';
		this.statusMessage.value = `Connecting to OBS at ${url}...`;

		try {

			// Use RPC v1 and subscribe to general + streaming events.
			// NOTE: SceneItemTransformChanged is a HIGH-VOLUME event and is NOT
			// part of EventSubscription.All - it must be OR'd in explicitly, or
			// the Tosser collider won't follow when a source is moved/scaled.
			await this._obs.connect(
				url,
				password,
				{
					rpcVersion: 1,
					eventSubscriptions: EventSubscription.All | EventSubscription.SceneItemTransformChanged
				}
			);

			// At this point, "Identified" will fire and mark us connected.

		} catch (error) {

			throw error;
		}
	}


	/**
	 * Schedule the next reconnect attempt, respecting backoff.
	 *
	 * @param {number} [overrideDelayMs]
	 * @private
	 */
	_scheduleReconnect(overrideDelayMs) {

		if (!this.enabled.value || this._manualDisable)
			return;

		const delay = typeof overrideDelayMs === 'number'
			? overrideDelayMs
			: this._currentRetryDelayMs;

		this._clearRetryTimeout();

		this.statusMessage.value = `Connection failed. Retrying in ${Math.round(delay / 1000)}s...`;

		this._retryTimeoutId = setElectronTimeout(() => {

			if (!this.enabled.value || this._manualDisable)
				return;

			// Exponential backoff, capped
			this._currentRetryDelayMs = Math.min(
				this._currentRetryDelayMs * 2,
				this._maxRetryDelayMs
			);

			this._connectWithRetry();

		}, delay);
	}


	/**
	 * Clear any pending reconnect timeout.
	 *
	 * @private
	 */
	_clearRetryTimeout() {

		if (this._retryTimeoutId !== null) {
			clearElectronTimeout(this._retryTimeoutId);
			this._retryTimeoutId = null;
		}
	}


	/**
	 * Handle connection closed event.
	 *
	 * @param {Error} [error]
	 * @private
	 */
	_onConnectionClosed(error) {

		this.isConnected.value = false;
		this.isStreaming.value = false;

		if (!this.enabled.value || this._manualDisable) {

			this.connectionStatus.value = 'disabled';
			this.streamingStatus.value = 'disabled';

		} else {

			this.connectionStatus.value = 'disconnected';
			this.streamingStatus.value = 'offline';
		}

		if (this._closingForReconnect) {

			// We already scheduled reconnect in reconnect()
			this._closingForReconnect = false;

		} else if (this.enabled.value && !this._manualDisable) {

			this.statusMessage.value = 'Lost connection to OBS. Will retry...';
			this._scheduleReconnect();
		}

		this._emit('obs-disconnected', error);
	}


	/**
	 * Turn low-level errors into friendly status messages.
	 *
	 * @param {any} error
	 * @private
	 */
	_handleConnectionError(error) {

		let summary = 'Unknown error.';

		if (error) {

			// OBS WebSocket protocol codes: AuthenticationFailed = 4009, etc.
			if (error.code === 4009 || error.code === 4005) {

				if (!this.password.value) {
					summary = 'Authentication failed. Password required in OBS settings.';
				} else {
					summary = 'Authentication failed. Incorrect password.';
				}

			} else if (error.code === 'ECONNREFUSED' || error.code === 1006) {

				summary = 'Cannot connect to OBS. Is OBS running and WebSocket server enabled?';

			} else if (typeof error.message === 'string') {

				summary = error.message;
			}
		}

		this.connectionStatus.value = 'error';
		this.statusMessage.value = `OBS connection error: ${summary}`;

		this._emit('obs-connection-error', error);
	}


	/**
	 * Query OBS for initial stream status when we first connect.
	 *
	 * @private
	 */
	async _syncInitialStreamState() {

		if (!this.enabled.value || !this.isConnected.value)
			return;

		try {

			// GetStreamStatus returns outputActive / outputReconnecting, etc.
			const status = await this._obs.call('GetStreamStatus');

			const active = !!status.outputActive;
			this.isStreaming.value = active;
			this.streamingStatus.value = active ? 'live' : 'offline';

			if (active) {
				this._emit('obs-stream-live', status);
			} else {
				this._emit('obs-stream-offline', status);
			}

		} catch (err) {

			// Not fatal; just mark as unknown
			this.streamingStatus.value = 'unknown';
		}
	}


	/**
	 * Refresh all browser sources whose URL has ?single=true or ?single=false
	 *
	 * @returns {Promise<void>}
	 */
	async refreshSources() {

		// Only run if we're actually connected
		if (!this.isConnected.value)
			return;

		try {

			// Get all inputs (sources)
			const { inputs } = await this._obs.call('GetInputList');

			if (!Array.isArray(inputs) || !inputs.length)
				return;

			// Only browser sources
			const browserInputs = inputs.filter(
				(input) => input.inputKind === 'browser_source'
			);

			// Matches ...?single=true or ...?single=false as a query param
			const singleFlagPattern = /\?single=(true|false)(&|$)/;

			for (const input of browserInputs) {

				try {
					// Get settings so we can inspect the URL
					const { inputSettings } = await this._obs.call('GetInputSettings', {
						inputName: input.inputName
					});

					const url = inputSettings && inputSettings.url;
					if (!url || !singleFlagPattern.test(url))
						continue;

					// Press the browser source "refresh" button
					await this._obs.call('PressInputPropertiesButton', {
						inputName: input.inputName,
						propertyName: 'refreshnocache'
					});

				} catch (err) {
					console.error(
						'[OBSConnectionManager] Failed to refresh browser source',
						input && input.inputName,
						err
					);
				}
			}

		} catch (err) {

			console.error(
				'[OBSConnectionManager] Failed to enumerate inputs for browser refresh',
				err
			);
		}
	}


	/**
	 * Get the OBS canvas (base) resolution. Used to normalize source
	 * rectangles to 0..1 for the Tosser collider tracker.
	 *
	 * @returns {Promise<{baseWidth:number, baseHeight:number}|null>}
	 */
	async getVideoSettings() {

		if (!this.isConnected.value)
			return null;

		try {
			const v = await this._obs.call('GetVideoSettings');
			return {
				baseWidth: v.baseWidth,
				baseHeight: v.baseHeight,
			};
		} catch (err) {
			console.error('[OBSConnectionManager] getVideoSettings failed', err);
			return null;
		}
	}


	/**
	 * List all scene names (top-level scenes, not groups).
	 *
	 * @returns {Promise<Array<string>>}
	 */
	async getSceneList() {

		if (!this.isConnected.value)
			return [];

		try {
			const r = await this._obs.call('GetSceneList');
			return (r.scenes || []).map((s) => s.sceneName).filter(Boolean);
		} catch (err) {
			console.error('[OBSConnectionManager] getSceneList failed', err);
			return [];
		}
	}


	/**
	 * Recursively build a tree of a scene's (or group's) items, expanding
	 * groups (one level, OBS doesn't nest groups) and nested scenes
	 * (arbitrary depth, cycle-guarded).
	 *
	 * @param {string} name - scene or group name
	 * @param {boolean} isGroup - true if `name` is a group
	 * @param {Set<string>} sceneSet - set of all scene names (to detect nested scenes)
	 * @param {Set<string>} seen - path guard against scene cycles
	 * @returns {Promise<Array<Object>>} array of tree nodes
	 */
	async _buildItemTree(name, isGroup, sceneSet, seen) {

		const key = (isGroup ? 'g:' : 's:') + name;
		if (seen.has(key))
			return [];
		const nextSeen = new Set(seen);
		nextSeen.add(key);

		let items = [];
		try {
			const call = isGroup ? 'GetGroupSceneItemList' : 'GetSceneItemList';
			const r = await this._obs.call(call, { sceneName: name });
			items = r.sceneItems || [];
		} catch (err) {
			return [];
		}

		const nodes = [];
		for (const it of items) {

			const childIsGroup = !!it.isGroup;
			const childIsScene = !childIsGroup && sceneSet.has(it.sourceName);

			const node = {
				name: it.sourceName,
				id: it.sceneItemId,
				isGroup: childIsGroup,
				isScene: childIsScene,
				kind: it.inputKind || it.sourceType || null,
				children: null,
			};

			if (childIsGroup)
				node.children = await this._buildItemTree(it.sourceName, true, sceneSet, nextSeen);
			else if (childIsScene)
				node.children = await this._buildItemTree(it.sourceName, false, sceneSet, nextSeen);

			nodes.push(node);
		}

		return nodes;
	}


	/**
	 * Rebuild `sourceCache` from OBS: every scene's full item hierarchy plus a
	 * flat set of all source names (used to flag tracked sources that have
	 * been removed/renamed). Called automatically on connect.
	 *
	 * @returns {Promise<void>}
	 */
	async buildSourceCache() {

		if (!this.isConnected.value)
			return;

		const scenes = await this.getSceneList();
		const sceneSet = new Set(scenes);
		const trees = {};
		const allNames = new Set();

		const walk = (nodes) => {
			for (const n of nodes) {
				allNames.add(n.name);
				if (n.children)
					walk(n.children);
			}
		};

		for (const s of scenes) {
			const tree = await this._buildItemTree(s, false, sceneSet, new Set());
			trees[s] = tree;
			walk(tree);
		}

		this.sourceCache.value = { scenes, trees, allNames: Array.from(allNames) };
	}


	/**
	 * List the source names present in the current program scene. Used by the
	 * Tosser's collider-tracking picker so the user can choose which source is
	 * their avatar / VTS capture.
	 *
	 * @returns {Promise<Array<string>>} unique source names (empty if not connected)
	 */
	async getSceneSourceNames() {

		if (!this.isConnected.value)
			return [];

		try {

			const sceneRes = await this._obs.call('GetCurrentProgramScene');
			const sceneName = sceneRes.currentProgramSceneName || sceneRes.sceneName;
			if (!sceneName)
				return [];

			const { sceneItems } = await this._obs.call('GetSceneItemList', { sceneName });
			const names = (Array.isArray(sceneItems) ? sceneItems : [])
				.map((it) => it.sourceName)
				.filter(Boolean);

			return Array.from(new Set(names));

		} catch (err) {
			console.error('[OBSConnectionManager] getSceneSourceNames failed', err);
			return [];
		}
	}


	/**
	 * Get the transform (position/scale/crop/rotation/bounds + source size) of
	 * a named source in the current program scene. Returns null if not found.
	 * This is the per-frame read the collider tracker will use.
	 *
	 * @param {string} sourceName
	 * @returns {Promise<Object|null>}
	 */
	async getSceneItemTransform(sourceName) {

		if (!this.isConnected.value || !sourceName)
			return null;

		try {

			const sceneRes = await this._obs.call('GetCurrentProgramScene');
			const sceneName = sceneRes.currentProgramSceneName || sceneRes.sceneName;
			if (!sceneName)
				return null;

			const { sceneItems } = await this._obs.call('GetSceneItemList', { sceneName });
			const item = (Array.isArray(sceneItems) ? sceneItems : [])
				.find((it) => it.sourceName === sourceName);
			if (!item)
				return null;

			const { sceneItemTransform } = await this._obs.call('GetSceneItemTransform', {
				sceneName,
				sceneItemId: item.sceneItemId,
			});

			return sceneItemTransform || null;

		} catch (err) {
			console.error('[OBSConnectionManager] getSceneItemTransform failed', err);
			return null;
		}
	}

}
