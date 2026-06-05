/*
	Donations.js
	------------

	On-screen donation popup. Reacts to two event sources:
	  - YouTube super chats (chat.isSuper, tier resolved by the SC header
	    color via SCConversion.superChatTierFromColor)
	  - Twitch bits cheers (chat.bits, tier resolved by the streamer's
	    per-tier `bitsThreshold` table - tier = the highest one whose
	    threshold is <= the cheer amount)

	Tiers are a fixed 7-row set matching YouTube's super chat tiers. Each
	row carries: enabled flag, label, bits threshold (used for cheer-to-tier
	mapping), image asset id (popped up on screen during the dono), sound
	asset id (played once when the dono enters).

	Donos are queued via StateTickerQueue so back-to-back events play
	sequentially rather than stomping each other. Image + sound URLs are
	resolved on the toy side via getAssetPath so the widget receives ready-
	to-load URLs.
*/

import { ref, shallowRef } from 'vue';
import { socketShallowRef } from 'socket-ref';
import { v4 as uuidv4 } from 'uuid';

import Toy from '../Toy';
import { StateTickerQueue } from '@scripts/StateTickerQueue';
import { superChatTierFromColor } from '../SCConversion/SCConversion';

import DonationsPage from './DonationsPage.vue';
import DonationsWidget from './DonationsWidget.vue';


/**
 * Hard-coded display colors for each tier so the widget can pick an accent
 * without re-querying SCConversion. Tier numbers (1..7) map to the same
 * colors YouTube uses for super-chat headers; the order matches the
 * `tierSettings` array indices.
 */
const TIER_COLORS = [
	null,         // index 0 unused (tiers are 1-indexed)
	'#1565C0',    // 1: blue
	'#00E5FF',    // 2: light blue
	'#0F9D58',    // 3: green
	'#FFCA28',    // 4: yellow
	'#F57C00',    // 5: orange
	'#E91E63',    // 6: magenta
	'#E62117',    // 7: red
];


/** Wait this long between back-to-back donos (so each one has a clean entry). */
const QUEUE_GAP_SECONDS = 1;


export default class Donations extends Toy {

	static name = 'Donations Popup';
	static slug = 'donations';
	static desc = 'On-screen popup for YouTube super chats and Twitch bits cheers, with per-tier images and sounds.';
	static optionsPageComponent = DonationsPage;
	static themeColor = '#E62117';
	static widgetComponents = [
		{
			component: DonationsWidget,
			key: 'widgetBox',
			allowResize: true,
			lockAspectRatio: false,
			description: 'The popup that appears when a super chat or bits cheer arrives.',
			slug: 'popup',
		},
	];

	// Tools tab: no chat commands, only reacts to chat events.
	static toyClass = 'tool';

	// Marks this toy as omni-includable + names its alert-eligible widget.
	static isAlertToy = true;
	static alertWidgetSlug = 'popup';


	/**
	 * @param {import('../../scripts/ToyManager').ToyManager} toyManager
	 */
	constructor(toyManager) {

		super(toyManager);

		// State published to the widget. Null when nothing is playing; an
		// object payload while a dono is on screen.
		this.currentDono = socketShallowRef(this.static.slugify('currentDono'), null);

		// Queue: defaultWait = QUEUE_GAP_SECONDS between items, default
		// duration falls back to settings.displaySeconds when an item omits
		// its own duration. Tick comes from the main-driven electronAPI.tick.
		// canFire gates on the Omni registry so when this toy is included
		// in an omni group, dono popups serialize behind whatever else is
		// currently showing in that omni.
		this.queue = new StateTickerQueue(
			this.handleQueue.bind(this),
			QUEUE_GAP_SECONDS,
			this.settings.displaySeconds.value || 8,
			{ canFire: () => !this.chatToysApp.omniRegistry.isBlocking(this.slug) }
		);
		this.tickFN = () => this.queue.tick();
		electronAPI.tick(this.tickFN);

		// Subscribe to the chat stream. Same hook SCConversion uses.
		this.handleNewChatsFN = this.handleNewChats.bind(this);
		this.chatToysApp.chatProcessor.onNewChats(this.handleNewChatsFN);
	}


