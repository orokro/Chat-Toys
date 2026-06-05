/*
	ClawGame.js
	-----------

	State + queue management for the Claw Game toy.

	The toy itself doesn't run any physics - all of that lives in the widget
	(which renders matter-js). The toy is responsible for:
	  - accepting chat-driven !drop commands
	  - queueing drops so they play out one at a time
	  - publishing the current/queued drops over socket-ref so the widget
	    knows who's up and runs the corresponding animation
	  - resolving prize-image asset IDs to URLs the widget can <img>-load

	Coordination with the widget:
	  - The toy writes `currentDrop` (or null when idle).
	  - The widget watches `currentDrop`. When it gains an id it animates the
	    drop; when the drop sequence finishes, it writes `dropAck` with that
	    same id, and the toy advances the queue.
	  - A safety timeout pops the queue even if the widget never acks (page
	    refresh, OBS browser-source dropped, etc.) so the queue can't get
	    stuck.
*/

import { ref, shallowRef, watch } from 'vue';
import { socketShallowRef } from 'socket-ref';
import { v4 as uuidv4 } from 'uuid';

import Toy from '../Toy';
import ClawGamePage from './ClawGamePage.vue';
import ClawGameWidget from './ClawGameWidget.vue';


/** Generous upper bound on how long any single drop animation could take. */
const DROP_SAFETY_TIMEOUT_MS = 25000;

/** Small breather between drops so chatters can register who just played. */
const INTER_DROP_DELAY_MS = 600;


export default class ClawGame extends Toy {

	static name = 'Claw Game';
	static slug = 'clawGame';
	static toyClass = 'game';
	static desc = 'A claw machine your viewers can drop. The chatter who calls !drop rides the claw.';
	static optionsPageComponent = ClawGamePage;
	static themeColor = '#22d3ee';
	static widgetComponents = [
		{
			component: ClawGameWidget,
			key: 'widgetBox',
			allowResize: true,
			lockAspectRatio: true,
			description: 'The claw-machine playfield',
			slug: 'machine'
		}
	];


	/**
	 * @param {import('../../scripts/ToyManager').ToyManager} toyManager
	 */
	constructor(toyManager) {

		super(toyManager);

		// ── Socket state ──────────────────────────────────────────────
		// Active drop being animated (or null when idle).
		this.currentDrop = socketShallowRef(this.static.slugify('currentDrop'), null);

		// Queue of pending drops (for the widget to display "X chatters waiting").
		this.pendingQueue = socketShallowRef(this.static.slugify('pendingQueue'), []);

		// The widget writes this back when it finishes animating a drop.
		// Shape: { id: <uuid> }. We watch it and advance the queue.
		this.dropAck = socketShallowRef(this.static.slugify('dropAck'), null);

		// Widget-friendly version of the prize list: asset IDs already resolved
		// to URLs the OBS browser source can <img>-load. Recomputed whenever
		// the streamer edits the prize array in settings.
		this.resolvedPrizes = socketShallowRef(
			this.static.slugify('resolvedPrizes'),
			this.resolvePrizes()
		);

		// Bump a counter when the streamer wants the widget to throw out all
		// current prizes and respawn a fresh pile (post-settings edits, "RE-SPAWN ALL").
		this.respawnNonce = socketShallowRef(this.static.slugify('respawnNonce'), 0);

		// Latest win event published by the widget when a prize crosses the
		// chute threshold. Shape: { id, userId, username, prizeName, value, t }.
		// The toy watches this and pays out / logs once per unique id.
		this.lastWin = socketShallowRef(this.static.slugify('lastWin'), null);

		// ── Watchers ──────────────────────────────────────────────────
		// Re-resolve prize URLs when the array changes. Even though `prizes`
		// is a shallowRef, ArrayEdit replaces the array on edits so this fires.
		watch(this.settings.prizes, () => {
			this.resolvedPrizes.value = this.resolvePrizes();
		}, { deep: true });

		// Advance the queue as soon as the widget confirms a drop is done.
		watch(this.dropAck, (val) => {
			if (!val || !this.currentDrop.value) return;
			if (val.id === this.currentDrop.value.id) this.advanceQueue();
		});

		// Pay out + log whenever the widget reports a new win. De-duped by id
		// so re-fires of the same value (page reload, socket re-sync) don't
		// double-credit. Also ignores null / id-less values.
		watch(this.lastWin, (val) => {
			if (!val || !val.id) return;
			if (val.id === this.lastProcessedWinId) return;
			this.lastProcessedWinId = val.id;
			this.handleWin(val);
		});

		// ── Internal state ────────────────────────────────────────────
		/** @type {Array<{id:string,username:string,userID:string,targetX:number}>} */
		this.queue = [];

		/** Timeout that force-advances the queue if the widget never acks. */
		this.dropSafetyTimer = null;

		/** Id of the most recently-processed win, for de-duping lastWin. */
		this.lastProcessedWinId = null;
	}


