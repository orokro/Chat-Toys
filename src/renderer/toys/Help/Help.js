/*
	Help.js
	-------

	Periodically surfaces a "tip" describing how to use one of the chat-toys
	commands. Lives in the Tools tab (no chat commands of its own); the only
	thing chatters see is the widget popping in/out on stream.

	Tip selection (runs on every interval tick):
	  1. Iterate enabled toys via chatToysApp.toyManager.toys.
	  2. For each toy, check its widgets' keep-alive heartbeats (via the
	     `live-state-<toySlug>-<widgetSlug>` socket refs). A toy counts as
	     active if ANY of its widgets has reported in within the last 10s.
	  3. From active toys, collect (toy, command) pairs where the command is
	     enabled and has a non-empty `tipText` descriptor.
	  4. Subtract anything in the recent-tip ring buffer.
	  5. If the resulting pool is empty: reset the buffer and rebuild without
	     the recency filter.
	  6. If still empty (no active toys with tip-eligible commands): skip the
	     tick - nothing useful to say.
	  7. Pick one uniformly at random. Substitute {cmd} -> the current
	     (possibly streamer-renamed) command name. Publish over the
	     `currentTip` socket ref so the widget can animate it in.
	  8. Schedule a setElectronTimeout to clear `currentTip` after
	     `displaySeconds`.

	Timing uses setElectronInterval / setElectronTimeout so the main app
	window minimising or backgrounding doesn't throttle the rotation.
*/

import { ref, shallowRef, watch } from 'vue';
import { socketShallowRef, socketShallowRefReadOnly } from 'socket-ref';

import Toy from '../Toy';
import HelpPage from './HelpPage.vue';
import HelpWidget from './HelpWidget.vue';


/** How many recent tip IDs to remember (prevents back-to-back duplicates). */
const RECENT_TIP_BUFFER = 10;

/** Widget keep-alive freshness threshold, matches WidgetRow.vue. */
const LIVE_STALENESS_MS = 10 * 1000;


export default class Help extends Toy {

	static name = 'Help Tips';
	static slug = 'help';
	static desc = 'Periodically surfaces tips on screen showing chatters how to use your toys.';
	static optionsPageComponent = HelpPage;
	static themeColor = '#FFCA28';
	static widgetComponents = [
		{
			component: HelpWidget,
			key: 'widgetBox',
			allowResize: true,
			lockAspectRatio: false,
			description: 'The slide-in tip card that periodically shows on stream.',
			slug: 'tipCard',
		},
	];

	// Tools tab in the UI (alongside OutputLog, SCConversion, Donations).
	static isTool = true;


	/**
	 * @param {import('../../scripts/ToyManager').ToyManager} toyManager
	 */
	constructor(toyManager) {

		super(toyManager);

		// Live state published to the widget.
		this.currentTip = socketShallowRef(this.static.slugify('currentTip'), null);

		// Per-(toy, widget) keep-alive ref cache. Each entry is a
		// socketShallowRefReadOnly; we create them lazily as tips are
		// evaluated and reuse forever. Yes this is one WebSocket per
		// (toy, widget) pair - same socket-per-ref cost flagged in
		// misc/architecture-notes.md, applies here too.
		/** @type {Map<string, import('vue').ComputedRef<string>>} */
		this.liveStateRefs = new Map();

		// Ring buffer of recent tip IDs (e.g. 'prizeWheel:spin') so the same
		// tip doesn't reappear immediately.
		/** @type {Array<string>} */
		this.recentTipIds = [];

		// Internal timer handles.
		this.tickInterval = null;
		this.hideTimeout = null;

		// Pre-create live-state refs for every registered toy + widget pair
		// so they have time to connect + receive their current heartbeat
		// value before the first tick reads them. Without this, the first
		// "Show Tip Now" press after enabling the toy reads stale defaults
		// ('U_0', timestamp 0) and considers every toy not-live -> no tip.
		this.preCreateLiveStateRefs();

		this.startTipRotation();

		// Restart the rotation if the streamer edits the interval so the
		// change is live (otherwise they'd have to disable/re-enable the toy).
		this.stopIntervalWatch = watch(this.settings.intervalSeconds, () => {
			this.startTipRotation();
		});
	}


	/**
	 * Eagerly instantiate the live-state socket refs for every registered
	 * toy's widgets. Idempotent (the `liveStateRefs` cache short-circuits
	 * duplicates). Iterates `chatToysApp.toysData` (the static registry)
	 * rather than `toyManager.toys` so we cover even toys not yet enabled
	 * - if the streamer enables one later, its ref is already standing by.
	 */
	preCreateLiveStateRefs() {
		const registry = this.chatToysApp?.toysData || [];
		for (const ToyClass of registry) {
			if (!ToyClass || ToyClass === this.constructor) continue;
			const widgets = ToyClass.widgetComponents || [];
			for (const w of widgets) {
				this.getLiveStateRef(ToyClass.slug, w.slug);
			}
		}
	}


