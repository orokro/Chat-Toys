/*
	VTSInteractions.js
	------------------

	State for the "VTS Interactions" toy.

	This toy lets chatters trigger VTube Studio hotkeys / expressions via
	custom chat commands, where each command maps to a per-model sequence of
	actions (hotkey, expression, wait). It has no widgets - everything runs
	inside VTube Studio via the shared VTSConnectionManager.

	Phase 2 scope (this file): toy skeleton, the proactively-collected
	model/feature cache, and reconciliation of per-command config rows against
	the user's custom commands (mirrors the Media toy pattern). The sequence
	editor (Phase 4) and the queued sequence runner + model-change safety
	(Phase 5) are not wired here yet - see misc/vts-command-toy-plan.md.
*/

// vue
import { ref, shallowRef, watch } from 'vue';

// our app
import Toy from "../Toy";

// lib/misc
import { v4 as uuidv4 } from 'uuid';

// components
import VTSInteractionsPage from './VTSInteractionsPage.vue';

// main export
export default class VTSInteractions extends Toy {

	// static info
	static name = 'VTS Interactions';
	static slug = 'vtsInteractions';
	static desc = 'Let chatters trigger VTube Studio hotkeys & expressions with custom commands.';
	static optionsPageComponent = VTSInteractionsPage;
	static themeColor = '#F9A0B0';
	static widgetComponents = [];

	// Like Media/VTSTosser: this toy ships with no built-in commands. The
	// streamer creates their own custom commands and maps each to a
	// per-model sequence. Read by the master Commands page so the toy is
	// surfaced even when localCommandsList is empty.
	static enableCustomCommands = true;


	/**
	 * Constructs the VTSInteractions object.
	 *
	 * @param {import('../../scripts/ToyManager').ToyManager} toyManager - reference to the toy manager
	 */
	constructor(toyManager) {

		// call the parent constructor (builds settings + commands + hooks)
		super(toyManager);

		// shortcut to the shared VTS connection manager
		this.vts = this.chatToysApp.vtsConnMgr;

		// Shared model-feature cache, OWNED by VTSConnectionManager (populated
		// whenever VTS is connected, regardless of which toys are enabled). We
		// just reference it so the matrix / runner can read scanned hotkeys &
		// expressions. Same storage key as before, so existing data carries over.
		this.modelCache = this.vts.modelCache;

		// ---- sequence runner state ----
		// FIFO of pending jobs. Each job resolves its sequence against the
		// CURRENTLY loaded model at run time (so a quick model switch-back
		// fires the original model's sequence). Plain array, not reactive.
		this.queue = [];
		this.isRunning = false;
		// Bumped on every model change / disconnect to abort an in-flight
		// sequence; the running loop checks it between blocks and during waits.
		this.runGen = 0;
		this._activeWaitCancel = null;
		this.pumpInterval = null;

		// Re-scan whenever a model loads. We rely solely on onModelLoaded
		// (which has a matching off-method) rather than onConnect, since the
		// connection manager emits a model-loaded change after auth too
		// (via its initial CurrentModelRequest). This keeps teardown clean.
		this._onModelLoaded = this.handleModelLoaded.bind(this);
		this.vts.onModelLoaded(this._onModelLoaded);

		// Keep our per-command config rows in sync with the custom commands
		// (same approach as Media.reconcileMediaAssets).
		this.reconcileCommandConfigs();
		this.stopCommandsWatch = watch(this.chatToysApp.commands, () => {
			this.reconcileCommandConfigs();
		}, { deep: true });

		// start the queue pump (drives serial sequence execution)
		this.pumpInterval = window.setElectronInterval(() => this.pump(), 250);
	}


	/**
	 * Perform clean up when the toy is destroyed.
	 */
	end() {

		super.end();

		// drop our VTS subscription so we don't leak across enable/disable
		if (this._onModelLoaded)
			this.vts.offModelLoaded(this._onModelLoaded);
		this._onModelLoaded = null;

		// stop the commands watcher
		if (this.stopCommandsWatch)
			this.stopCommandsWatch();

		// stop the runner: abort any in-flight sequence + kill the pump
		this.runGen++;
		if (this._activeWaitCancel)
			this._activeWaitCancel();
		if (this.pumpInterval)
			window.clearElectronInterval(this.pumpInterval);
		this.pumpInterval = null;
		this.queue = [];
	}


	/**
	 * Initialize the settings for this toy.
	 */
	initSettings() {

		this.buildSettingsBlock({

			// One entry per custom command, reconciled from the global
			// commands list. Each entry holds that command's sequences keyed
			// by modelID. Shape:
			//   {
			//     commandSlug: 'vtsInteractions__1',
			//     commandName: 'bald',
			//     sequencesByModel: { [modelID]: { blocks: [] } }
			//   }
			commandConfigs: shallowRef([]),

			// Grace window (ms) used by the runner: how long an unsupported
			// queued sequence waits for a compatible model to become active
			// after a mid-stream model swap before it's dropped.
			graceMs: ref(60000),
		});
	}


