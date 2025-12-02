/*
	YouTubeConnectionManager.js
	---------------------------

	Automatically finds the user's current YouTube live stream ID and
	adds/enables it as a chat source when OBS goes live.

	Responsibilities:
	- Store user channel URL (e.g. https://www.youtube.com/@LofiGirl)
	- Wait for OBS to be connected + live
	- While OBS is live, periodically probe YouTube using:
		- getLive3 (public /live URL)
		- getUserLive (owner / Studio / page scraping)
	- When a live videoId is found:
		- Add it to chat sources (via chatSourceAPI.add)
		- Or, if it already exists, enable it
	- When OBS goes offline:
		- Disable that managed chat source
		- Optionally delete it (if deleteOnOffline is true)
	- Expose a manual checkNow() method for the UI.

*/

// vue
import { ref, watch } from 'vue';

// our app
import { chromeRef, chromeShallowRef } from "../scripts/chromeRef";


/**
 * @typedef {Object} YouTubeConnectionManagerOptions
 * @property {string} [storagePrefix] Optional key prefix for local storage
 */


/**
 * YouTubeConnectionManager
 */
export class YouTubeConnectionManager {

	/**
	 * @param {Object} chatToysApp - Root ChatToysApp instance
	 * @param {YouTubeConnectionManagerOptions} [options]
	 */
	constructor(chatToysApp, options) {

		/** @type {Object} */
		this.app = chatToysApp;

		/** @type {Object} */
		this.obs = chatToysApp.obsConnMgr;

		/** @type {string} */
		this.storagePrefix = (options && options.storagePrefix) || 'chattoys.yt.';


		/*
			Persistent Settings
			-------------------
		*/

		/**
		 * Master enable toggle for YouTube auto-detection.
		 * You can bind this to a toggle in the UI.
		 *
		 * @type {import('vue').Ref<boolean>}
		 */
		this.enabled = chromeRef(this.storagePrefix + 'enabled', true);

		/**
		 * Full channel URL, e.g. "https://www.youtube.com/@LofiGirl".
		 *
		 * @type {import('vue').Ref<string>}
		 */
		this.channelUrl = chromeRef(this.storagePrefix + 'channelUrl', '');

		/**
		 * If true, delete the managed chat source when OBS goes offline.
		 *
		 * @type {import('vue').Ref<boolean>}
		 */
		this.deleteOnOffline = chromeRef(this.storagePrefix + 'deleteOnOffline', false);

		/*
			UI / Reactive State
			-------------------
		*/

		/**
		 * Human-friendly status text for the UI.
		 * @type {import('vue').Ref<string>}
		 */
		this.statusMessage = ref('YouTube auto-detection idle.');

		/**
		 * The last successfully detected live stream ID (for display only).
		 * @type {import('vue').Ref<string>}
		 */
		this.lastFoundId = ref('');

		/**
		 * True while we're actively scanning / retrying for a live stream.
		 * @type {import('vue').Ref<boolean>}
		 */
		this.isScanning = ref(false);


		/*
			Internal State
			--------------
		*/

		// poll & retry settings
		this._polling = false;
		this._pollTimeoutId = null;
		this._initialPollDelayMs = 3000;
		this._maxPollDelayMs = 60000;
		this._currentPollDelayMs = this._initialPollDelayMs;
		this._attemptCount = 0;
		this._probeInProgress = false;


		/**
		 * Tracks which script we used last so we can alternate:
		 * 'getLive3' | 'getUserLive'
		 *
		 * @private
		 * @type {string}
		 */
		this._lastProbeMethod = 'getUserLive';


		/**
		 * The YouTube ID we consider "managed" by this manager for the
		 * current OBS streaming session.
		 *
		 * @private
		 * @type {string|null}
		 */
		this._managedYoutubeId = null;


		/*
			Event Wiring
			------------
		*/

		this._bindObsEvents();
		this._setupWatchers();

		// Initialize status
		this._updateInitialStatus();
	}


	// ---------------------------------------------------------------------
	// Public API
	// ---------------------------------------------------------------------

