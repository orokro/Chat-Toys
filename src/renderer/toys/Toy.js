/*
	Toy.js
	------

	This will be the base class for all our toys.

	It will not only handle the state for when they're live,
	but also act as a base for the commands and settings.
*/

// vue
import { ref, shallowRef, watch } from 'vue';
import { socketRef, socketShallowRef, socketShallowRefReadOnly } from 'socket-ref';


/**
 * How long (ms) since the most recent heartbeat counts a widget as "live".
 * Matches the freshness threshold used by WidgetRow.vue in the UI.
 */
const HEARTBEAT_STALENESS_MS = 10 * 1000;

// our app
// NOTE: we deliberately do NOT `import { ToyManager } from '../scripts/ToyManager'`
// here. ToyManager pulls in ChatToysApp, which pulls in ToysData, which pulls
// in every concrete Toy subclass (Chat, Media, …). Each subclass does
// `class X extends Toy` at module-eval time - so adding ToyManager to Toy.js's
// import list creates a cycle where a subclass tries to read `Toy` before
// Toy.js has finished evaluating, producing a runtime TDZ error
// ("Cannot access 'Toy' before initialization"). ToyManager was only ever
// referenced from JSDoc here, never at runtime, so the import is unneeded.
import { RefAggregator } from "../scripts/RefAggregator";
import { chromeShallowRef } from "../scripts/chromeRef";

// main export
export default class Toy {

	// some toys will be classified as a "tool", but most are not
	static isTool = false;

	/**
	 * Constructs the Toy object
	 *
	 * @param {import('../scripts/ToyManager').ToyManager} toyManager - reference to the toy manager
	 */
	constructor(toyManager) {

		// save reference to the toy manager but also grab our chat app
		this.toyManager = toyManager;
		this.chatToysApp = toyManager.chatToysApp;

		// lazy hack to ref statics elsewhere
		this.static = this.constructor;

		// save our slug even though it's also technically static
		this.slug = new.target.slug;

		// we will store a ref that contains our currents command list
		// (which is different from this.commands, which are the defaults)
		// the ref will be updated whenever the global commands list changes
		this.localCommandsList = ref([]);

		// build our settings right away (the toy can override this)
		this.initSettings();

		// build the commands list, if any, for this toy
		this.buildCommands([]);

		// we'll auto-subscribe to the commands for this toy!
		// we'll use a callback that can be overridden by the toy
		this.onCommandFn = this.onCommand.bind(this);
		this.chatToysApp.commandProcessor.hookToyCommands(this.slug, this.onCommandFn);

		// Auto-managed heartbeat tracking. `heartBeatAlive` becomes true
		// whenever ANY of this toy's widgets has sent a keep-alive heartbeat
		// in the last HEARTBEAT_STALENESS_MS. Other systems (e.g. the Help
		// toy) read `toy.heartBeatAlive.value` instead of building their
		// own per-widget socket-ref scaffolding.
		this.heartBeatAlive = ref(false);
		this._heartBeatRefs = [];
		this._heartBeatInterval = null;
		this.initHeartBeatTracking();
	}


	/**
	 * Set up live-state socket subscriptions for each of this toy's widgets
	 * and start a 1-second ticker that maintains `this.heartBeatAlive`.
	 * No-op for toys with no widgets (pure tools like SCConversion) - they
	 * can't be "live" by heartbeat and stay heartBeatAlive=false.
	 *
	 * Idempotent / safe to call multiple times.
	 */
	initHeartBeatTracking() {

		// Bail for toys without widgets - no heartbeats to listen for.
		const widgets = this.constructor.widgetComponents || [];
		if (widgets.length === 0) return;

		// Subscribe once per widget. Same socket key the widget side writes
		// to via keepAliveSocket(). socket-ref creates a real WebSocket on
		// construction - flagged in misc/architecture-notes.md, still ours
		// to live with until the socket-mux refactor.
		for (const w of widgets) {
			const socketKey = `live-state-${this.slug}-${w.slug}`;
			this._heartBeatRefs.push(socketShallowRefReadOnly(socketKey, 'U_0'));
		}

		// Recompute every second. Plain ref + manual tick (rather than a
		// computed) because freshness is time-based and computeds don't
		// re-evaluate just because `Date.now()` advances.
		this._heartBeatInterval = window.setElectronInterval(() => {
			const now = Date.now();
			let alive = false;
			for (const r of this._heartBeatRefs) {
				const raw = r.value || 'U_0';
				const ts = parseInt(raw.split('_')[1], 10) || 0;
				if (now - ts < HEARTBEAT_STALENESS_MS) {
					alive = true;
					break;
				}
			}
			if (alive !== this.heartBeatAlive.value) {
				this.heartBeatAlive.value = alive;
			}
		}, 1000);
	}


