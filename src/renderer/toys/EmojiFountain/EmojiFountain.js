/*
	EmojiFountain.js
	----------------

	Emoji-based particle system Toy.

	- Listens to chat messages:
		- Ignores messages starting with "!"
		- When enableWildEmojis is true, any emojis in a normal chat
		  message will spawn a single particle each (in mode 'toss' or 'rain').

	- Responds to command system via onCommand:
		- commandSlug === 'rain'     -> !rain <emoji(s)>
		- commandSlug === 'fountain' -> !fountain <emoji(s)>
		- commandSlug === 'firework' -> !firework <emoji(s)>
		- Uses msg.emojis (must have at least one emoji).

	- Exposes particles via socketShallowRef so the widget can render
	  and use emojiCache.js to resolve blob URLs.

	Render note:
		- 'rain' | 'toss' | 'fountain' particles are rendered by the widget
		  as DOM elements driven by generated CSS @keyframes.
		- 'firework' particles are rendered separately on a <canvas> by the
		  FireworkCanvas sub-component (rocket launch -> burst that samples
		  the emoji's pixels to rebuild it, enlarged, out of colored sparks).
		  Firework particles therefore only carry launch/explosion geometry
		  and ignore the DOM-only fields (endX/endY/bounces/spinSpeed).

	Each particle:
	{
		id: string,
		url: string | null,
		char: string | null,
		type: 'rain' | 'toss' | 'fountain' | 'firework',
		createdAt: number,   // ms
		duration: number,    // seconds (total animation duration)
		delay: number,       // seconds (for CSS animation-delay if desired)
		startX: number,      // % (0-100)
		endX: number,        // % (0-100)
		apexX: number,       // % (0-100), for arcs / firework burst center X
		startY: number,      // %
		apexY: number,       // %  (firework: burst center Y)
		endY: number,        // %
		bounces: number,     // 0,1,2
		spinSpeed: number,   // deg/sec
		scale: number,       // emojiSize
		ttlMs: number,       // ms, slightly longer than duration

		// firework-only:
		launchDuration: number, // seconds for the rocket to reach apex
		explodeDuration: number // seconds for the burst to play out
	}
*/

// vue
import { ref, shallowRef } from 'vue';
import { socketShallowRef } from 'socket-ref';

// components
import EmojiFountainWidget from './EmojiFountainWidget.vue';
import EmojiFountainPage from './EmojiFountainPage.vue';

// our app
import Toy from '../Toy';

export default class EmojiFountain extends Toy {

	static name = 'Emoji Fountain';
	static slug = 'emojiFountain';
	static desc = 'Sprinkles chat emojis with fun physics-like animations.';
	static optionsPageComponent = EmojiFountainPage;
	static themeColor = '#50B5D1'; // 50B5D1
	static widgetComponents = [
		{
			component: EmojiFountainWidget,
			key: 'emojiFountainBox',
			allowResize: true,
			lockAspectRatio: false,
			description: 'Animated emoji fountain / rain / toss.',
			slug: 'emojiFountainWidget'
		},
	];


	/**
	 * @param {ToyManager} toyManager
	 */
	constructor(toyManager) {

		super(toyManager);

		// -----------------------
		// Socket state
		// -----------------------

		// Array of particles (see header comment for shape)
		this.particles = socketShallowRef(
			this.static.slugify('particles'),
			[]
		);

		// Track burst timeouts so we can clean them up on end()
		this.pendingTimeouts = new Set();

		// Simple ID counter
		this.nextId = 1;

		// Cached regex for unicode emoji detection
		this.unicodeEmojiRegex = null;

		// -----------------------
		// Chat hook
		// -----------------------

		this.handleChatMessage = this.handleChatMessage.bind(this);
		this.chatToysApp.chatProcessor.onNewChats(this.handleChatMessage);
	}


