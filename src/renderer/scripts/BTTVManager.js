/*
	BTTVManager.js
	--------------

	Handles fetching and caching BetterTTV (BTTV) emojis for Twitch.
	Supports both global BTTV emojis and channel-specific emojis.
	
	Settings are persisted via chromeRef and chromeShallowRef.
	Emoji data is cached in localStorage with a 1-week expiration.
*/

// vue
import { ref, watch, computed, reactive } from 'vue';
import { chromeRef, chromeShallowRef } from './chromeRef';

/**
 * Small helper to cap an array’s length for logs.
 * 
 * @param {Array<any>} arr 
 * @param {any} item 
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
 * Manages BTTV emoji integration, including fetching, caching, and logging.
 */
export class BTTVManager {

	/**
	 * @param {ChatToysApp} ctApp - main app instance
	 */
	constructor(ctApp) {

		// save reference to main app
		this.ctApp = ctApp;

		// -----------------------
		// Config / UI-facing refs
		// -----------------------

		// Whether BTTV integration is enabled
		this.enabled = chromeRef('bttv_enabled', false);

		// Whether to use global BTTV emojis
		this.useGlobal = chromeRef('bttv_use_global', true);

		// Manually added shared emojis
		this.manualEmojis = chromeShallowRef('bttv_manual_emojis', []);

		// Specific Twitch channel IDs to pull extra emojis from
		// (Users should provide numerical Twitch IDs for the BTTV API)
		this.twitchChannels = chromeShallowRef('bttv_twitch_channels', []);

		// Human-readable status line for UI
		this.statusMessage = ref('BTTV integration disabled');

		// Rolling log for the BTTV tab (array of {time, level, message})
		this.logs = chromeShallowRef('bttv_logs', []);

		// -----------------------
		// Internal State
		// -----------------------

		// Memory cache for active emojis
		// Map of code -> { id, url, channel? }
		this.emojis = reactive(new Map());

		// Cache expiration (1 week in ms)
		this._cacheTTL = 7 * 24 * 60 * 60 * 1000;

		// BTTV API Endpoints
		this._apiBase = 'https://api.betterttv.net/3/cached';
		this._cdnBase = 'https://cdn.betterttv.net/emote';

		// -----------------------
		// Reactivity wiring
		// -----------------------

		// Whenever enabled flips, start or stop
		watch(this.enabled, (val) => {
			if (val) {
				this._log('info', 'BTTV Enabled, checking for emoji cache');
				this.init();
			} else {
				this._log('info', 'BTTV Not Enabled, not requesting emojis');
				this.statusMessage.value = 'BTTV integration disabled';
				this.emojis.clear();
			}
		}, { immediate: true });

		// Watch for changes in global toggle
		watch(this.useGlobal, () => {
			if (this.enabled.value) {
				this._log('info', 'BTTV Global toggle changed, refreshing');
				this.init();
			}
		});

		// Watch for changes in manual emojis
		watch(this.manualEmojis, () => {
			if (this.enabled.value) {
				this.init();
			}
		}, { deep: true });

		// Watch for changes in extra channels
		watch(this.twitchChannels, () => {
			if (this.enabled.value) {
				this._log('info', 'BTTV channels updated, refreshing everything');
				this.init();
			}
		}, { deep: true });

		// for debug in dev tools
		if (typeof window !== 'undefined')
			window.bttvMgr = this;
	}

	/**
	 * Main initialization logic
	 */
	async init() {
		if (!this.enabled.value) return;

		this.emojis.clear();
		
		if (this.useGlobal.value) {
			await this._loadGlobalEmojis();
		}

		await this._refreshChannelEmojis();
		this._loadManualEmojis();
	}

	/**
	 * Loads manually added emojis into the memory map
	 */
	_loadManualEmojis() {
		this._log('info', `Loading ${this.manualEmojis.value.length} manually added emojis`);
		this._processEmojiList(this.manualEmojis.value, 'manual');
	}

	/**
	 * Adds an emoji to the manual list
	 * 
	 * @param {Object} emoji - {id, code}
	 */
	addManualEmoji(emoji) {
		if (this.isManualEmoji(emoji.id)) return;

		this.manualEmojis.value = [...this.manualEmojis.value, {
			id: emoji.id,
			code: emoji.code
		}];
		this._log('info', `Added manual emoji: ${emoji.code}`);
		this.init(); // Refresh to update memory map
	}

	/**
	 * Removes an emoji from the manual list
	 * 
	 * @param {string} emojiId 
	 */
	removeManualEmoji(emojiId) {
		const emoji = this.manualEmojis.value.find(e => e.id === emojiId);
		this.manualEmojis.value = this.manualEmojis.value.filter(e => e.id !== emojiId);
		if (emoji) {
			this._log('info', `Removed manual emoji: ${emoji.code}`);
		}
		this.init(); // Refresh to update memory map
	}

	/**
	 * Checks if an emoji is in the manual list
	 * 
	 * @param {string} emojiId 
	 * @returns {boolean}
	 */
	isManualEmoji(emojiId) {
		return this.manualEmojis.value.some(e => e.id === emojiId);
	}