	/**
	 * Award the points + log the prize when the widget reports a win.
	 *
	 * @param {{userId:?string, username:?string, prizeName:string, value:number}} win
	 */
	handleWin(win) {
		const value = Number.isFinite(win.value) ? Math.floor(win.value) : 0;
		const prizeName = win.prizeName || 'a prize';
		const username = win.username || 'someone';

		// Mirror the Fishing toy: ytctDB awards via relativePoints.
		if (win.userId && value > 0) {
			window.ytctDB.updateUser(win.userId, { relativePoints: value });
		}

		this.chatToysApp.log.info(
			`${username} won ${prizeName}` + (value > 0 ? ` (₱${value})` : '')
		);
	}


	/**
	 * Re-resolve the streamer's prize list into widget-ready entries with
	 * concrete image URLs. Empty/blank entries are skipped so a misconfigured
	 * row doesn't trip up image loading in the widget.
	 *
	 * Defaults a sensible value range (10..50) for prizes that pre-date the
	 * min/max fields so older saved settings still work.
	 *
	 * @returns {Array<{name:string,imageUrl:string,scale:number,minValue:number,maxValue:number}>}
	 */
	resolvePrizes() {
		const list = this.settings?.prizes?.value ?? [];
		const out = [];
		for (const p of list) {
			if (!p || !p.image) continue;

			// Clamp + sanitize values so the widget never has to defend
			// against a NaN that'd make Math.random() blow up.
			const rawMin = Number(p.minValue);
			const rawMax = Number(p.maxValue);
			const minValue = Number.isFinite(rawMin) ? Math.max(0, Math.floor(rawMin)) : 10;
			const maxValueCandidate = Number.isFinite(rawMax) ? Math.max(0, Math.floor(rawMax)) : 50;
			const maxValue = Math.max(minValue, maxValueCandidate);

			out.push({
				name: p.name || '',
				imageUrl: this.getAssetPath(p.image),
				scale: typeof p.scale === 'number' ? p.scale : 1,
				minValue,
				maxValue,
			});
		}
		return out;
	}


	/**
	 * Build the settings block. The streamer-facing defaults mirror the
	 * tilde-menu defaults from the prototype, minus the show-status-HUD
	 * toggle (which we deliberately omitted - the HUD was a demo affordance).
	 */
	initSettings() {

		this.buildSettingsBlock({

			// Visual scale of prizes (and by extension the claw, since the
			// claw is derived from prizeScale in the widget).
			prizeScale: ref(0.9),

			// Global UI multiplier on top of prizeScale, so a 4K streamer can
			// scale the whole machine up (claw + prizes + chute) without
			// changing the per-prize relative scale.
			uiScale: ref(1.0),

			// Toggle the on-prize "₱<value>" labels. Wins are still logged
			// and points still paid out when false - this just hides the
			// visual clutter for streamers who prefer the cleaner look.
			showPrizeLabels: ref(true),

			// Multiplier on the on-prize label font size. Labels already
			// auto-scale with prize size; this is a per-streamer fine-tune
			// on top of that.
			labelScale: ref(1.0),

			// How likely (0-100%) the held prize is to slip out before delivery.
			slipChance: ref(50),

			// Slip window (seconds). Effective slip duration is a random value
			// between min and max.
			slipMinTime: ref(1.5),
			slipMaxTime: ref(3),

			// Strength of the radial nudge applied to nearby prizes when the
			// claw grabs or misses.
			pushStrength: ref(100),
			pushOnMiss: ref(true),
			pushOnGrab: ref(true),

			// How many prizes to drop into the machine on (re)spawn.
			spawnCount: ref(18),

			// Prize images. Each entry is { name, image (asset id), scale }.
			// Mirrors the Fishing-toy "fishList" pattern + ArrayPrizeItemEdit.
			prizes: shallowRef([]),

			// Live-widget placement. The widget renders at 1920x1080 internally
			// (the resolution the demo's claw / prize constants were tuned for)
			// and FixedAutoSizer scales to fit whatever box the streamer picks.
			// Defaulting to the native stage size avoids any initial scaling.
			widgetBox: shallowRef({
				x: 0,
				y: 0,
				width: 1920,
				height: 1080,
			}),
		});
	}