	end() {
		super.end();

		// Remove chat listener
		if (this.handleChatMessage) 
			this.chatToysApp.chatProcessor.removeNewChatsListener(this.handleChatMessage);		

		// Clear any pending burst timeouts
		for (const id of this.pendingTimeouts)
			window.clearElectronTimeout(id);
		
		this.pendingTimeouts.clear();
	}


	// ---------------------------------------------------------------------
	// Settings
	// ---------------------------------------------------------------------

	initSettings() {

		this.buildSettingsBlock({

			// Visual
			emojiSize: ref(1.0),				// CSS scale multiplier
			cacheEmojiImages: ref(true),		// widget handles caching via emojiCache.js

			// Counts
			rainCount: ref(12),					// !rain default
			fountainCount: ref(12),				// !fountain default
			fireworkCount: ref(5),				// !firework default (# of rockets)
			fireworkDetail: ref(18),			// firework sampling grid (NxN)
			fireworkParticleScale: ref(1.0),	// spark size multiplier (on top of detail sizing)
			fireworkFallSpeed: ref(1.0),		// gravity multiplier for falling sparks
			fireworkFallDuration: ref(1.4),		// seconds from burst peak until sparks shrink to 0
			maxCount: ref(200),					// max particles alive

			// Behavior
			enableWildEmojis: ref(true),		// wild emoji scanning on/off
			speed: ref(1.0),					// >1 faster, <1 slower
			mode: ref('toss'),					// 'toss' | 'rain' for wild emojis

			// Widget placement box
			emojiFountainBox: shallowRef({
				x: 0,
				y: 0,
				width: 1280,
				height: 720
			})
		});
	}


	/**
	 * Initialize the commands for this toy
	 */
	buildCommands() {

		super.buildCommands([
			{
				command: 'rain',
				params: [
					{ name: 'message', type: 'string', optional: false, desc: 'Message with Emojis to rain' },
				],
				description: 'Chatter can cause a rain of emojis from their message',
				userDesc: 'Make it rain - emojis!',
				tipText: 'Use {cmd} with any emojis in your message and watch them rain down',
			},
			{
				command: 'fountain',
				params: [
					{ name: 'message', type: 'string', optional: false, desc: 'Message with Emojis to burst' },
				],
				description: 'Chatter can cause a fountain of emojis from their message',
				userDesc: 'Sprout a fountain of emojis!',
				tipText: 'Use {cmd} with any emojis to shoot them up like a fountain',
			},
			{
				command: 'firework',
				params: [
					{ name: 'message', type: 'string', optional: false, desc: 'Message with Emojis to launch as fireworks' },
				],
				description: 'Chatter launches their emoji as a rocket that bursts into a giant version of itself made of colored sparks',
				userDesc: 'Launch emoji fireworks!',
				tipText: 'Use {cmd} with any emoji to launch it as a firework that explodes into a giant version of itself',
			}
		]);
	}


	// ---------------------------------------------------------------------
	// Emoji extraction (custom + unicode)
	// ---------------------------------------------------------------------

	/**
	 * Lazily build / return a regex that matches unicode emoji-ish codepoints.
	 * Uses \p{Extended_Pictographic} when available, falls back to a range.
	 */
	getUnicodeEmojiRegex() {

		if (this.unicodeEmojiRegex)
			return this.unicodeEmojiRegex;

		try {
			// Modern engines (Chromium / Electron) should support this.
			this.unicodeEmojiRegex = new RegExp('\\p{Extended_Pictographic}', 'gu');
		}
		catch (e) {
			// Fallback: BMP + SMP emoji blocks, not perfect but pretty good.
			this.unicodeEmojiRegex = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu;
		}

		return this.unicodeEmojiRegex;
	}


