/*
	FrequencyFinder.js
	------------------

	A Toy that detects frequently repeated chat messages in a sliding time window.

	- Listens to chatProcessor.onNewChats(chats)
	- Tracks messages inside a global watchWindow (seconds)
	- When >= minCount similar messages appear in that window, it creates a pattern
	- Each pattern has its own TTL (also watchWindow seconds)
	- Each new matching message:
		- increments the pattern's count
		- resets its TTL to watchWindow
	- Exposes patterns via socketShallowRef so widgets can render them.
*/

import { ref, shallowRef } from 'vue';
import { socketShallowRef } from 'socket-ref';
import Toy from '../Toy';

// components
import FrequencyFinderPage from './FrequencyFinderPage.vue';
import FreqFinderWidget from './FreqFinderWidget.vue';

// fuzzy matching library (install with: npm install string-similarity)
import stringSimilarity from 'string-similarity';

export default class FrequencyFinder extends Toy {

	// static info
	static name = 'Frequency Finder';
	static slug = 'frequencyFinder';
	static desc = 'Detects frequently repeated chat messages.';
	static optionsPageComponent = FrequencyFinderPage;
	static themeColor = '#50B5D1';
	static widgetComponents = [
		{
			component: FreqFinderWidget,
			key: 'frequencyWidgetBox',
			allowResize: true,
			lockAspectRatio: false,
			description: 'Shows frequently repeated messages.',
			slug: 'frequencyWidget'
		},
	];


	/**
	 * @param {ToyManager} toyManager
	 */
	constructor(toyManager) {

		super(toyManager);

		// -----------------------
		// Internal state (logic)
		// -----------------------

		/**
		 * In-memory list of recent messages, used for the *global* watchWindow.
		 * Each entry: { normalized: string, raw: string, ts: number }
		 * ts is Date.now() in ms.
		 */
		this.recentMessages = [];

		/**
		 * Active patterns (things we've detected as frequent).
		 * Each entry: { word: string, count: number, ttl: number }
		 * ttl is in seconds; decremented by our interval.
		 */
		this.patterns = [];

		// -----------------------
		// Socket-exposed state
		// -----------------------

		this.frequencyItems = socketShallowRef(
			this.static.slugify('frequencyItems'),
			[]
		);

		// -----------------------
		// Timers
		// -----------------------

		this.ttlTickFN = this.tickPatternTTLs.bind(this);
		this.ttlIntervalId = window.setElectronInterval(this.ttlTickFN, 1000);

		// -----------------------
		// Chat processor hook
		// -----------------------

		this.handleChatMessage = this.handleChatMessage.bind(this);
		this.chatToysApp.chatProcessor.onNewChats(this.handleChatMessage);
	}


	/**
	 * Clean up
	 */
	end() {
		super.end();

		if (this.ttlIntervalId) {
			window.clearElectronInterval(this.ttlIntervalId);
			this.ttlIntervalId = null;
		}

		if (this.handleChatMessage) {
			this.chatToysApp.chatProcessor.removeNewChatsListener(this.handleChatMessage);
		}
	}


	/**
	 * Initialize settings
	 */
	initSettings() {
		this.buildSettingsBlock({

			// display config for the widget
			fontColor: ref('#FFFFFF'),
			multiplierColor: ref('#FF0000'),
			fontSize: ref(32),
			showShadow: ref(true),

			stackAlign: ref('top'), // 'top' | 'bottom'

			// logic config
			// time in seconds to consider messages in the global window
			watchWindow: ref(5),

			// minimum messages required in window to create a pattern
			minCount: ref(2),

			// 50 - 100 (percentage); 100 = exact matches only
			matchThreshold: ref(100),

			// optional widget box placement
			frequencyWidgetBox: shallowRef({
				x: 1280 - 400,
				y: 0,
				width: 400,
				height: 200,
			}),
		});
	}

	// -------------------------------------------------------------------------
	// Core chat handling
	// -------------------------------------------------------------------------