	/**
	 * Loads global BTTV emojis from cache or API
	 */
	async _loadGlobalEmojis() {
		const cacheKey = 'bttv_global_cache';
		const cached = this._getCache(cacheKey);

		if (cached) {
			this._log('info', 'BTTV Cache Found, BTTV Ready');
			this._processEmojiList(cached.emojis);
			return;
		}

		this._log('info', 'BTTV Cache Expired, Pulling BTTV Information');
		try {
			const response = await fetch(`${this._apiBase}/emotes/global`);
			if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
			
			const emojis = await response.json();
			const expiry = Date.now() + this._cacheTTL;
			
			this._setCache(cacheKey, { emojis, expiry });
			this._processEmojiList(emojis);
			
			const expiryDate = new Date(expiry).toLocaleDateString();
			this._log('info', `BTTV emojis cached, expiration set for ${expiryDate}`);
		} catch (err) {
			this._log('error', `Error fetching global BTTV emojis: ${err.message}`);
		}
	}

	/**
	 * Force a refresh of all channel emojis by clearing their caches
	 */
	async refreshChannels() {
		this._log('info', 'Forcing refresh of all channel emoji caches...');
		
		for (const channelId of this.twitchChannels.value) {
			if (!channelId) continue;
			const cacheKey = `bttv_channel_cache_${channelId}`;
			localStorage.removeItem(cacheKey);
		}

		await this.init();
		this._log('info', 'Channel emojis refreshed');
	}

	/**
	 * Refreshes emojis for all configured Twitch channels
	 */
	async _refreshChannelEmojis() {
		for (const channelId of this.twitchChannels.value) {
			if (!channelId) continue;
			await this._loadChannelEmojis(channelId);
		}
	}

	/**
	 * Loads BTTV emojis for a specific Twitch channel ID
	 * 
	 * @param {string} twitchId 
	 */
	async _loadChannelEmojis(twitchId) {
		this._log('info', `Checking Channel Emoji Cache for id: ${twitchId}`);
		
		const cacheKey = `bttv_channel_cache_${twitchId}`;
		const cached = this._getCache(cacheKey);

		if (cached) {
			this._log('info', `Cachecked BTTV Emojis for channel ${twitchId}`);
			this._processEmojiList(cached.emojis, twitchId);
			return;
		}

		try {
			const response = await fetch(`${this._apiBase}/users/twitch/${twitchId}`);
			if (!response.ok) {
				if (response.status === 404) {
					this._log('warn', `Error: channel ${twitchId} doesn't have custom BTTV emojis`);
				} else {
					throw new Error(`HTTP error! status: ${response.status}`);
				}
				return;
			}
			
			const data = await response.json();
			// BTTV channel API returns an object with { channelEmotes: [], sharedEmotes: [] }
			const channelEmojis = [...(data.channelEmotes || []), ...(data.sharedEmotes || [])];
			
			if (channelEmojis.length === 0) {
				this._log('info', `Channel ${twitchId} has no BTTV emojis`);
				return;
			}

			const expiry = Date.now() + this._cacheTTL;
			this._setCache(cacheKey, { emojis: channelEmojis, expiry });
			this._processEmojiList(channelEmojis, twitchId);
			
			this._log('info', `Successfully pulled and cached ${channelEmojis.length} BTTV emojis for channel ${twitchId}`);
		} catch (err) {
			this._log('error', `Error fetching BTTV emojis for channel ${twitchId}: ${err.message}`);
		}
	}

	/**
	 * Processes a list of raw BTTV emoji objects and adds them to the memory map
	 * 
	 * @param {Array<Object>} emojiList 
	 * @param {string} [channelId] 
	 */
	_processEmojiList(emojiList, channelId = 'global') {
		if (!Array.isArray(emojiList)) return;

		emojiList.forEach(e => {
			// BTTV URLs: https://cdn.betterttv.net/emote/<id>/3x
			const url = `${this._cdnBase}/${e.id}/3x`;
			this.emojis.set(e.code, {
				id: e.id,
				code: e.code,
				url: url,
				channel: channelId
			});
		});
	}

	/**
	 * Internal: log into the rolling logs array.
	 * 
	 * @param {"info"|"warn"|"error"} level 
	 * @param {string} message 
	 */
	_log(level, message) {
		const time = new Date().toISOString();
		console[level === 'error' ? 'error' : 'log'](`[BTTV][${level}] ${message}`);
		this.logs.value = cappedPush(this.logs.value, { time, level, message }, 300);
		this.statusMessage.value = message;
	}

	/**
	 * Helper to get data from localStorage cache
	 * 
	 * @param {string} key 
	 * @returns {Object|null}
	 */
	_getCache(key) {
		try {
			const raw = localStorage.getItem(key);
			if (!raw) return null;
			
			const data = JSON.parse(raw);
			if (Date.now() > data.expiry) {
				localStorage.removeItem(key);
				return null;
			}
			return data;
		} catch (e) {
			return null;
		}
	}

	/**
	 * Helper to set data to localStorage cache
	 * 
	 * @param {string} key 
	 * @param {Object} data 
	 */
	_setCache(key, data) {
		try {
			localStorage.setItem(key, JSON.stringify(data));
		} catch (e) {
			console.warn('[BTTVManager] Failed to write to localStorage cache', e);
		}
	}

	/**
	 * Clear all BTTV logs
	 */
	clearLogs() {
		this.logs.value = [];
	}
}