	/**
	 * Build a combined emoji list from:
	 * - msg.emojis (custom image emojis from Twitch / YouTube)
	 * - unicode emoji glyphs found directly in messageText
	 *
	 * Returns array of entries like:
	 *  { kind: 'image', url, code? }
	 *  { kind: 'unicode', char }
	 *
	 * @param {Object} msg
	 * @returns {Array<Object>}
	 */
	extractEmojisFromMsg(msg) {

		const result = [];

		if (!msg)
			return result;

		// 1) Custom / platform emojis (already normalized by chat processor)
		const customEmojis = Array.isArray(msg.emojis) ? msg.emojis : [];

		for (const e of customEmojis) {
			if (!e || !e.url)
				continue;

			// Check if we have multiple positions for this emoji (e.g. Twitch sends positions)
			const occurrences = (Array.isArray(e.pos) && e.pos.length > 0) ? e.pos.length : 1;

			for (let i = 0; i < occurrences; i++) {
				result.push({
					kind: 'image',
					url: e.url,
					code: e.code || null,
					// keep a reference if we ever care about more fields later
					_original: e,
				});
			}
		}

		// 2) Unicode emojis directly in the message text
		const text = (msg.messageText || '').trim();
		if (text) {
			const re = this.getUnicodeEmojiRegex();
			re.lastIndex = 0;

			let m;
			while ((m = re.exec(text)) !== null) {

				const ch = m[0];
				if (!ch)
					continue;

				result.push({
					kind: 'unicode',
					char: ch,
					_original: null,
				});

			}// next match
		}

		return result;
	}


	// ---------------------------------------------------------------------
	// Command entry point (from central command system)
	// ---------------------------------------------------------------------

	/**
	 * Called by the global command system when a command that this Toy
	 * is interested in should be handled.
	 *
	 * @param {String} commandSlug
	 * @param {Object} msg       - chat message object (includes .emojis)
	 * @param {Object} user      - user object (channel points, etc.)
	 * @param {Object} params    - parsed command params
	 * @param {Object} handshake - has .accept() and usually .reject()
	 */
	onCommand(commandSlug, msg, user, params, handshake) {

		// Combined emojis: platform images + unicode glyphs
		const emojis = this.extractEmojisFromMsg(msg);

		// Helper to early-reject if we somehow got no emojis
		const ensureEmojis = () => {
			if (emojis.length > 0) 
				return true;

			// Safety: always reject here
			handshake.reject('EmojiFountain: command requires at least one emoji.');
			return false;
		};

		// !rain <emoji(s)>
		if (commandSlug === 'rain') {

			if (!ensureEmojis())
				return;

			const count = this.settings.rainCount.value || 12;
			if (count > 0) {
				// Spread over ~2 seconds
				// Use the actual emoji count from message if it's more than default
				const finalCount = Math.max(count, emojis.length);
				this.spawnBurst('rain', emojis, finalCount, 2000);
			}

			handshake.accept();
			return;
		}

		// !fountain <emoji(s)>
		if (commandSlug === 'fountain') {

			if (!ensureEmojis())
				return;

			const count = this.settings.fountainCount.value || 12;
			if (count > 0) {
				// Spread over ~2.5 seconds
				const finalCount = Math.max(count, emojis.length);
				this.spawnBurst('fountain', emojis, finalCount, 2500);
			}

			handshake.accept();
			return;
		}

		// !firework <emoji(s)>
		if (commandSlug === 'firework') {

			if (!ensureEmojis())
				return;

			const count = this.settings.fireworkCount.value || 5;
			if (count > 0) {
				// Spread the rocket launches over ~1.6 seconds so they go up
				// in a staggered volley rather than all at once.
				const finalCount = Math.max(count, emojis.length);
				this.spawnBurst('firework', emojis, finalCount, 1600);
			}

			handshake.accept();
			return;
		}
	}


	// ---------------------------------------------------------------------
	// Chat handling (wild emojis only)
	// ---------------------------------------------------------------------

