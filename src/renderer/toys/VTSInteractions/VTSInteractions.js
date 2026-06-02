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
import { chromeShallowRef } from '@scripts/chromeRef';

// components
import VTSInteractionsPage from './VTSInteractionsPage.vue';

// main export
export default class VTSInteractions extends Toy {

	// static info
	static name = 'VTS Interactions';
	static slug = 'vtsInteractions';
	static desc = 'Let chatters trigger VTube Studio hotkeys & expressions with custom commands.';
	static optionsPageComponent = VTSInteractionsPage;
	static themeColor = '#9B5DE5';
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

		// Persisted cache of every model we've ever scanned, keyed by VTS
		// modelID. Shape per entry:
		//   { modelID, modelName, lastSeen, hotkeys:[], expressions:[] }
		// Lets the user configure commands for a model even when it isn't
		// currently loaded, and drives broken-reference detection later.
		this.modelCache = chromeShallowRef('vts_model_cache', {});

		// Re-scan whenever a model loads. We rely solely on onModelLoaded
		// (which has a matching off-method) rather than onConnect, since the
		// connection manager emits a model-loaded change after auth too
		// (via its initial CurrentModelRequest). This keeps teardown clean.
		this._onModelLoaded = this.handleModelLoaded.bind(this);
		this.vts.onModelLoaded(this._onModelLoaded);

		// If the toy is enabled while VTS is already connected with a model
		// loaded, no fresh ModelLoadedEvent will fire - scan once now.
		if (this.vts.isReady() && this.vts.currentModel.value?.loaded)
			this.scanCurrentModel();

		// Keep our per-command config rows in sync with the custom commands
		// (same approach as Media.reconcileMediaAssets).
		this.reconcileCommandConfigs();
		this.stopCommandsWatch = watch(this.chatToysApp.commands, () => {
			this.reconcileCommandConfigs();
		}, { deep: true });
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

			// Grace window (ms) used later by the runner: how long an
			// unsupported queued sequence waits for a compatible model to
			// become active after a mid-stream model swap before it's dropped.
			graceMs: ref(10000),
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

		// only (re)scan when a real model became active
		if (payload && payload.loaded && payload.modelID)
			this.scanCurrentModel();
	}


	/**
	 * Scan the currently-loaded VTS model for its hotkeys and expressions and
	 * upsert the result into the model cache. Safe to call any time; no-ops
	 * when VTS isn't ready or no model is loaded.
	 *
	 * @returns {Promise<boolean>} - true when a model was scanned and cached
	 */
	async scanCurrentModel() {

		if (!this.vts || !this.vts.isReady())
			return false;

		// confirm which model is loaded right now
		const cur = await this.vts.getCurrentModel();
		if (!cur || !cur.loaded || !cur.modelID)
			return false;

		// fetch features (hotkeys scoped to this model; expressions are
		// always for the current model in the VTS API)
		const [hotkeys, expressions] = await Promise.all([
			this.vts.getHotkeys(cur.modelID),
			this.vts.getExpressions(),
		]);

		this.upsertModel(cur.modelID, cur.modelName, hotkeys, expressions);
		return true;
	}


	/**
	 * Insert or update a model's entry in the cache.
	 *
	 * @param {string} modelID - VTS model ID
	 * @param {string} modelName - human-readable model name
	 * @param {Array<Object>} hotkeys - hotkeys from VTSConnectionManager.getHotkeys
	 * @param {Array<Object>} expressions - expressions from VTSConnectionManager.getExpressions
	 */
	upsertModel(modelID, modelName, hotkeys, expressions) {

		// shallowRef-backed: replace the object so the ref notifies
		const cache = { ...this.modelCache.value };
		cache[modelID] = {
			modelID,
			modelName: modelName || cache[modelID]?.modelName || modelID,
			lastSeen: Date.now(),
			hotkeys: Array.isArray(hotkeys) ? hotkeys : [],
			expressions: Array.isArray(expressions) ? expressions : [],
		};
		this.modelCache.value = cache;

		this.chatToysApp.log.msg(
			`[VTS Interactions] Cached model "${cache[modelID].modelName}" `
			+ `(${cache[modelID].hotkeys.length} hotkeys, ${cache[modelID].expressions.length} expressions)`
		);
	}


	/**
	 * Get a cached model entry by ID (or null).
	 *
	 * @param {string} modelID
	 * @returns {Object|null}
	 */
	getCachedModel(modelID) {
		return this.modelCache.value?.[modelID] || null;
	}


	/**
	 * Handle an incoming command.
	 *
	 * Phase 2 stub: resolves which sequence WOULD run for the current model
	 * and logs it, but the queued runner isn't implemented yet (Phase 5), so
	 * we reject so viewers aren't charged for a no-op.
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
		const cur = this.vts?.currentModel?.value || { modelID: null, modelName: null };
		const hasSequence = !!(config && cur.modelID && config.sequencesByModel?.[cur.modelID]);

		this.chatToysApp.log.msg(
			`[VTS Interactions] ${msg.author} ran !${config?.commandName || commandSlug} `
			+ `(model: ${cur.modelName || 'none'}, sequence ${hasSequence ? 'found' : 'missing'}) `
			+ `- runner not wired yet`
		);

		handshake.reject('VTS Interactions runner not implemented yet (Phase 5)');
	}

}