	/**
	 * Manually trigger a one-off check for a live stream.
	 *
	 * This ignores OBS state and does not interfere with the polling loop.
	 *
	 * @returns {Promise<void>}
	 */
	async checkNow() {

		if (!this._hasValidChannelUrl()) {
			this.statusMessage.value = 'Channel URL missing/invalid.';
			return;
		}

		this.statusMessage.value = 'Manual check: probing YouTube for live stream...';

		try {

			const videoId = await this._probeForLiveId(true);

			if (videoId) {

				this.statusMessage.value = `Manual check: found live stream "${videoId}".`;
				await this._handleFoundVideoId(videoId, true);

			} else {

				this.statusMessage.value = 'Manual check: no live stream detected.';
			}

		} catch (err) {

			console.error('[YouTubeConnectionManager] checkNow error:', err);
			this.statusMessage.value = 'Manual check failed. See console for details.';
		}
	}


	/**
	 * Clean up any timers. Call when ChatToysApp is destroyed.
	 */
	destroy() {

		this._stopPolling();
		this.statusMessage.value = 'YouTube connection manager destroyed.';
	}


	// ---------------------------------------------------------------------
	// OBS Event Wiring
	// ---------------------------------------------------------------------

	/**
	 * Bind to OBSConnectionManager events.
	 *
	 * @private
	 */
	_bindObsEvents() {

		if (!this.obs || typeof this.obs.on !== 'function') {
			console.warn('[YouTubeConnectionManager] obsConnMgr not available. Auto-detection will be idle.');
			return;
		}

		// OBS connected
		this.obs.on('obs-connected', () => {

			if (!this.enabled.value)
				return;

			if (!this._hasValidChannelUrl()) {
				this.statusMessage.value = 'Channel URL missing/invalid.';
				return;
			}

			if (this.obs.isStreaming && this.obs.isStreaming.value) {
				// If OBS is already live on connect, start scanning immediately.
				this._onObsLive();
			} else {
				this.statusMessage.value = 'OBS found, waiting for you to go live.';
			}
		});

		// OBS disconnected
		this.obs.on('obs-disconnected', () => {

			if (!this.enabled.value)
				return;

			this.statusMessage.value = 'OBS connection failed. YouTube auto-detection paused.';
			this._stopPolling();
		});

		// OBS stream went live
		this.obs.on('obs-stream-live', () => {

			if (!this.enabled.value)
				return;

			this._onObsLive();
		});

		// OBS stream went offline
		this.obs.on('obs-stream-offline', () => {

			if (!this.enabled.value)
				return;

			this._onObsOffline();
		});
	}


	/**
	 * Setup watchers for settings changes.
	 *
	 * @private
	 */
	_setupWatchers() {

		// Enable toggle
		watch(this.enabled, (enabled) => {

			if (!enabled) {

				this.statusMessage.value = 'YouTube auto-detection disabled.';
				this._stopPolling();
				// Do not touch existing chat sources here; only OBS offline does that.

			} else {

				this._updateInitialStatus();

				// If OBS is already connected + live, start scanning.
				if (this._hasValidChannelUrl() && this.obs && this.obs.isConnected && this.obs.isConnected.value) {

					if (this.obs.isStreaming && this.obs.isStreaming.value) {
						this._onObsLive();
					} else {
						this.statusMessage.value = 'OBS found, waiting for you to go live.';
					}
				}
			}
		});

		// Channel URL changes
		watch(this.channelUrl, () => {

			if (!this.enabled.value)
				return;

			if (!this._hasValidChannelUrl()) {

				this.statusMessage.value = 'Channel URL missing/invalid.';
				this._stopPolling();
				this._managedYoutubeId = null;
				return;
			}

			// Channel URL became valid while OBS is live -> restart scanning
			if (this.obs && this.obs.isStreaming && this.obs.isStreaming.value) {
				this.statusMessage.value = 'OBS Live! Looking for YouTube chat (channel changed)...';
				this._managedYoutubeId = null;
				this._startPolling();
			} else if (this.obs && this.obs.isConnected && this.obs.isConnected.value) {
				this.statusMessage.value = 'OBS found, waiting for you to go live.';
			}
		});
	}


	/**
	 * Compute an initial status message based on current state.
	 *
	 * @private
	 */
	_updateInitialStatus() {

		if (!this.enabled.value) {
			this.statusMessage.value = 'YouTube auto-detection disabled.';
			return;
		}

		if (!this._hasValidChannelUrl()) {
			this.statusMessage.value = 'Channel URL missing/invalid.';
			return;
		}

		if (!this.obs || !this.obs.enabled || !this.obs.enabled.value) {
			this.statusMessage.value = 'OBS connection disabled. Please enable in the OBS tab.';
			return;
		}

		if (!this.obs.isConnected || !this.obs.isConnected.value) {
			this.statusMessage.value = 'OBS connection failed or not ready. Waiting for OBS...';
			return;
		}

		if (this.obs.isStreaming && this.obs.isStreaming.value) {
			this.statusMessage.value = 'OBS Live! Looking for YouTube chat...';
			this._startPolling();
		} else {
			this.statusMessage.value = 'OBS found, waiting for you to go live.';
		}
	}