	/**
	 * Handle when a new chat message comes in.
	 *
	 * @param {Array<Object>} chats - list of new chat messages
	 */
	handleChatMessage(chats) {

		// GTFO if we don't do wild emojis
		if (!this.settings.enableWildEmojis.value)
			return;

		for (const chat of chats) {

			const rawMessage = (chat.messageText || '').trim();

			// Ignore commands entirely to avoid double-spawning for !rain/!fountain
			if (rawMessage.startsWith('!'))
				continue;

			// Extract combined emojis (custom + unicode)
			const emojis = this.extractEmojisFromMsg(chat);

			// No emojis, no fun
			if (!emojis.length)
				continue;

			const mode = (this.settings.mode.value === 'rain') ? 'rain' : 'toss';

			const newParticles = [];
			for (const emoji of emojis) {
				const p = this.createParticle(mode, emoji);
				if (p) newParticles.push(p);
			}
			
			if (newParticles.length > 0)
				this.addParticles(newParticles);
			
		}// next chat

	}


	// ---------------------------------------------------------------------
	// Spawning logic
	// ---------------------------------------------------------------------

	/**
	 * Spawn a burst of particles over time (staggered).
	 *
	 * @param {'rain'|'toss'|'fountain'} type
	 * @param {Array<Object>} emojis
	 * @param {number} count
	 * @param {number} spreadMs - total spread window for the whole burst
	 */
	spawnBurst(type, emojis, count, spreadMs) {

		if (!emojis || !emojis.length || count <= 0)
			return;

		const step = count > 1 ? (spreadMs / (count - 1)) : 0;

		for (let i = 0; i < count; i++) {
			const delayMs = step * i;
			const emoji = emojis[i % emojis.length];

			const timeoutId = window.setElectronTimeout(() => {
				this.pendingTimeouts.delete(timeoutId);
				const p = this.createParticle(type, emoji);
				if (p) this.addParticles([p]);
			}, delayMs);

			this.pendingTimeouts.add(timeoutId);
		
		}// next i

	}


	/**
	 * Creates a single emoji particle data object (without adding it to state).
	 *
	 * @param {'rain'|'toss'|'fountain'} type
	 * @param {{ kind: 'image'|'unicode', url?: string, char?: string }} emoji
	 * @returns {Object|null}
	 */
	createParticle(type, emoji) {

		if (!emoji)
			return null;

		// Must have either a url (image emoji) or char (unicode emoji)
		const hasUrl = !!emoji.url;
		const hasChar = !!emoji.char;
		if (!hasUrl && !hasChar)
			return null;

		const speed = this.safeSpeed();
		const scale = this.settings.emojiSize.value || 1.0;

		let particle;
		switch (type) {
			case 'rain':
				particle = this.makeRainParticle(emoji, speed, scale);
				break;
			case 'fountain':
				particle = this.makeFountainParticle(emoji, speed, scale);
				break;
			case 'firework':
				particle = this.makeFireworkParticle(emoji, speed, scale);
				break;
			case 'toss':
			default:
				particle = this.makeTossParticle(emoji, speed, scale);
				break;
		}

		return particle;
	}


	/**
	 * Batch add particles to the socket array, enforcing maxCount and TTL.
	 * 
	 * @param {Array<Object>} newParticles - list of particles to add
	 */
	addParticles(newParticles) {

		const maxCount = this.settings.maxCount.value || 200;
		const now = Date.now();

		for (const particle of newParticles) {
			const ttlMs = particle.duration * 1000 * 1.3;
			particle.ttlMs = ttlMs;
			particle.createdAt = now;
			// ENSURE UNIQUE ID
			particle.id = this.nextParticleId();
		}

		let arr = this.particles.value || [];

		// Cull expired
		arr = arr.filter(p => {
			if (!p.ttlMs || !p.createdAt) return true;
			return (now - p.createdAt) < p.ttlMs;
		});

		// Add new ones
		arr = [...arr, ...newParticles];

		// Enforce maxCount (drop oldest)
		if (arr.length > maxCount) {
			arr = arr.slice(-maxCount);
		}

		this.particles.value = arr;
	}


	/**
	 * Spawn a single emoji particle of the given type (Legacy wrapper).
	 *
	 * @param {'rain'|'toss'|'fountain'} type
	 * @param {Object} emoji
	 */
	spawnSingleEmoji(type, emoji) {
		const p = this.createParticle(type, emoji);
		if (p) this.addParticles([p]);
	}