	/**
	 * Initial settings. Defaults match the proposal: 2-minute interval,
	 * 10-second display, slide in from the bottom, dark translucent card.
	 */
	initSettings() {

		this.buildSettingsBlock({
			intervalSeconds: ref(120),
			displaySeconds: ref(10),
			slideDirection: ref('bottom'),

			// Background panel
			bgColor: ref('#000000'),
			bgOpacity: ref(0.85),

			// Border
			borderColor: ref('#FFCA28'),
			borderOpacity: ref(1.0),
			borderWidth: ref(2),

			// Standard text-style settings consumed by SettingsTextRow / TextSettingsModal.
			textColor: ref('#FFFFFF'),
			textSize: ref(22),
			textShadow: ref(true),

			widgetBox: shallowRef({
				x: 0,
				y: 720 - 180,
				width: 1280,
				height: 180,
			}),
		});
	}


	/** Text settings descriptor for the consolidated text-settings modal. */
	static textSettings = [
		{
			groupKey: 'tip',
			groupLabel: 'Tip Text',
			groupDescription: 'Style for the tip text shown on the help card.',
			fields: [
				{ key: 'textColor',  label: 'Text color',  type: 'color' },
				{ key: 'textSize',   label: 'Font size',   type: 'number', min: 8, max: 96 },
				{ key: 'textShadow', label: 'Text shadow', type: 'boolean' },
			],
			defaults: {
				textColor:  '#FFFFFF',
				textSize:   22,
				textShadow: true,
			},
		},
	];


	/** The Help toy has no chat commands of its own. */
	buildCommands() {
		super.buildCommands([]);
	}


	/**
	 * Get (or lazily create) the keep-alive ref for a (toySlug, widgetSlug)
	 * pair. Caches on the instance so we don't spin up duplicate WebSocket
	 * connections.
	 *
	 * @param {string} toySlug
	 * @param {string} widgetSlug
	 * @returns {import('vue').ComputedRef<string>}
	 */
	getLiveStateRef(toySlug, widgetSlug) {
		const cacheKey = `${toySlug}__${widgetSlug}`;
		if (!this.liveStateRefs.has(cacheKey)) {
			const socketKey = `live-state-${toySlug}-${widgetSlug}`;
			this.liveStateRefs.set(cacheKey, socketShallowRefReadOnly(socketKey, 'U_0'));
		}
		return this.liveStateRefs.get(cacheKey);
	}


	/**
	 * True when at least one of the toy's widgets has reported a keep-alive
	 * heartbeat within the freshness window. Toys with no widgets (pure
	 * tools) are never considered active for tip-rotation purposes.
	 *
	 * @param {*} toy - a Toy instance
	 * @returns {boolean}
	 */
	isToyActive(toy) {
		const widgets = toy?.static?.widgetComponents || [];
		if (widgets.length === 0) return false;

		const now = Date.now();
		for (const w of widgets) {
			const ref = this.getLiveStateRef(toy.static.slug, w.slug);
			const value = ref.value || 'U_0';
			const ts = parseInt(value.split('_')[1], 10) || 0;
			if (now - ts < LIVE_STALENESS_MS) return true;
		}
		return false;
	}


	/**
	 * Walk all enabled toys and collect (toy, command) pairs eligible for
	 * tipping. A command is eligible if the toy is currently active (live
	 * heartbeat from at least one widget), the command is enabled, and its
	 * `tipText` is a non-empty string. Excludes this toy itself.
	 *
	 * @returns {Array<{ id:string, toy:*, command:Object }>}
	 */
	collectEligibleTips() {
		const out = [];
		const toys = this.chatToysApp?.toyManager?.toys || {};
		for (const slug in toys) {
			const toy = toys[slug];
			if (!toy || toy === this) continue;
			if (!this.isToyActive(toy)) continue;

			const commands = toy.localCommandsList?.value || [];
			for (const cmd of commands) {
				if (!cmd || !cmd.enabled) continue;
				const tip = typeof cmd.tipText === 'string' ? cmd.tipText.trim() : '';
				if (!tip) continue;
				out.push({
					id: `${slug}:${cmd.slug}`,
					toy,
					command: cmd,
				});
			}
		}
		return out;
	}


	/**
	 * Pick the next tip to display (or null if none are eligible). Implements
	 * the flat-random-with-recency-filter algorithm described in the file
	 * header.
	 *
	 * @returns {?{id:string,toy:*,command:Object}}
	 */
	pickNextTip() {
		const all = this.collectEligibleTips();
		if (all.length === 0) return null;

		// Filter recently-shown IDs out of the candidate pool.
		let candidates = all.filter(t => !this.recentTipIds.includes(t.id));

		// If recency filter emptied the pool, reset and try again - we'd
		// rather repeat than show nothing.
		if (candidates.length === 0) {
			this.recentTipIds = [];
			candidates = all;
		}

		const pick = candidates[Math.floor(Math.random() * candidates.length)];

		// Push the picked ID into the ring buffer and trim.
		this.recentTipIds.push(pick.id);
		while (this.recentTipIds.length > RECENT_TIP_BUFFER) {
			this.recentTipIds.shift();
		}

		return pick;
	}