	// ---------------------------------------------------------------------
	// OBS Live / Offline Handlers
	// ---------------------------------------------------------------------

	/**
	 * Handle OBS going live.
	 *
	 * @private
	 */
	_onObsLive() {

		if (!this.enabled.value) {
			return;
		}

		if (!this._hasValidChannelUrl()) {
			this.statusMessage.value = 'Channel URL missing/invalid.';
			return;
		}

		this.statusMessage.value = 'OBS Live! Looking for YouTube chat...';

		// Each live session starts fresh
		this._managedYoutubeId = null;
		this.lastFoundId.value = '';
		this._startPolling();
	}


	/**
	 * Handle OBS going offline.
	 *
	 * @private
	 */
	_onObsOffline() {

		this.statusMessage.value = 'OBS Offline, will resume looking for chat next time you\'re live.';
		this._stopPolling();
		this.isScanning.value = false;

		// Clean up managed chat source
		if (!this._managedYoutubeId)
			return;

		this._handleOfflineSourceCleanup(this._managedYoutubeId)
			.catch((err) => {
				console.error('[YouTubeConnectionManager] Failed to clean up source on OBS offline:', err);
			});
	}


	// ---------------------------------------------------------------------
	// Polling Logic
	// ---------------------------------------------------------------------

	/**
	 * Start the polling loop while OBS is live.
	 *
	 * @private
	 */
	_startPolling() {

		if (this._polling)
			return;

		if (!this.enabled.value)
			return;

		if (!this.obs || !this.obs.isStreaming || !this.obs.isStreaming.value)
			return;

		this._polling = true;
		this.isScanning.value = true;

		this._currentPollDelayMs = this._initialPollDelayMs;
		this._attemptCount = 0;

		this._scheduleNextPoll(0);
	}


	/**
	 * Stop the polling loop.
	 *
	 * @private
	 */
	_stopPolling() {

		this._polling = false;
		this.isScanning.value = false;

		if (this._pollTimeoutId !== null) {
			clearElectronTimeout(this._pollTimeoutId);
			this._pollTimeoutId = null;
		}
	}


	/**
	 * Schedule the next poll attempt.
	 *
	 * @param {number} [overrideDelayMs]
	 * @private
	 */
	_scheduleNextPoll(overrideDelayMs) {

		if (!this._polling)
			return;

		const delay = typeof overrideDelayMs === 'number'
			? overrideDelayMs
			: this._currentPollDelayMs;

		if (this._pollTimeoutId !== null) {
			clearElectronTimeout(this._pollTimeoutId);
			this._pollTimeoutId = null;
		}

		this._pollTimeoutId = setElectronTimeout(() => {
			this._pollTimeoutId = null;
			this._pollTick().catch((err) => {
				console.error('[YouTubeConnectionManager] Poll tick error:', err);
			});
		}, delay);
	}


	/**
	 * Single poll attempt.
	 *
	 * @private
	 * @returns {Promise<void>}
	 */
	async _pollTick() {

		if (!this._polling || !this.enabled.value)
			return;

		if (!this.obs || !this.obs.isStreaming || !this.obs.isStreaming.value) {
			// OBS no longer live; stop polling
			this._stopPolling();
			return;
		}

		if (!this._hasValidChannelUrl()) {
			this.statusMessage.value = 'Channel URL missing/invalid.';
			this._stopPolling();
			return;
		}

		// If we already have a managed ID for this session, no need to keep polling.
		if (this._managedYoutubeId) {
			this._stopPolling();
			this.isScanning.value = false;
			return;
		}

		if (this._probeInProgress) {
			// Another probe (e.g. manual) is in progress, back off a bit.
			this._scheduleNextPoll(this._currentPollDelayMs);
			return;
		}

		this._attemptCount += 1;
		this.statusMessage.value = `OBS Live! Looking for YouTube chat (attempt ${this._attemptCount})...`;

		const videoId = await this._probeForLiveId(false);

		if (videoId) {

			await this._handleFoundVideoId(videoId, false);

			this._stopPolling();
			this.isScanning.value = false;
			this.statusMessage.value = `OBS Live! Found "${videoId}" added to list.`;

		} else {

			// Backoff for next attempt, with a long runway
			this._currentPollDelayMs = Math.min(
				this._currentPollDelayMs * 1.5,
				this._maxPollDelayMs
			);

			this._scheduleNextPoll();
		}
	}