	/**
	 * Initialize the commands for this toy.
	 *
	 * All commands are user-generated, so this starts empty (see Media).
	 */
	buildCommands() {
		super.buildCommands([]);
	}


	/**
	 * Reconcile the per-command config rows with the current custom commands
	 * for this toy. Adds rows for new commands, drops rows whose command was
	 * deleted, and refreshes the cached command name. Mirrors the Media toy.
	 */
	reconcileCommandConfigs() {

		const commands = this.chatToysApp.commands.value;
		const configs = this.settings.commandConfigs.value;

		// slugs belonging to this toy's custom commands (vtsInteractions__N)
		const prefix = `${this.slug}__`;
		const currentSlugs = Object.keys(commands).filter(slug => slug.startsWith(prefix));

		// build new rows for any command we don't yet have a config for
		const newConfigs = [];
		currentSlugs.forEach((slug) => {

			const command = commands[slug];
			const existing = configs.find(cfg => cfg.commandSlug === slug);
			if (!existing) {
				newConfigs.push({
					commandSlug: slug,
					commandName: command.command,
					sequencesByModel: {},
				});
			}
		});

		// keep only configs whose command still exists
		const keptConfigs = configs.filter(cfg => currentSlugs.includes(cfg.commandSlug));

		// merge, then refresh command names (text can change even if slug didn't)
		const merged = [...keptConfigs, ...newConfigs];
		merged.forEach((cfg) => {
			const command = commands[cfg.commandSlug];
			if (command)
				cfg.commandName = command.command;
		});

		this.settings.commandConfigs.value = merged;
	}


	/**
	 * Handle a model-loaded change from the VTS connection manager.
	 *
	 * @param {{ modelID: string|null, modelName: string|null, loaded: boolean }} payload
	 */
	handleModelLoaded(payload) {

		// Abort any in-flight sequence - it was running against the old model
		// and its remaining hotkeys/expressions may not exist on the new one.
		this.runGen++;
		if (this._activeWaitCancel)
			this._activeWaitCancel();

		// re-evaluate the queue against the new model right away
		// (the feature cache is refreshed by VTSConnectionManager itself)
		this.cleanupExpired();
	}


	/**
	 * Re-scan the current model. Thin passthrough to the connection manager,
	 * which owns the shared model cache. Kept so the settings page's manual
	 * "Re-scan" button keeps working unchanged.
	 *
	 * @returns {Promise<boolean>}
	 */
	scanCurrentModel() {
		return this.vts.scanCurrentModel();
	}


	/**
	 * Handle an incoming command: enqueue a job to run this command's sequence.
	 *
	 * We resolve which model's sequence to run at RUN time (not here), so a
	 * quick model switch-back still fires the right sequence. Points are
	 * charged on enqueue (accept-on-enqueue); a job later dropped by the grace
	 * window is a known, un-refunded loss.
	 *
	 * @param {String} commandSlug - the slug suffix of the command (e.g. "1")
	 * @param {Object} msg - details about the chat message that invoked the command
	 * @param {Object} user - details about the invoking user
	 * @param {Object} params - parsed command parameters
	 * @param {Object} handshake - { accept, reject }
	 */
	onCommand(commandSlug, msg, user, params, handshake) {

		const fullSlug = this.static.slugify(commandSlug);
		const config = this.settings.commandConfigs.value.find(c => c.commandSlug === fullSlug);

		// no config row at all (shouldn't happen for a hooked command)
		if (!config) {
			handshake.reject('Command is not configured');
			return;
		}

		// clearly-misconfigured: not set up for ANY model. Reject rather than
		// charge for something that can never run. (A mere current-model
		// mismatch still enqueues - the grace window handles model swaps.)
		if (!config.sequencesByModel || Object.keys(config.sequencesByModel).length === 0) {
			handshake.reject(`!${config.commandName} has no sequences configured yet`);
			return;
		}

		this.queue.push({
			id: uuidv4(),
			commandSlug: fullSlug,
			commandName: config.commandName,
			author: msg.author,
			enqueuedAt: Date.now(),
			unsupportedSince: null,
		});

		this.chatToysApp.log.msg(`${msg.author} queued !${config.commandName}`);

		handshake.accept();
	}


	/**
	 * Queue pump (interval-driven). Ages out expired jobs, then - if idle -
	 * starts the next job the current model can fulfil. Serial: only one
	 * sequence runs at a time.
	 */
	pump() {

		// age-out jobs unsupported beyond the grace window
		this.cleanupExpired();

		// one sequence at a time
		if (this.isRunning || this.queue.length === 0)
			return;

		const model = this.vts?.currentModel?.value;

		// first job the current model can actually fulfil
		const idx = this.queue.findIndex(job => this.resolveSequence(job, model) != null);
		if (idx === -1)
			return;

		const job = this.queue.splice(idx, 1)[0];
		this.isRunning = true;
		this.runJob(job, model).finally(() => { this.isRunning = false; });
	}