	/**
	 * Initialize the settings for this toy
	 * 
	 * This is a placeholder that the toy can override to set up its settings.
	 */
	initSettings() {

		// let the toy override this
		this.settings = {};
	}


	/**
	 * Initialize the commands for this toy
	 *
	 * This is a placeholder that the toy can override to set up its commands.
	 */
	buildCommands(commandDefs) {

		// build the commands list with defaults
        this.commands = commandDefs.map(def => {

			// get the provided settings or otherwise use defaults
            const {
                command,
                description,
				userDesc,
				tipText = '',
                slug = this.constructor.slugify(command),
                params = [],
                enabled = true,
				memberOnly = false,
				superOnly = false,
                costEnabled = true,
                cost = 0,
                coolDown = 0,
                groupCoolDown = 0,
            } = def;

			// make sure we have the required fields
            if (!command || !description) {
                throw new Error(`Command "${command}" is missing required fields.`);
            }

			// return the command object.
			// `tipText` is consumed by the Help toy to surface a periodic
			// usage hint to chatters. Use {cmd} as a placeholder for the
			// command name - the Help widget substitutes the current
			// (possibly-renamed) command at render time. Empty string opts
			// out of being surfaced as a tip.
            return {
                command,
                description,
				userDesc,
				tipText,
                slug,
                params,
                enabled,
				memberOnly,
				superOnly,
                costEnabled,
                cost,
                coolDown,
                groupCoolDown,
            };
        });

		// make sure our commands are reconciled with the global list
		this.reconcileCommandsList();
    }


	/**
	 * Handle when an incoming command is sent to this toy.
	 *
	 * Subclasses override this. The handshake object follows a strict
	 * accept/reject contract (see CommandProcessor._notifyListeners for the
	 * canonical version):
	 *
	 *  - Call `handshake.accept()` ONLY after the requested action has
	 *    succeeded (item enqueued AND queue accepted it, lobby joined AND
	 *    has room, asset found AND playable, etc). accept() deducts the
	 *    user's ChatToys points; calling it prematurely charges the viewer
	 *    for an action that didn't happen.
	 *  - Call `handshake.reject(reason)` when the action cannot be
	 *    fulfilled. No points are deducted. For redeem-sourced messages
	 *    (msg.source === 'twitch-redeem') this will trigger an automatic
	 *    Twitch channel-points refund (see TwitchRedeems toy).
	 *  - Exactly one of accept/reject should be called per invocation.
	 *  - Fire-and-forget toys whose downstream pipeline cannot fail (e.g.
	 *    Tosser, HeadPat, EmojiFountain) may accept immediately after
	 *    enqueueing. Toys whose pipeline can drop the action (StreamBuddies
	 *    lobby full, Media asset missing) MUST honor the success boolean
	 *    of the downstream call.
	 *
	 * @param {String} commandSlug - the slug of the command
	 * @param {Object} msg - details about the chat message that invoked the command
	 * @param {Object} user - details about the user that invoked the command (could be dummy if not in database yet)
	 * @param {Array<String>} params - the parameters passed to the command
	 * @param {Object} handshake - object like { accept: Function, reject: Function } to accept or reject the command
	 */
	onCommand(commandSlug, msg, user, params, handshake) {

		// log it for now
		// console.log(`Command found: ${commandSlug} from `, user, 'in', msg, 'with params', params);
	}