	// ---------------------------------------------------------------------
	// Probing Logic
	// ---------------------------------------------------------------------

	/**
	 * Probe YouTube once for a live video ID, alternating between getLive3 and getUserLive.
	 *
	 * @param {boolean} manual - if true, this was triggered by checkNow()
	 * @returns {Promise<string|null>}
	 * @private
	 */
	async _probeForLiveId(manual) {

		if (this._probeInProgress)
			return null;

		if (!this._hasValidChannelUrl())
			return null;

		const urls = this._normalizeChannelUrl(this.channelUrl.value);
		if (!urls)
			return null;

		this._probeInProgress = true;

		try {

			// Decide which script to try first to alternate
			let firstMethod;
			let secondMethod;

			if (this._lastProbeMethod === 'getUserLive') {
				firstMethod = 'getLive3';
				secondMethod = 'getUserLive';
			} else {
				firstMethod = 'getUserLive';
				secondMethod = 'getLive3';
			}

			// For getLive3 we prefer the /live URL
			const publicLiveUrl = urls.publicLiveUrl;
			const baseUrl = urls.baseUrl;

			// 1) First script
			let videoId = await this._invokeTestScript(
				firstMethod === 'getLive3' ? publicLiveUrl : baseUrl,
				firstMethod
			);

			if (videoId) {
				this._lastProbeMethod = firstMethod;
				return videoId;
			}

			// 2) Second script
			videoId = await this._invokeTestScript(
				secondMethod === 'getLive3' ? publicLiveUrl : baseUrl,
				secondMethod
			);

			if (videoId) {
				this._lastProbeMethod = secondMethod;
				return videoId;
			}

			// Nothing found
			return null;

		} finally {

			this._probeInProgress = false;
		}
	}


	/**
	 * Invoke the electron "test-url" handler with a given script.
	 *
	 * @param {string} url
	 * @param {string} scriptName
	 * @returns {Promise<string|null>}
	 * @private
	 */
	async _invokeTestScript(url, scriptName) {

		if (typeof electronAPI === 'undefined' || !electronAPI || typeof electronAPI.invoke !== 'function') {
			console.warn('[YouTubeConnectionManager] electronAPI.invoke not available.');
			return null;
		}

		try {

			const result = await electronAPI.invoke('test-url', url, scriptName);

			if (typeof result === 'string' && result.length === 11) {
				return result;
			}

			// Accept null/undefined as "no result"
			return null;

		} catch (err) {

			console.warn('[YouTubeConnectionManager] test-url error for script', scriptName, 'url', url, err);
			return null;
		}
	}


	// ---------------------------------------------------------------------
	// Chat Source Handling
	// ---------------------------------------------------------------------

	/**
	 * Handle a newly discovered live videoId.
	 *
	 * @param {string} videoId
	 * @param {boolean} fromManual
	 * @returns {Promise<void>}
	 * @private
	 */
	async _handleFoundVideoId(videoId, fromManual) {

		if (!videoId)
			return;

		this._managedYoutubeId = videoId;
		this.lastFoundId.value = videoId;

		const api = this._getChatSourceAPI();
		if (!api) {
			console.warn('[YouTubeConnectionManager] chatSourceAPI not available; cannot add/enable source.');
			return;
		}

		let sources = [];
		try {
			sources = await api.getAll();
		} catch (err) {
			console.error('[YouTubeConnectionManager] Failed to get chat sources:', err);
		}

		const existing = Array.isArray(sources)
			? sources.find((src) => src.youtube_id === videoId)
			: null;

		if (!existing) {

			// Add new source (should be enabled by default)
			this.statusMessage.value = fromManual
				? `Manual check: adding new chat source "${videoId}".`
				: `OBS Live! Adding new chat source "${videoId}".`;

			try {
				await api.add(videoId);
			} catch (err) {
				console.error('[YouTubeConnectionManager] Failed to add chat source:', err);
				this.statusMessage.value = 'Failed to add chat source. See console for details.';
			}

		} else if (!existing.enabled) {

			// Enable existing source
			this.statusMessage.value = fromManual
				? `Manual check: enabling existing chat source "${videoId}".`
				: `OBS Live! Enabling existing chat source "${videoId}".`;

			try {
				await api.enable(videoId);
			} catch (err) {
				console.error('[YouTubeConnectionManager] Failed to enable chat source:', err);
				this.statusMessage.value = 'Failed to enable chat source. See console for details.';
			}

		} else {

			// Already present & enabled
			this.statusMessage.value = fromManual
				? `Manual check: chat source "${videoId}" already enabled.`
				: `OBS Live! Chat source "${videoId}" already enabled.`;
		}
	}