	/**
	 * Remove jobs that have stayed unsupported by the current model longer
	 * than the grace window. Jobs runnable right now have their grace timer
	 * cleared.
	 */
	cleanupExpired() {

		const model = this.vts?.currentModel?.value;
		const now = Date.now();
		const graceMs = this.settings.graceMs.value;

		this.queue = this.queue.filter(job => {

			if (this.resolveSequence(job, model) != null) {
				job.unsupportedSince = null;
				return true;
			}

			if (job.unsupportedSince == null)
				job.unsupportedSince = now;

			if (now - job.unsupportedSince > graceMs) {
				this.chatToysApp.log.msg(
					`[VTS Interactions] Dropped queued !${job.commandName} `
					+ `(no matching model within grace period)`
				);
				return false;
			}
			return true;
		});
	}


	/**
	 * Resolve the runnable sequence for a job against a given model, or null
	 * if the model can't fulfil it (not loaded, no sequence, or broken refs).
	 *
	 * @param {Object} job
	 * @param {Object} model - vtsConnMgr.currentModel.value
	 * @returns {Object|null} - { blocks } or null
	 */
	resolveSequence(job, model) {

		if (!model || !model.loaded || !model.modelID)
			return null;

		const config = this.settings.commandConfigs.value.find(c => c.commandSlug === job.commandSlug);
		if (!config)
			return null;

		const seq = config.sequencesByModel?.[model.modelID];
		if (!seq || !Array.isArray(seq.blocks) || seq.blocks.length === 0)
			return null;

		// never run a sequence with broken references (validated against the
		// scanned feature cache, when we have one)
		const cached = this.modelCache.value?.[model.modelID];
		if (cached && this.isBroken(seq, cached))
			return null;

		return seq;
	}


	/**
	 * Does a sequence reference a hotkey / expression missing from a model's
	 * cached feature list?
	 *
	 * @param {Object} seq
	 * @param {Object} cached - cached model entry
	 * @returns {Boolean}
	 */
	isBroken(seq, cached) {

		const hotkeyIDs = new Set((cached.hotkeys || []).map(h => h.hotkeyID));
		const exprFiles = new Set((cached.expressions || []).map(e => e.file));

		return seq.blocks.some(b => {
			if (b.type === 'hotkey')
				return !hotkeyIDs.has(b.hotkeyID);
			if (b.type === 'expression')
				return !exprFiles.has(b.file);
			return false;
		});
	}


	/**
	 * Run a job's sequence block-by-block. Bails immediately if the run
	 * generation changes (model swap / disconnect / toy teardown).
	 *
	 * @param {Object} job
	 * @param {Object} model
	 * @returns {Promise<void>}
	 */
	async runJob(job, model) {

		const seq = this.resolveSequence(job, model);
		if (!seq)
			return;

		const myGen = this.runGen;
		this.chatToysApp.log.msg(`[VTS Interactions] Running !${job.commandName} on ${model.modelName}`);

		for (const block of seq.blocks) {

			// aborted by a model change / disconnect / teardown
			if (this.runGen !== myGen) {
				this.chatToysApp.log.msg(`[VTS Interactions] Aborted !${job.commandName} (model changed)`);
				return;
			}

			try {
				await this.runBlock(block);
			} catch (err) {
				if (this.chatToysApp.log.error)
					this.chatToysApp.log.error(`[VTS Interactions] Block error in !${job.commandName}: ${err?.message || err}`);
			}
		}
	}


	/**
	 * Execute a single sequence block against VTS.
	 *
	 * @param {Object} block
	 * @returns {Promise<void>}
	 */
	async runBlock(block) {

		if (block.type === 'wait') {
			await this.abortableWait(block.seconds);
			return;
		}

		if (block.type === 'hotkey') {
			await this.vts.triggerHotkey(block.hotkeyID);
			return;
		}

		if (block.type === 'expression') {

			if (block.action === 'toggle') {
				// flip the current active state
				const exprs = await this.vts.getExpressions();
				const cur = exprs.find(e => e.file === block.file);
				await this.vts.activateExpression(block.file, !(cur && cur.active));
			} else {
				await this.vts.activateExpression(block.file, block.action === 'activate');
			}
		}
	}


	/**
	 * A wait that can be cancelled early (so an in-flight Wait block doesn't
	 * hold up an aborted sequence). Uses electron timers to avoid background
	 * throttling.
	 *
	 * @param {Number} seconds
	 * @returns {Promise<void>}
	 */
	abortableWait(seconds) {

		return new Promise((resolve) => {

			const ms = Math.max(0, (Number(seconds) || 0) * 1000);
			let done = false;

			const finish = () => {
				if (done) return;
				done = true;
				this._activeWaitCancel = null;
				resolve();
			};

			const timer = window.setElectronTimeout(finish, ms);

			// let an external abort cut the wait short
			this._activeWaitCancel = () => {
				window.clearElectronTimeout(timer);
				finish();
			};
		});
	}

}