	/**
	 * Builds block of settings that are reactive and sync with chrome storage
	 * 
	 * @param {Object} settings - object like { settingName: ref, ... }
	 */
	buildSettingsBlock(settings) {

		// save the settings object with a public name
		this.settings = settings;

		// use our slug to create a unique block name
		const blockNameKebab = this.slug.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
		const socketName = blockNameKebab + '-settings';

		// FEEDBACK LOOP PREVENTION:
		// Only the primary window (the dashboard) should sync from local storage to the socket.
		// Secondary windows (like OBS widgets or popout managers) should be passive.
		const isPrimaryWindow = !!window.isPrimaryWindow;

		if (isPrimaryWindow) {
			
			// In primary window, we use chrome storage as source of truth
			this.settingsStorRef = chromeShallowRef(blockNameKebab + '-settings', {});
			
			// We use a socket ref to broadcast our changes TO other windows
			this.settingsSocketRef = socketShallowRef(socketName, this.settingsStorRef.value);

			// create a ref aggregator to sync the settings & register them
			this.settingsAggregator = new RefAggregator(this.settingsStorRef);
			this.settingsAggregator.registerObject(this.settings);

			// Sync FROM storage TO socket ONLY (One way)
			this.stopSettingsSocketWatch = watch(this.settingsStorRef, (newVal) => {
				this.settingsSocketRef.value = newVal;
			});

			// Initial push to socket
			window.setElectronTimeout(() => {
				this.settingsSocketRef.value = this.settingsStorRef.value;
			}, 1000);

		} else {
			
			// In secondary windows, we don't want to touch chrome storage/localStorage at all
			// to prevent RefAggregator from accidentally writing defaults or fighting.
			// Instead, we create a dummy local storage ref that only syncs FROM the socket.
			this.settingsStorRef = shallowRef({});
			this.settingsSocketRef = socketShallowRefReadOnly(socketName, {});

			// Register settings with the aggregator so the individual refs update
			this.settingsAggregator = new RefAggregator(this.settingsStorRef);
			this.settingsAggregator.registerObject(this.settings);

			// Sync FROM socket TO local dummy storage
			this.stopSettingsSocketWatch = watch(this.settingsSocketRef, (newVal) => {
				if (newVal && typeof newVal === 'object') {
					this.settingsStorRef.value = newVal;
				}
			}, { immediate: true });
		}
	}


	/**
	 * System wide, commands are stored in a chromeRef. 
	 * 
	 * That means, the list of commands can chant at any time.
	 * This method will reconcile the commands list with our internal list of commands,
	 * and update a ref that can be consumed in the various components.
	 * 
	 * @returns {Array<Object>} - the new local list of commands (not a ref)
	 */
	reconcileCommandsList(){

		/*	
			NOTE:
			-----

			Here we have a big comment block because the following is somewhat confusing.

			All of the commands system wide will be stored in chatToysApp.commands.value.
			This variable is a chromeShallowRef, so it will be stored in local/plugin storage.

			It will have keys on it's object for EVERY COMMAND in the system, including custom user ones.
			It's essentially the source-of-truth for all commands in the system.

			However, it is never explicitly defined anywhere.

			Rather, this very component will help to initialize it.

			Our class instance will define it's own commands array - this is essentially the default list of commands
			for this toy. When the component mounts we need to compare this list with the list in storage.

			If we don't yet have these in the storage commandsRef, then we can initialize them with the
			commands array from props. However, if we do have them, then we need to load them.

			That's where the array this.localCommandsList comes in. The actual data we'll display onscreen
			will be duplicated from the chrome ref, because we don't want to show ALL commands, just
			the current state of the commands that match the list for this toy.

			FURTHER: since some command boxes will allow users to add their own custom commands,
			we'll also build our internal list based off the slug prefix.
		*/

		// we'll build the new local list temporarily here - we'll only update the ref at the end
		const newLocalCommandsList = [];
	
		// keep track of slugs alone as well
		const newSlugs = [];
	
		// we'll also keep an object of new commands to merge into the chrome ref if needed
		const newCommands = {};
	
		// fetch the current object storing all commands system wide
		const commandsState = this.chatToysApp.commands.value;
	
		// lets loop over every list in our props commands array and see if it already exists
		// in the commands state - if not, we'll add it
		for(let command of this.commands){
	
			// the slug for this command
			const slug = command.slug;
	
			// if the commandsState doesn't have this command have this slug as a key, 
			// then we need to add it
			if(!(slug in commandsState)){
	
				// add it to the new commands object
				newCommands[slug] = command;
	
				// add it to the new local list
				newLocalCommandsList.push(command);
				newSlugs.push(slug);
			
			}
			// otherwise, we already have a stored copy with the user's
			// customizations (renamed command text, cost, cooldown, enabled
			// flag). Merge the factory defaults *under* the stored copy so:
			//   1. user-edited fields still win (e.g. their custom !cmd name)
			//   2. fields newly introduced in code (e.g. tipText, added long
			//      after the streamer first saved this command) still
			//      propagate to localCommandsList - previously they got
			//      silently dropped.
			else {
				const stored = commandsState[slug];
				newLocalCommandsList.push({ ...command, ...stored });
				newSlugs.push(slug);
			}
			
		}// next command
	
		// if we have any new commands to add, then we'll merge them into the commands state
		if(Object.keys(newCommands).length>0){
			this.chatToysApp.commands.value = { ...commandsState, ...newCommands };
		}
	
		// before we update the local list, we should also search the keys that 
		// follow the pattern of our toySlug_ prefix - these are custom commands
		// we should pull them from the commands state and add them to our local list
		for(let key in commandsState){
	
			// if the key starts with our toySlug_ prefix, then we should add it to the local list
			// (if its not already there)
			if(key.startsWith(`${this.slug}_`) && newSlugs.includes(key)==false)
				newLocalCommandsList.push(commandsState[key]);		
	
		}// next key
	
		// update the local commands list ref
		this.localCommandsList.value = newLocalCommandsList;

		// return new local commands list as well
		return newLocalCommandsList;
	}


