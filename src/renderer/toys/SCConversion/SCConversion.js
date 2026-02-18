/*
	SCConversion.js
	---------------

	This toy handles YouTube Super Chat messages and converts them into 
	channel points for the user.
*/

// vue
import { ref } from 'vue';

// our app
import Toy from "../Toy";

// components
import Points4SCPage from './Points4SCPage.vue';

// main export
export default class SCConversion extends Toy {

	// static info
	static name = 'Points 4 SuperChats';
	static slug = 'scConversion';
	static desc = 'Handle any chat message, not commands. Convert YouTube Super Chats into channel points.';
	static optionsPageComponent = Points4SCPage;
	static themeColor = 'darkred';
	static widgetComponents = [];

	// This toy is a tool, not a traditional toy, since it doesn't directly interact with chat or have its own widget. Instead, it manages groups of other widgets.
	static isTool = true;

	/**
	 * Constructs the SCConversion object
	 * 
	 * @param {ToyManager} toyManager - reference to the toy manager
	 */
	constructor(toyManager) {

		// call the parent constructor
		super(toyManager);

		// Handle incoming chat messages
		this.handleNewChatsFN = this.handleNewChats.bind(this);
		this.chatToysApp.chatProcessor.onNewChats(this.handleNewChatsFN);
	}


	/**
	 * Clean up
	 */
	end() {
		super.end();
		this.chatToysApp.chatProcessor.removeNewChatsListener(this.handleNewChatsFN);
	}


	/**
	 * Initialize the settings for this toy
	 */
	initSettings() {

		// sc conversion settings
		this.buildSettingsBlock({
			enabled: ref(true),
			showPointsInChat: ref(true),
			tierSettings: ref([
				{ tier: 1, enabled: true, value: 500 },
				{ tier: 2, enabled: true, value: 1000 },
				{ tier: 3, enabled: true, value: 2000 },
				{ tier: 4, enabled: true, value: 5000 },
				{ tier: 5, enabled: true, value: 10000 },
				{ tier: 6, enabled: true, value: 20000 },
				{ tier: 7, enabled: true, value: 50000 },
			])
		});
	}


	/**
	 * Handle incoming chat messages
	 * 
	 * @param {Array<Object>} chats - array of new chat messages
	 */
	handleNewChats(chats) {

		// if the toy is not enabled, skip
		if (this.settings.enabled.value === false)
			return;

		// loop through each chat message
		for (const chat of chats) {

			// if the message is a super chat and has a color, process it
			if (chat.isSuper && chat.headerBackgroundColor !== undefined) {
				this.processSuperChat(chat);
			}
		}
	}


	/**
	 * Process a super chat message and award points
	 * 
	 * @param {Object} chat - the chat message object
	 */
	processSuperChat(chat) {

		// determine the tier from the color
		const result = superChatTierFromColor(chat.headerBackgroundColor);
		if (!result) return;

		// find the matching tier setting
		const tierConfig = this.settings.tierSettings.value.find(t => t.tier === result.tier);

		// if the tier is enabled, award points
		if (tierConfig && tierConfig.enabled) {

			const amount = tierConfig.value;

			// Update user points in the database
			window.ytctDB.updateUser(chat.authorUniqueID, {
				displayName: chat.author,
				streamID: chat.streamID,
				relativePoints: amount
			});

			// log to the system logger
			this.chatToysApp.log.msg(`Chatter ${chat.author} earned ${amount} for their super chat (Tier ${result.tier})`);

			// if showPointsInChat is enabled, log to the chat
			if (this.settings.showPointsInChat.value) {
				this.chatToysApp.log.info(`Chatter ${chat.author} earned ${amount} for their super chat!`);
			}
		}
	}

}

/**
 * Helper to get the super chat tier from a color input.
 * 
 * @param {Number|String|Object} input - color input
 * @returns {Object|null} - tier details or null if no match found
 */