	/**
	 * Initial settings. 7-row tier table with sensible bits-threshold
	 * defaults matching common Twitch bits price points (100, 500, 1k, 5k,
	 * 10k, 25k, 50k). Streamer can edit per-row.
	 */
	initSettings() {

		this.buildSettingsBlock({

			displaySeconds: ref(8),
			showUsername: ref(true),
			showMessage: ref(true),

			// Card chrome - matches the Help toy's settings shape so the
			// streamer has a consistent way to style overlay surfaces.
			bgColor: ref('#0F0F0F'),
			bgOpacity: ref(0.92),
			borderColor: ref('#E62117'),
			borderOpacity: ref(1.0),
			borderWidth: ref(2),

			// 7 tiers. Image / sound IDs default to '' (unset); the widget
			// gracefully skips rendering when an asset isn't configured.
			tierSettings: shallowRef([
				{ tier: 1, enabled: true, label: 'Tier 1', bitsThreshold: 100,   imageId: '', soundId: '' },
				{ tier: 2, enabled: true, label: 'Tier 2', bitsThreshold: 500,   imageId: '', soundId: '' },
				{ tier: 3, enabled: true, label: 'Tier 3', bitsThreshold: 1000,  imageId: '', soundId: '' },
				{ tier: 4, enabled: true, label: 'Tier 4', bitsThreshold: 5000,  imageId: '', soundId: '' },
				{ tier: 5, enabled: true, label: 'Tier 5', bitsThreshold: 10000, imageId: '', soundId: '' },
				{ tier: 6, enabled: true, label: 'Tier 6', bitsThreshold: 25000, imageId: '', soundId: '' },
				{ tier: 7, enabled: true, label: 'Tier 7', bitsThreshold: 50000, imageId: '', soundId: '' },
			]),

			// Text settings (consumed by SettingsTextRow / TextSettingsModal).
			usernameColor: ref('#FFCA28'),
			messageColor: ref('#FFFFFF'),
			textSize: ref(28),
			textShadow: ref(true),

			widgetBox: shallowRef({
				x: (1280 / 2) - (520 / 2),
				y: 120,
				width: 520,
				height: 240,
			}),
		});
	}


	/** Text-settings descriptor for the consolidated text-style modal. */
	static textSettings = [
		{
			groupKey: 'dono',
			groupLabel: 'Donation Text',
			groupDescription: 'Style for the username and message text shown in the donation popup.',
			fields: [
				{ key: 'usernameColor', label: 'Username color', type: 'color' },
				{ key: 'messageColor',  label: 'Text color',     type: 'color' },
				{ key: 'textSize',      label: 'Font size',      type: 'number', min: 8, max: 96 },
				{ key: 'textShadow',    label: 'Text shadow',    type: 'boolean' },
			],
			defaults: {
				usernameColor: '#FFCA28',
				messageColor:  '#FFFFFF',
				textSize:      28,
				textShadow:    true,
			},
		},
	];


	/** No chat commands on the Donations toy. */
	buildCommands() {
		super.buildCommands([]);
	}


	/**
	 * Map a Twitch bits amount to a tier number via the streamer's threshold
	 * table. Returns the highest tier whose `bitsThreshold` is <= the cheer
	 * amount; 0 if the cheer is below tier 1's threshold.
	 *
	 * @param {number} bits
	 * @returns {number}
	 */
	tierFromBits(bits) {
		const tiers = this.settings.tierSettings.value || [];
		let match = 0;
		for (const t of tiers) {
			if (typeof t.bitsThreshold !== 'number') continue;
			if (bits >= t.bitsThreshold && t.tier > match) match = t.tier;
		}
		return match;
	}