	// ---------------------------------------------------------------------
	// Particle factories (physics-ish parameters)
	// ---------------------------------------------------------------------

	/**
	 * A normalized "gravity" world:
	 *  - Vertical 0 (top) to 1 (bottom).
	 *  - We derive animation durations from vertical distance using sqrt(distance)
	 *    to feel like gravity; higher arcs take proportionally more time.
	 */

	safeSpeed() {
		const s = this.settings.speed.value;
		return (s && s > 0) ? s : 1.0;
	}

	nextParticleId() {
		return `${this.constructor.slug}_${this.nextId++}`;
	}

	randomRange(min, max) {
		return Math.random() * (max - min) + min;
	}

	clamp(v, min, max) {
		return v < min ? min : v > max ? max : v;
	}


	/**
	 * Rain: freefall from near top to bottom, small horizontal drift, 1–2 bounces.
	 * Duration based on vertical distance so it feels like consistent gravity.
	 *
	 * @param {Object} emoji - { url?: string, char?: string }
	 */
	makeRainParticle(emoji, speed, scale) {

		// Normalized Y positions (0 top, 1 bottom)
		const startYNorm = -0.2;		// -20% (off top)
		const endYNorm = 1.1;			// 110% (below bottom)
		const distance = endYNorm - startYNorm; // ~1.3

		// Base freefall time constant
		const baseTime = 1.3;			// seconds for distance ~1
		let duration = baseTime * Math.sqrt(distance);

		// Bounces
		const bounces = Math.random() < 0.5 ? 1 : 2;
		const bounceExtra = bounces * 0.25;
		duration += bounceExtra;

		// Apply speed multiplier (higher speed => shorter duration)
		duration = duration / speed;

		// Positions in %
		const startX = Math.random() * 100;
		const endX = this.clamp(startX + this.randomRange(-15, 15), 0, 100);

		return {
			id: this.nextParticleId(),
			url: emoji.url || null,
			char: emoji.char || null,
			type: 'rain',

			duration,
			delay: 0,

			startX,
			endX,
			apexX: (startX + endX) / 2,		// widget may ignore for rain

			startY: startYNorm * 100,
			apexY: 100,						// "ground" for bounces
			endY: endYNorm * 100,

			bounces,
			spinSpeed: this.randomRange(60, 180) * (Math.random() < 0.5 ? -1 : 1),
			scale
		};
	}


	/**
	 * Toss: spawn near bottom at random X, arc up to random apex, fall offscreen.
	 * No bounces; duration scales with arc height using sqrt(distance).
	 *
	 * @param {Object} emoji - { url?: string, char?: string }
	 */
	makeTossParticle(emoji, speed, scale) {

		const startYNorm = 1.05;				// just below bottom
		const endYNorm = 1.15;					// further below bottom
		const apexYNorm = this.randomRange(0.1, 0.5);	// 10%–50% (various heights)

		// Vertical distances (up + down)
		const upDistance = startYNorm - apexYNorm;
		const downDistance = endYNorm - apexYNorm;
		const distance = upDistance + downDistance;

		// Base time for "full" arc
		const baseTime = 1.2;
		let duration = baseTime * Math.sqrt(distance);

		// Apply speed
		duration = duration / speed;

		// Horizontal positions
		const startX = Math.random() * 100;
		const endX = this.clamp(startX + this.randomRange(-25, 25), 0, 100);
		const apexX = this.clamp((startX + endX) / 2 + this.randomRange(-10, 10), 0, 100);

		return {
			id: this.nextParticleId(),
			url: emoji.url || null,
			char: emoji.char || null,
			type: 'toss',

			duration,
			delay: 0,

			startX,
			endX,
			apexX,

			startY: startYNorm * 100,
			apexY: apexYNorm * 100,
			endY: endYNorm * 100,

			bounces: 0,
			spinSpeed: this.randomRange(120, 360) * (Math.random() < 0.5 ? -1 : 1),
			scale
		};
	}