	/**
	 * Compose the wire payload for a tip pick. {cmd} is substituted with the
	 * current (possibly streamer-renamed) command name, prefixed with !.
	 *
	 * @param {{id:string,toy:*,command:Object}} pick
	 * @returns {Object}
	 */
	buildTipPayload(pick) {
		const cmdText = '!' + (pick.command.command || '');
		const rendered = (pick.command.tipText || '').replace(/\{cmd\}/g, cmdText);
		return {
			id: pick.id,
			toyName: pick.toy?.static?.name || '',
			toyColor: pick.toy?.static?.themeColor || '#888',
			commandText: cmdText,
			tipText: rendered,
			t: Date.now(),
		};
	}


	/**
	 * Kick off the periodic tick. Uses setElectronInterval so backgrounding
	 * the main app doesn't throttle it.
	 */
	startTipRotation() {
		this.stopTipRotation();
		const everyMs = Math.max(5, Math.floor((this.settings.intervalSeconds.value || 120))) * 1000;
		this.tickInterval = window.setElectronInterval(() => this.tick(), everyMs);
	}


	/** Stop the periodic tick and any pending hide-timeout. */
	stopTipRotation() {
		if (this.tickInterval) {
			window.clearElectronInterval(this.tickInterval);
			this.tickInterval = null;
		}
		if (this.hideTimeout) {
			window.clearElectronTimeout(this.hideTimeout);
			this.hideTimeout = null;
		}
	}


	/**
	 * One interval iteration: pick a tip, publish it, schedule auto-hide.
	 * No-op silently if no eligible tip is available right now (which is
	 * common early on - chatters might not have any toys live yet). The
	 * `verbose` flag is passed by showTipNow so the streamer gets actionable
	 * feedback when their explicit button-press finds nothing.
	 *
	 * @param {boolean} [verbose=false]
	 */
	tick(verbose = false) {
		const pick = this.pickNextTip();
		if (!pick) {
			if (verbose) this.logTipUnavailableReason();
			return;
		}

		this.currentTip.value = this.buildTipPayload(pick);

		// Auto-hide after the configured display window.
		if (this.hideTimeout) window.clearElectronTimeout(this.hideTimeout);
		const hideMs = Math.max(1, Math.floor((this.settings.displaySeconds.value || 10))) * 1000;
		this.hideTimeout = window.setElectronTimeout(() => {
			this.currentTip.value = null;
			this.hideTimeout = null;
		}, hideMs);
	}


	/**
	 * Walk the same data the picker walks, but produce a short diagnostic
	 * line about why no tip was eligible. Logged to the chat-toys system log
	 * only when verbose=true (explicit user action).
	 */
	logTipUnavailableReason() {
		const toys = this.chatToysApp?.toyManager?.toys || {};
		const slugs = Object.keys(toys);
		const enabledCount = slugs.length;
		let liveCount = 0;
		let tippableLiveCount = 0;

		for (const slug of slugs) {
			const toy = toys[slug];
			if (!toy || toy === this) continue;
			const isLive = this.isToyActive(toy);
			if (isLive) liveCount++;
			if (isLive) {
				const cmds = toy.localCommandsList?.value || [];
				const anyTip = cmds.some(c => c?.enabled && typeof c?.tipText === 'string' && c.tipText.trim().length > 0);
				if (anyTip) tippableLiveCount++;
			}
		}

		let reason;
		if (enabledCount === 0) {
			reason = 'no toys enabled in chat-toys';
		} else if (liveCount === 0) {
			reason = `none of the ${enabledCount} enabled toy(s) have a widget live in OBS or a browser`;
		} else if (tippableLiveCount === 0) {
			reason = `${liveCount} live toy(s), but none of their enabled commands have a tipText set`;
		} else {
			reason = `every tip-eligible command was recently shown (pool exhausted)`;
		}

		this.chatToysApp.log.info(`[Help] No tip available: ${reason}.`);
	}


	/**
	 * Streamer-facing "show one now" hook - used by a button on the page so
	 * they can preview without waiting for the next interval. Runs the tick
	 * in verbose mode so the streamer gets a log line when nothing fires
	 * (otherwise the button looks broken).
	 */
	showTipNow() {
		this.tick(true);
	}


	/** Standard cleanup. */
	end() {
		super.end();
		if (this.stopIntervalWatch) {
			this.stopIntervalWatch();
			this.stopIntervalWatch = null;
		}
		this.stopTipRotation();
		this.currentTip.value = null;
	}
}
