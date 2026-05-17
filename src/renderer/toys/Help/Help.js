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
import { socketShallowRef } from 'socket-ref';

import Toy from '../Toy';
import { StateTickerQueue } from '@scripts/StateTickerQueue';
import HelpPage from './HelpPage.vue';
import HelpWidget from './HelpWidget.vue';


/** How many recent tip IDs to remember (prevents back-to-back duplicates). */
const RECENT_TIP_BUFFER = 10;


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

	// Marks this toy as omni-includable + names its alert-eligible widget.
	static isAlertToy = true;
	static alertWidgetSlug = 'tipCard';


	/**
	 * @param {import('../../scripts/ToyManager').ToyManager} toyManager
	 */
	constructor(toyManager) {

		super(toyManager);

		// Live state published to the widget.
		this.currentTip = socketShallowRef(this.static.slugify('currentTip'), null);

		// Ring buffer of recent tip IDs (e.g. 'prizeWheel:spin') so the same
		// tip doesn't reappear immediately.
		/** @type {Array<string>} */
		this.recentTipIds = [];

		// Display queue: handles "show this tip for N seconds" pacing and
		// the Omni gate. The producer is the picker-interval below; this
		// queue is just the consumer. Default duration is displaySeconds
		// (per-item duration overrides this; we set it on each enqueue).
		this.tipQueue = new StateTickerQueue(
			this.handleTipQueue.bind(this),
			0, // defaultWait between items: 0 (we don't want gaps between back-to-back tips)
			this.settings.displaySeconds.value || 10,
			{ canFire: () => !this.chatToysApp.omniRegistry.isBlocking(this.slug) }
		);
		this.queueTickFn = () => this.tipQueue.tick();
		electronAPI.tick(this.queueTickFn);

		// Producer: every intervalSeconds, pick a fresh tip and (if the
		// queue isn't already sitting on one) enqueue it. Capping the
		// pending queue at 1 means tips don't pile up during long omni
		// busy stretches - we just hold whatever's most recent.
		this.tickInterval = null;
		this.startTipPicker();

		// Restart the picker if the streamer edits the interval so the
		// change is live (otherwise they'd have to disable/re-enable the toy).
		this.stopIntervalWatch = watch(this.settings.intervalSeconds, () => {
			this.startTipPicker();
		});
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
	 * True when at least one of the toy's widgets has reported a keep-alive
	 * heartbeat recently. Reads the `heartBeatAlive` ref auto-managed by the
	 * Toy base class - we don't have to own any socket-ref scaffolding here.
	 *
	 * Toys without widgets (pure tools) leave `heartBeatAlive` at false, so
	 * they're naturally excluded from the tip pool.
	 *
	 * @param {*} toy - a Toy instance
	 * @returns {boolean}
	 */
	isToyActive(toy) {
		return toy?.heartBeatAlive?.value === true;
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
	 * (Re)start the producer interval that picks tips at the configured
	 * cadence. The interval enqueues onto `tipQueue` rather than firing
	 * directly, so display pacing + omni gating live in one place (the STQ).
	 * Uses setElectronInterval so backgrounding the main app doesn't throttle.
	 */
	startTipPicker() {
		this.stopTipPicker();
		const everyMs = Math.max(5, Math.floor((this.settings.intervalSeconds.value || 120))) * 1000;
		this.tickInterval = window.setElectronInterval(() => this.scheduleNextTip(), everyMs);
	}


	/** Stop the producer interval. */
	stopTipPicker() {
		if (this.tickInterval) {
			window.clearElectronInterval(this.tickInterval);
			this.tickInterval = null;
		}
	}


	/**
	 * Pick a fresh tip and (if nothing is currently showing AND nothing's
	 * already queued) enqueue it onto `tipQueue`. The cap-at-1 means tips
	 * don't pile up during long omni-busy stretches - we'd rather show one
	 * fresh tip than a backlog of stale ones.
	 *
	 * @param {boolean} [verbose=false] - log a reason if no tip can be picked
	 */
	scheduleNextTip(verbose = false) {

		// Hold off if a tip is on screen or pending.
		if (this.currentTip.value !== null || this.tipQueue.queue.length > 0) {
			return;
		}

		const pick = this.pickNextTip();
		if (!pick) {
			if (verbose) this.logTipUnavailableReason();
			return;
		}

		const item = this.buildTipPayload(pick);
		// Per-item duration override on the queue (overrides defaultDuration).
		item.duration = Math.max(1, Math.floor((this.settings.displaySeconds.value || 10)));
		this.tipQueue.addToQueue(item);
	}


	/**
	 * Tip queue handler. Called by StateTickerQueue when an item pops (the
	 * canFire gate passed), and with null between items / when empty.
	 * `currentTip` going non-null is what drives the widget render.
	 *
	 * @param {?Object} item
	 */
	handleTipQueue(item) {
		this.currentTip.value = item;
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
	 * they can preview without waiting for the next interval. Routes through
	 * scheduleNextTip so the omni gate / cap-at-1 rules still apply, and
	 * uses verbose mode to log a reason in the system log if nothing fires
	 * (otherwise the button just looks broken).
	 */
	showTipNow() {
		this.scheduleNextTip(true);
	}


	/**
	 * Whether a tip is currently on screen. Used by the Omni registry to
	 * gate other included toys.
	 *
	 * @returns {boolean}
	 */
	isShowing() {
		return this.currentTip.value !== null;
	}


	/** Standard cleanup. */
	end() {
		super.end();
		if (this.stopIntervalWatch) {
			this.stopIntervalWatch();
			this.stopIntervalWatch = null;
		}
		this.stopTipPicker();
		if (this.queueTickFn) {
			electronAPI.clearTick(this.queueTickFn);
			this.queueTickFn = null;
		}
		this.currentTip.value = null;
	}
}