	/**
	 * Look up a tier's config row by tier number.
	 *
	 * @param {number} tier
	 * @returns {?Object}
	 */
	getTierConfig(tier) {
		const tiers = this.settings.tierSettings.value || [];
		return tiers.find(t => t.tier === tier) || null;
	}


	/**
	 * Handle incoming chat messages. Filters down to dono-relevant events
	 * (super chats + bits cheers), maps to a tier, and queues a popup.
	 *
	 * @param {Array<Object>} chats - the chat batch from chatProcessor
	 */
	handleNewChats(chats) {
		for (const chat of chats) {

			let tier = 0;

			// YouTube super chat: SC header color carries the tier directly.
			if (chat.isSuper && chat.headerBackgroundColor !== undefined) {
				const result = superChatTierFromColor(chat.headerBackgroundColor);
				if (result) tier = result.tier;
			}
			// Twitch bits: cheer amount mapped through the streamer's
			// threshold table.
			else if (typeof chat.bits === 'number' && chat.bits > 0) {
				tier = this.tierFromBits(chat.bits);
			}

			if (tier <= 0) continue;

			const cfg = this.getTierConfig(tier);
			if (!cfg || !cfg.enabled) continue;

			this.enqueueDono(chat, tier, cfg);
		}
	}


	/**
	 * Build a wire-ready dono payload and push it onto the queue.
	 *
	 * @param {Object} chat - the source chat message
	 * @param {number} tier
	 * @param {Object} cfg - the tier config row
	 */
	enqueueDono(chat, tier, cfg) {

		const imageUrl = cfg.imageId ? this.getAssetPath(cfg.imageId) : '';
		const soundUrl = cfg.soundId ? this.getAssetPath(cfg.soundId) : '';

		this.queue.addToQueue({
			id: uuidv4(),
			tier,
			tierColor: TIER_COLORS[tier] || this.static.themeColor,
			label: cfg.label || `Tier ${tier}`,
			username: chat.author || '',
			message: chat.messageText || '',
			bits: typeof chat.bits === 'number' ? chat.bits : 0,
			imageUrl,
			soundUrl,
			t: Date.now(),
			duration: this.settings.displaySeconds.value || 8,
		});

		this.chatToysApp.log.msg(
			`${chat.author || 'someone'} popped a Tier ${tier} donation` +
			(chat.bits ? ` (${chat.bits} bits)` : '')
		);
	}


	/**
	 * StateTickerQueue callback. Called with the next queued item when one
	 * starts playing, and with `null` between items (gap period). The widget
	 * watches `currentDono` and animates / plays sound based on what it sees.
	 *
	 * @param {?Object} item
	 */
	handleQueue(item) {
		if (item === null) {
			this.currentDono.value = null;
			return;
		}
		this.currentDono.value = { ...item };
	}


	/**
	 * Streamer-facing test helper: simulate a Tier-N dono so the streamer
	 * can verify styling / images / sounds without waiting for a real dono.
	 *
	 * @param {number} tier
	 */
	simulateDono(tier) {
		const cfg = this.getTierConfig(tier);
		if (!cfg) return;
		this.enqueueDono(
			{
				author: 'TestViewer',
				messageText: `Test message for tier ${tier}`,
				bits: cfg.bitsThreshold || 0,
			},
			tier,
			cfg
		);
	}


	/**
	 * Whether a donation popup is currently on screen. Used by the Omni
	 * registry to gate other included toys.
	 *
	 * @returns {boolean}
	 */
	isShowing() {
		return this.currentDono.value !== null;
	}


	/** Cleanup. */
	end() {
		super.end();
		electronAPI.clearTick(this.tickFN);
		this.chatToysApp.chatProcessor.removeNewChatsListener(this.handleNewChatsFN);
		this.currentDono.value = null;
	}
}