	/**
	 * Set up the chat commands this toy listens for. The only public command
	 * is !drop <percentage>; everything else is handled by the streamer
	 * through the settings page.
	 */
	buildCommands() {

		super.buildCommands([
			{
				command: 'drop',
				params: [
					{ name: 'percentage', type: 'number', optional: false, desc: 'Horizontal target 0-100' },
				],
				description: 'Drop the claw at the given horizontal position (0 = far left, 100 = far right)',
				userDesc: 'Drop the claw! Pick a number 0-100 for how far across the machine.',
				tipText: 'Drop the claw 0-100% across the machine: {cmd} 50 for a centered drop',
				costEnabled: true,
			},
		]);
	}


	/**
	 * Dispatch incoming chat commands. Only `!drop` is accepted.
	 *
	 * @param {string} commandSlug
	 * @param {Object} msg - chat message info
	 * @param {Object} user - resolved user record
	 * @param {Object} params - parsed command params
	 * @param {Object} handshake - { accept, reject } from CommandProcessor
	 */
	onCommand(commandSlug, msg, user, params, handshake) {

		if (commandSlug !== 'drop') {
			handshake.reject('Invalid command');
			return;
		}

		// Sanitize the percentage - chat usually delivers numbers but be defensive.
		const raw = Number(params.percentage);
		if (!Number.isFinite(raw)) {
			handshake.reject('Pick a number 0-100');
			return;
		}
		const targetX = Math.max(0, Math.min(100, raw));

		// Enqueue the drop. The username travels with it so the widget can
		// paint the chatter's name on the claw housing, and the unique user
		// id rides along so the widget can attribute the eventual prize win
		// back to this user when the prize crosses the chute.
		const item = {
			id: uuidv4(),
			username: msg.author,
			userID: msg.authorUniqueID,
			targetX,
		};
		this.queue.push(item);
		this.refreshPendingDisplay();

		handshake.accept();
		this.chatToysApp.log.info(`${msg.author} queued a claw drop at ${Math.round(targetX)}%`);

		// Kick off the queue if nothing is currently dropping.
		if (!this.currentDrop.value) this.popNext();
	}


	/**
	 * Republish the pending-queue socket ref. Used after queue mutations so
	 * the widget can show a "next up" / waitlist count.
	 */
	refreshPendingDisplay() {
		// Shallow copy of just the public fields so we don't leak internals.
		// userID is intentionally omitted from the public queue view - the
		// active drop carries it because the widget needs to tag wins.
		this.pendingQueue.value = this.queue.map(q => ({
			id: q.id,
			username: q.username,
			targetX: q.targetX,
		}));
	}


	/**
	 * Pop the next queued drop and broadcast it as the active drop. Also
	 * arms a safety timeout so the queue can't get stuck on a broken widget.
	 */
	popNext() {

		if (this.queue.length === 0) {
			this.currentDrop.value = null;
			return;
		}

		const next = this.queue.shift();
		this.refreshPendingDisplay();
		this.currentDrop.value = next;

		if (this.dropSafetyTimer) window.clearElectronTimeout(this.dropSafetyTimer);
		this.dropSafetyTimer = window.setElectronTimeout(() => {
			this.dropSafetyTimer = null;
			this.advanceQueue();
		}, DROP_SAFETY_TIMEOUT_MS);
	}


	/**
	 * Mark the active drop as finished and (after a short breather) pop the
	 * next one. Triggered either by a `dropAck` from the widget or by the
	 * safety timeout.
	 */
	advanceQueue() {

		if (this.dropSafetyTimer) {
			window.clearElectronTimeout(this.dropSafetyTimer);
			this.dropSafetyTimer = null;
		}
		this.currentDrop.value = null;

		window.setElectronTimeout(() => this.popNext(), INTER_DROP_DELAY_MS);
	}


	/**
	 * Streamer panic button: clear the queue, drop the active drop, and let
	 * the widget snap back to idle. Used by the Reset button on the settings
	 * page.
	 */
	resetGame() {

		if (this.dropSafetyTimer) {
			window.clearElectronTimeout(this.dropSafetyTimer);
			this.dropSafetyTimer = null;
		}
		this.queue = [];
		this.refreshPendingDisplay();
		this.currentDrop.value = null;
	}


	/**
	 * Streamer-triggered "re-spawn all prizes" - just nudges a counter the
	 * widget watches and reacts to. Useful when prize art has changed or the
	 * pile has emptied.
	 */
	respawnPrizes() {
		this.respawnNonce.value = (this.respawnNonce.value || 0) + 1;
	}


	/**
	 * Tear-down hook called when the toy is removed.
	 */
	end() {
		super.end();
		this.resetGame();
	}
}