	/**
	 * When OBS goes offline, disable (and optionally delete) the managed source.
	 *
	 * @param {string} videoId
	 * @returns {Promise<void>}
	 * @private
	 */
	async _handleOfflineSourceCleanup(videoId) {

		const api = this._getChatSourceAPI();
		if (!api)
			return;

		let sources = [];
		try {
			sources = await api.getAll();
		} catch (err) {
			console.error('[YouTubeConnectionManager] Failed to get chat sources for cleanup:', err);
			return;
		}

		const existing = Array.isArray(sources)
			? sources.find((src) => src.youtube_id === videoId)
			: null;

		if (!existing)
			return;

		try {

			if (existing.enabled) {
				await api.disable(videoId);
			}

			if (this.deleteOnOffline.value) {
				await api.remove(videoId);
				this.statusMessage.value = `OBS Offline, removed chat source "${videoId}".`;
				this._managedYoutubeId = null;
				this.lastFoundId.value = '';
			} else {
				this.statusMessage.value = `OBS Offline, disabled chat source "${videoId}".`;
			}

		} catch (err) {

			console.error('[YouTubeConnectionManager] Failed to disable/remove chat source:', err);
			this.statusMessage.value = 'Failed to disable/remove chat source on OBS offline.';
		}
	}


	/**
	 * Helper to get chatSourceAPI safely.
	 *
	 * @returns {any|null}
	 * @private
	 */
	_getChatSourceAPI() {

		const api = (typeof chatSourceAPI !== 'undefined' && chatSourceAPI)
			|| (typeof window !== 'undefined' && window.chatSourceAPI);

		if (!api) {
			console.warn('[YouTubeConnectionManager] chatSourceAPI not found.');
			return null;
		}

		return api;
	}


	// ---------------------------------------------------------------------
	// URL Helpers
	// ---------------------------------------------------------------------

	/**
	 * Validate that the channelUrl looks like a YouTube channel URL.
	 *
	 * @private
	 * @returns {boolean}
	 */
	_hasValidChannelUrl() {

		const val = (this.channelUrl.value || '').trim();
		if (!val)
			return false;

		const normalized = this._normalizeChannelUrl(val);
		return !!normalized;
	}

	
	/**
	 * Normalize the user-provided channel URL into:
	 * - baseUrl (e.g. https://www.youtube.com/@Handle)
	 * - publicLiveUrl (e.g. https://www.youtube.com/@Handle/live)
	 *
	 * @param {string} raw
	 * @returns {{ baseUrl: string, publicLiveUrl: string }|null}
	 * @private
	 */
	_normalizeChannelUrl(raw) {

		if (!raw || typeof raw !== 'string')
			return null;

		let url;
		try {
			url = new URL(raw.trim());
		} catch (err) {
			return null;
		}

		const host = url.hostname.toLowerCase();

		if (!host.includes('youtube.com'))
			return null;

		let basePath = url.pathname || '/';

		// Handle /@Handle[/...]
		if (basePath.startsWith('/@')) {

			const parts = basePath.split('/');
			if (parts.length >= 2 && parts[1].length > 0) {
				basePath = '/' + parts[1]; // "/@Handle"
			} else {
				return null;
			}

		} else if (
			basePath.startsWith('/channel/') ||
			basePath.startsWith('/user/') ||
			basePath.startsWith('/c/')
		) {
			// Keep "/channel/ID" or "/user/Name"
			const parts = basePath.split('/');
			if (parts.length >= 3) {
				basePath = `/${parts[1]}/${parts[2]}`;
			} else {
				return null;
			}

		} else {
			// Some other random YouTube URL; treat as invalid for now.
			return null;
		}

		const origin = `${url.protocol}//${url.hostname}`;
		const baseUrl = origin + basePath;

		let publicLiveUrl = baseUrl;
		if (!basePath.endsWith('/live')) {
			publicLiveUrl = baseUrl + '/live';
		}

		return {
			baseUrl,
			publicLiveUrl
		};
	}
}