	/**
	 * Fountain: always from bottom center (x = 50%), arc up to random height,
	 * then down with 1–2 bounces. Duration scales with arc height similarly
	 * to toss, plus extra time for bounces.
	 *
	 * @param {Object} emoji - { url?: string, char?: string }
	 */
	makeFountainParticle(emoji, speed, scale) {

		// Start at bottom-center
		const startX = 50;
		const startYNorm = 1.05;
		const endYNorm = 1.2;

		// Random apex height
		const apexYNorm = this.randomRange(0.1, 0.5);
		const upDistance = startYNorm - apexYNorm;
		const downDistance = endYNorm - apexYNorm;
		const distance = upDistance + downDistance;

		// Base time for fountain arcs
		const baseTime = 1.1;
		let duration = baseTime * Math.sqrt(distance);

		// Bounces
		const bounces = Math.random() < 0.5 ? 1 : 2;
		const bounceExtra = bounces * 0.3;
		duration += bounceExtra;

		// Apply speed
		duration = duration / speed;

		// Spread horizontally from center
		const spread = this.randomRange(15, 40);
		const direction = Math.random() < 0.5 ? -1 : 1;
		const endX = this.clamp(startX + spread * direction, 0, 100);
		const apexX = this.clamp(startX + (spread * 0.5 * direction), 0, 100);

		return {
			id: this.nextParticleId(),
			url: emoji.url || null,
			char: emoji.char || null,
			type: 'fountain',

			duration,
			delay: 0,

			startX,
			endX,
			apexX,

			startY: startYNorm * 100,
			apexY: apexYNorm * 100,
			endY: endYNorm * 100,

			bounces,
			spinSpeed: this.randomRange(90, 240) * (Math.random() < 0.5 ? -1 : 1),
			scale
		};
	}


	/**
	 * Firework: a rocket launches from a random spot along the bottom, flies up
	 * to a random apex, then bursts. The actual rocket flight, transition flash
	 * and pixel-sampled explosion are all drawn on a <canvas> by
	 * FireworkCanvas.vue - this factory only supplies the launch/burst geometry
	 * and timing. DOM-only fields (endX/endY/bounces/spinSpeed) are left at inert
	 * defaults since the canvas renderer ignores them.
	 *
	 * @param {Object} emoji - { url?: string, char?: string }
	 * @param {number} speed - global speed multiplier (>1 faster)
	 * @param {number} scale - emojiSize multiplier
	 * @returns {Object} firework particle
	 */
	makeFireworkParticle(emoji, speed, scale) {

		// Launch x somewhere across the lower portion of the screen
		const startX = this.randomRange(12, 88);

		// Burst center: drift slightly from launch x, random height in the
		// upper-middle of the screen (smaller % = higher up).
		const apexYNorm = this.randomRange(0.18, 0.46);
		const apexX = this.clamp(startX + this.randomRange(-10, 10), 6, 94);

		// Rocket flight time scales with how high it climbs (feels like thrust),
		// the burst gets a fixed-ish window to bloom and fade.
		const climb = 1.05 - apexYNorm;					// 0..~0.87
		let launchDuration = (0.85 + climb * 0.9) / speed;	// ~0.9s .. ~1.6s
		let explodeDuration = 1.9 / speed;					// burst + fade window

		return {
			id: this.nextParticleId(),
			url: emoji.url || null,
			char: emoji.char || null,
			type: 'firework',

			duration: launchDuration + explodeDuration,
			delay: 0,

			startX,
			endX: startX,
			apexX,

			startY: 105,					// just below the bottom edge
			apexY: apexYNorm * 100,			// burst center Y (%)
			endY: 105,

			bounces: 0,
			spinSpeed: 0,
			scale,

			// firework-only timing (seconds)
			launchDuration,
			explodeDuration
		};
	}

}