	/**
	 * Clean up the toy when it's about to be removed
	 */
	end(){

		// for debug
		console.log("Ending toy", this.slug);

		// remove hook from the command processor
		this.chatToysApp.commandProcessor.clearHook(this.slug, this.onCommandFn);
		this.onCommandFn = null;

		// Drop any TwitchEvents subscriptions tagged with this toy's
		// slug. Safety net so toys that subscribe via
		// `chatToysApp.twitchEvents.on(type, cb, this.slug)` don't leak
		// across toy disable/re-enable cycles. No-op for toys that never
		// subscribed.
		if (this.chatToysApp.twitchEvents && typeof this.chatToysApp.twitchEvents.removeAllByToy === 'function') {
			this.chatToysApp.twitchEvents.removeAllByToy(this.slug);
		}

		// stop watching the settings
		if (this.stopSettingsSocketWatch)
			this.stopSettingsSocketWatch();

		// stop the heartbeat ticker (socket refs themselves can't be
		// "disposed" via socket-ref's current API; they'll go away with
		// garbage collection once we drop our references to them).
		if (this._heartBeatInterval) {
			window.clearElectronInterval(this._heartBeatInterval);
			this._heartBeatInterval = null;
		}
		this._heartBeatRefs = [];
	}


	/**
	 * Helper to get the a command slug for this toy
	 * 
	 * @param {String} text - command text like 'Spawn'
	 * @returns {String} - the slugified text, like 'stream-buddies__text'
	 */
	static slugify(text){
		return this.slug + '__' + text.toLowerCase();
	}


	/**
	 * Helper to get the path to the assets
	 * 
	 * @param {String} assetID - the ID of the asset
	 * @returns {String} - the path to the asset
	 */
	getAssetPath(assetID) {
		const fileData = this.chatToysApp.assetsMgr.getFileData(assetID);

		// Defensive: a toy's stored settings can reference an asset that
		// was later deleted from the assets DB (the user wipes a row from
		// the asset browser, the toy still has the stale uuid). Returning
		// an empty string here lets the widget keep rendering with a
		// broken / placeholder image instead of crashing the whole app
		// at boot time.
		if (!fileData) {
			console.warn(`[Toy.getAssetPath] unknown asset id "${assetID}" referenced by toy ${this.slug || '?'}; returning empty path.`);
			return '';
		}

		if(fileData.internal)
			return `builtin/${fileData.name}`;
		else
			return `http://localhost:${this.chatToysApp.serverPort.value}/${fileData.file_path}`;
	}


	/**
	 * Helper to get command text (which can be changed by user) and is different from the slug
	 * 
	 * @param {String} commandSlug - command slug
	 * @returns {String} the command text
	 */
	getCommandFromSlug(commandSlug){

		// search the local commands list for the command slug
		commandSlug = this.constructor.slugify(commandSlug);
		const command = this.localCommandsList.value.find(cmd => cmd.slug === commandSlug);

		// if we found it, return it
		if(command)
			return command.command;

		// otherwise, return empty string
		return '';
	}


	/**
	 * Generates an array of URLS for single widgets
	 * 
	 * @returns {Array<String>} - array of urls for the widgets
	 */
	getWidgetURLs(){

		// loop over the widget components defined on this toy (if any)
		if(!this.static.widgetComponents)
			return [];

		// break out for legibility
		const isDev = window.env.isDev;

		// check if we're using a non standard port:
		const serverPort = this.chatToysApp.serverPort.value
		const showPort = (serverPort !== 3001);
	
		// if dev, host port is different
		const hostPort = isDev ? 8080 : serverPort;

		const urls = [];
		for(let widget of this.static.widgetComponents){

			let url = `http://localhost:${hostPort}/`;
			
			url += isDev ? 'live.html?' : 'live/?';

			url += showPort ? `port=${serverPort}&` : '';

			url += 'single=true&';

			url += `toy=${this.slug}&widget=${widget.slug}`;

			const desc = widget.description;

			urls.push({
				url,
				desc,
				toySlug: this.slug,
				widgetSlug: widget.slug,
			});

		}// next widget

		// return the urls
		return urls;
	}

}