	/**
	 * Handle new chat messages from the chat processor
	 * @param {Array<Object>} chats
	 */
	handleChatMessage(chats) {

		const now = Date.now();
		const windowSeconds = this.settings.watchWindow.value || 5;
		const windowMs = windowSeconds * 1000;
		const minCount = this.settings.minCount.value || 2;

		for (const chat of chats) {

			// ignore empty messages just in case
			const rawMessage = (chat.messageText || '').trim();
			if (!rawMessage)
				continue;

			const normalized = this.normalizeMessage(rawMessage);
			if (!normalized)
				continue;

			// Add to global recent list
			this.recentMessages.push({
				normalized,
				raw: rawMessage,
				ts: now,
			});

			// Trim global recentMessages to the watchWindow
			const cutoff = now - windowMs;
			this.recentMessages = this.recentMessages.filter(m => m.ts >= cutoff);

			// 1) First, see if this matches an existing pattern.
			const existingPattern = this.findMatchingPattern(normalized);
			if (existingPattern) {
				existingPattern.count++;
				existingPattern.ttl = windowSeconds; // reset TTL
				this.pushPatternsToSocket();
				continue;
			}

			// 2) If it doesn't match an existing pattern, see if it should CREATE one.
			const globalMatches = this.recentMessages.filter(m =>
				this.messagesMatch(normalized, m.normalized)
			);

			if (globalMatches.length >= minCount) {

				// New pattern detected
				this.patterns.push({
					word: normalized,
					count: globalMatches.length,
					ttl: windowSeconds,
				});
				this.pushPatternsToSocket();
			}
		}
	}


	// -------------------------------------------------------------------------
	// Pattern / TTL handling
	// -------------------------------------------------------------------------

	/**
	 * Called by setElectronInterval every second.
	 * Decrements TTLs and removes expired patterns.
	 */
	tickPatternTTLs() {

		if (!this.patterns.length)
			return;

		let changed = false;

		for (const pattern of this.patterns) {
			pattern.ttl -= 1;
			if (pattern.ttl < 0) pattern.ttl = 0;
		}

		const before = this.patterns.length;
		this.patterns = this.patterns.filter(p => p.ttl > 0);
		const after = this.patterns.length;

		if (before !== after) changed = true;

		if (changed) {
			this.pushPatternsToSocket();
		}
	}


	/**
	 * Push in-memory patterns to the socketShallowRef for the widget
	 */
	pushPatternsToSocket() {

		// Expose a copy so external code can't mutate internal references
		this.frequencyItems.value = this.patterns.map(p => ({
			word: p.word,
			count: p.count,
			ttl: p.ttl,
		}));
	}


	// -------------------------------------------------------------------------
	// Matching helpers
	// -------------------------------------------------------------------------

	/**
	 * Normalize message for comparison:
	 * - lowercase
	 * - strip punctuation
	 * - trim whitespace
	 */
	normalizeMessage(text) {
		return text
			.toLowerCase()
			// remove most punctuation, keep letters/numbers/spaces
			.replace(/[^\p{L}\p{N}\s]+/gu, '')
			.trim();
	}


	/**
	 * Check if two normalized messages "match" according to matchThreshold.
	 * @param {string} aNorm
	 * @param {string} bNorm
	 * @returns {boolean}
	 */
	messagesMatch(aNorm, bNorm) {

		if (!aNorm || !bNorm)
			return false;

		const threshold = this.settings.matchThreshold.value || 100;

		// Clamp to 50-100 just to be safe
		const clamped = Math.min(100, Math.max(50, threshold));

		// Exact only
		if (clamped === 100) {
			return aNorm === bNorm;
		}

		// Fuzzy using string-similarity
		const similarity = stringSimilarity.compareTwoStrings(aNorm, bNorm);
		const cutoff = clamped / 100;
		return similarity >= cutoff;
	}


	/**
	 * Find an existing pattern that matches this normalized message.
	 * @param {string} normalized
	 * @returns {Object|null}
	 */
	findMatchingPattern(normalized) {

		for (const p of this.patterns) {
			if (this.messagesMatch(normalized, p.word)) {
				return p;
			}
		}// next p

		return null;
	}
}