export function superChatTierFromColor(input) {
	const tiers = [
		{ tier: 1, name: "blue", base: [0x15, 0x65, 0xC0], lo: [0x13, 0x5F, 0xB6], hi: [0x17, 0x6B, 0xCA] },
		{ tier: 2, name: "lightBlue", base: [0x00, 0xE5, 0xFF], lo: [0x00, 0xD9, 0xF2], hi: [0x00, 0xF1, 0xFF] },
		{ tier: 3, name: "green", base: [0x0F, 0x9D, 0x58], lo: [0x0E, 0x95, 0x52], hi: [0x10, 0xA5, 0x5E] },
		{ tier: 4, name: "yellow", base: [0xFF, 0xCA, 0x28], lo: [0xF2, 0xC0, 0x25], hi: [0xFF, 0xD4, 0x2B] },
		{ tier: 5, name: "orange", base: [0xF5, 0x7C, 0x00], lo: [0xE9, 0x74, 0x00], hi: [0xFF, 0x84, 0x00] },
		{ tier: 6, name: "magenta", base: [0xE9, 0x1E, 0x63], lo: [0xDD, 0x1C, 0x5D], hi: [0xF5, 0x1F, 0x69] },
		{ tier: 7, name: "red", base: [0xE6, 0x21, 0x17], lo: [0xDB, 0x1F, 0x15], hi: [0xF0, 0x22, 0x19] },
	];

	const rgb = parseToRgb255(input);

	for (const t of tiers) {
		if (
			inRange(rgb.r, t.lo[0], t.hi[0]) &&
			inRange(rgb.g, t.lo[1], t.hi[1]) &&
			inRange(rgb.b, t.lo[2], t.hi[2])
		) {
			return { tier: t.tier, name: t.name, matchedBy: "range", distance: 0, baseHex: rgbToHex(t.base) };
		}
	}

	let best = null;
	for (const t of tiers) {
		const d = distRgb(rgb, t.base);
		if (!best || d < best.distance) best = { tier: t.tier, name: t.name, matchedBy: "nearest", distance: d, baseHex: rgbToHex(t.base) };
	}
	return best;

	function inRange(v, lo, hi) {
		return v >= lo && v <= hi;
	}

	function distRgb(a, baseArr) {
		const dr = a.r - baseArr[0];
		const dg = a.g - baseArr[1];
		const db = a.b - baseArr[2];
		return Math.sqrt(dr * dr + dg * dg + db * db);
	}

	function rgbToHex(arr) {
		const h = (n) => n.toString(16).padStart(2, "0").toUpperCase();
		return `#${h(arr[0])}${h(arr[1])}${h(arr[2])}`;
	}

	function parseToRgb255(x) {
		if (typeof x === "number" && Number.isFinite(x)) {
			const v = x >>> 0;
			return {
				r: (v >>> 16) & 0xFF,
				g: (v >>> 8) & 0xFF,
				b: v & 0xFF,
			};
		}

		if (typeof x === "string") {
			const s = x.trim().replace(/^#/, "");
			if (!/^[0-9a-fA-F]{6}$/.test(s)) throw new Error(`Bad hex color string: "${x}"`);
			const v = parseInt(s, 16);
			return {
				r: (v >>> 16) & 0xFF,
				g: (v >>> 8) & 0xFF,
				b: v & 0xFF,
			};
		}

		if (x && typeof x === "object") {
			const rr = pickNumber(x.r, x.red);
			const gg = pickNumber(x.g, x.green);
			const bb = pickNumber(x.b, x.blue);

			const r = to255(rr);
			const g = to255(gg);
			const b = to255(bb);

			return { r, g, b };
		}

		throw new Error(`Unsupported color input: ${String(x)}`);

		function pickNumber(a, b) {
			const v = (a ?? b);
			const n = (typeof v === "string") ? Number(v) : v;
			if (!Number.isFinite(n)) throw new Error(`Missing/invalid channel value: ${String(v)}`);
			return n;
		}

		function to255(v) {
			const n = Number(v);
			const scaled = (n <= 1) ? Math.round(n * 255) : Math.round(n);
			if (!Number.isFinite(scaled)) throw new Error(`Invalid channel after scaling: ${String(v)}`);
			return clamp(scaled, 0, 255);
		}

		function clamp(n, lo, hi) {
			return n < lo ? lo : (n > hi ? hi : n);
		}
	}
}
