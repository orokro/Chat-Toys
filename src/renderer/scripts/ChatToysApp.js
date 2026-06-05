/*
	Options.js
	----------

	This file will provide a class that manages the state for the Options page.
*/

// vue
import { ref, shallowRef, watch } from 'vue';
import { chromeRef, chromeShallowRef } from './chromeRef';
import { socketShallowRef, socketShallowRefReadOnly } from 'socket-ref';
import { RefAggregator } from './RefAggregator';

// our app
import { toysData } from '../toys/ToysData';
import { AssetManager } from './assets_state/AssetManager';
import { ChatProcessor } from './ChatProcessor';
import { CommandProcessor } from './CommandProcessor';
import { TwitchEvents } from './TwitchEvents';
import { ToyManager } from './ToyManager';
import { OmniRegistry } from './OmniRegistry';
import { SysLogger } from './SysLogger';
import { OBSConnectionManager } from './OBSConnectionManager.js';
import { PluginBridge } from '../plugins/PluginBridge.js';
import { YouTubeConnectionManager } from './YouTubeConnectionManager.js';
import { VTSConnectionManager } from './VTSConnectionManager.js';
import { BTTVManager } from './BTTVManager.js';

// lib/misc
import DragHelper from 'gdraghelper';

// main export
export default class ChatToysApp {

	/**
	 * Builds the main ChatToysApp object
	 */
	constructor() {

		// save our static coded list of toys
		this.toysData = toysData;

		// our global list of commands
		this.commands = chromeShallowRef('commands', {});

		// clean up any deprecated commands from older versions
		this.deleteDeprecatedCommands();

		// we will use a chromeRef to persist the list of enabled toys
		this.enabledToys = chromeShallowRef('enabledToys', []);

		// build some general settings for the app
		this.buildSettings();

		// integrated logging for on screen messages
		this.log = new SysLogger(this);

		// true when we wanna render widgets in demo mode
		this.demoMode = socketShallowRef('demoMode', false);

		// port number for the obs server stuff
		this.serverPort = shallowRef(window.initPort);

		// make an OBS connection manager to handle our OBS WebSocket connection
		this.obsConnMgr = new OBSConnectionManager(this);

		// make a YouTube connection manager to handle YouTube live status, etc
		this.ytConnMgr = new YouTubeConnectionManager(this);

		// make a new VTS connection manager to handle VTube Studio connection
		this.vtsConnMgr = new VTSConnectionManager(this);

		// BTTV integration for Twitch emojis
		this.bttvMgr = new BTTVManager(this);
		
		// unrelated to our logger above, we'll also receive messages from from the OBS server
		// NOTE: this is for widgets telling us what's going on in OBS with them
		// not for the OBS websocket connection itself
		this.obsServerMessages = shallowRef([]);
		
		// Hook up to Electron API
		window.electronAPI.onServerLog((message)=>{
			const messages = [...this.obsServerMessages.value, message];
			while(messages.length > 100)
				messages.shift();
			this.obsServerMessages.value = messages;
		});

		// The currently-selected item in each top-level box. One ref per
		// toyClass; kept in a map so add/remove/select logic is class-generic.
		this.selectedToy = chromeRef('selectedToy', null);
		this.selectedGame = chromeRef('selectedGame', null);
		this.selectedTool = chromeRef('selectedTool', null);
		this.selectionRefs = {
			toy: this.selectedToy,
			game: this.selectedGame,
			tool: this.selectedTool,
		};

		// for each class, if nothing is selected yet, select its first enabled item
		for (const cls of Object.keys(this.selectionRefs)) {
			const ref = this.selectionRefs[cls];
			if (ref.value == null) {
				const first = this.enabledToys.value.find(slug => this.classOf(slug) === cls);
				if (first) ref.value = first;
			}
		}

		// we'll load our assets from the AssetManager here in the Options class
		// the popup will also have it's own assets manager ref
		this.assetsMgr = new AssetManager(this);
		
		// make a new chat processor to handle all incoming chats from outside
		// note: this will handle messages coming from IPC messages from the electron
		// main process. The main process gets them from a WebSocket server from
		// a chrome plugin.
		this.chatProcessor = new ChatProcessor(this);

		// make a new command processor to handle all incoming commands
		this.commandProcessor = new CommandProcessor(this, this.chatProcessor);

		// Twitch event bus - dispatches EventSub events (redemptions in
		// Phase 3; bits / subs / follows / raids later) to subscribing
		// toys. Created BEFORE ToyManager so toys can subscribe at
		// construction time.
		this.twitchEvents = new TwitchEvents(this);

		// in-process registry that coordinates the Omni toy's "gating" of
		// alert-style toys (Shout, Donations, Help, Media, HeadPat-chatter,
		// PrizeWheel). Toys check this before firing; if an owning omni is
		// currently busy with another included toy, the firing is held.
		// Must be available before toyManager constructs toys, since alert
		// toys reference it from their constructors.
		this.omniRegistry = new OmniRegistry();

		// this will actually instantiate the toys and manage their state
		this.toyManager = new ToyManager(this);

		// bridge for OBS/live-page plugin widgets to reach their PluginToy
		// brokers over the WS transport. Created after toyManager so it can
		// resolve toys by slug. No-op in non-primary windows.
		this.pluginBridge = new PluginBridge(this);

		// reusable drag helper
		this.dragHelper = new DragHelper();

		// Example: hook into OBS live / offline for later YouTubeConnectionManager usage
		this.obsConnMgr.onOBSLive(() => {
			console.log('OBS is live -> start polling YouTube, etc');
		});

		this.obsConnMgr.onOBSOffline(() => {
			console.log('OBS offline -> stop polling YouTube, etc');
		});

	}
	

	/**
	 * Deletes any deprecated commands from older versions.
	 */
	deleteDeprecatedCommands(){

		// grab current commands object (or empty if somehow missing)
		const commandsState = this.commands.value || {};
		
		// keys we want to delete if present
		const keysToRemove = [
			'chat__shout',
			'chat__swarm',
		];
		
		let mutated = false;
		
		for (const key of keysToRemove) {
			if (key in commandsState) {
				delete commandsState[key];
				mutated = true;
			}
		}
		
		// reassign so chromeShallowRef watchers fire and storage updates
		if (mutated)
			this.commands.value = { ...commandsState };
	}


	buildSettings() {

		// make general settings to store the output widget box
		this.settings = {			
			stageWidth: ref(1280),
			stageHeight: ref(720),
			enabledToys: this.enabledToys,	
		};

		const isPrimaryWindow = !!window.isPrimaryWindow;

		if (isPrimaryWindow) {
			this.settingsStorRef = chromeShallowRef('general-settings', {});
			this.settingsSocketRef = socketShallowRef('general-settings', {...this.settingsStorRef.value});

			this.settingsAggregator = new RefAggregator(this.settingsStorRef);
			this.settingsAggregator.registerObject(this.settings);

			this.stopSettingsSocketWatch = watch(this.settingsStorRef, (newVal) => {
				this.settingsSocketRef.value = {...newVal};
			});
			window.setElectronTimeout(() => {
				this.settingsSocketRef.value = this.settingsStorRef.value;
			}, 1000);
		} else {
			this.settingsStorRef = shallowRef({});
			this.settingsSocketRef = socketShallowRefReadOnly('general-settings', {});

			this.settingsAggregator = new RefAggregator(this.settingsStorRef);
			this.settingsAggregator.registerObject(this.settings);

			this.stopSettingsSocketWatch = watch(this.settingsSocketRef, (newVal) => {
				if (newVal && typeof newVal === 'object') {
					this.settingsStorRef.value = newVal;
				}
			}, { immediate: true });
		}
	}


	/**
	 * Scan every enabled toy's settings refs for a reference to the given
	 * asset id. Returns the toys that match.
	 *
	 * The check is a JSON substring scan for the quoted id string. Asset
	 * ids are stored as JSON string values (e.g. `"chatBoxImage":"3"`),
	 * so wrapping the id in quotes prevents false matches against
	 * numeric settings (`"chatTextSize":30` won't match id `"3"` because
	 * the 30 isn't wrapped in quotes in JSON).
	 *
	 * Only ACTIVE (currently-enabled) toys are scanned - inactive toys
	 * keep their settings in storage but their reactive refs aren't live,
	 * and the asset browser's stated UX is "where is this asset CURRENTLY
	 * being used". Toy reactivation later WILL re-bind to the asset if
	 * the toy's stored setting still names this id.
	 *
	 * @param {string} assetId
	 * @returns {Array<{ slug:string, name:string, themeColor:string }>}
	 */
	findToysUsingAsset(assetId) {

		if (!assetId) return [];
		const needle = `"${String(assetId)}"`;
		const out = [];

		const enabled = this.enabledToys?.value || [];
		const toys = this.toyManager?.toys || {};

		for (const slug of enabled) {
			const toy = toys[slug];
			if (!toy || !toy.settings) continue;

			try {
				// Snapshot the toy's reactive settings into a plain object,
				// then JSON-stringify and check for the quoted id.
				const flat = {};
				for (const key of Object.keys(toy.settings)) {
					const ref = toy.settings[key];
					flat[key] = ref ? ref.value : undefined;
				}
				const json = JSON.stringify(flat);
				if (json && json.includes(needle)) {
					out.push({
						slug,
						name: toy.static?.name || slug,
						themeColor: toy.static?.themeColor || '#888',
					});
				}
			} catch (err) {
				console.warn(`[findToysUsingAsset] failed to scan ${slug}:`, err);
			}
		}

		return out;
	}


	/**
	 * The toyClass ('toy' | 'game' | 'tool') for a given slug, defaulting to
	 * 'toy' for anything unknown/legacy.
	 *
	 * @param {string} slug
	 * @returns {string}
	 */
	classOf(slug) {
		const c = this.toysData.asObject[slug];
		return (c && c.toyClass) || 'toy';
	}


	/**
	 * The selection ref for a toyClass.
	 *
	 * @param {string} cls
	 * @returns {import('vue').Ref}
	 */
	getSelectionRef(cls) {
		return this.selectionRefs[cls] || this.selectedToy;
	}


	/**
	 * Set (or clear, if undefined) the selected item for a class.
	 *
	 * @param {string} cls
	 * @param {string} [slug] - leave undefined to clear
	 */
	selectForClass(cls, slug) {
		this.getSelectionRef(cls).value = (slug === undefined) ? null : slug;
	}


	/**
	 * Jump the main UI to the settings page for the given slug. Used by the
	 * asset browser's "Toys using this asset" list. Picks the right tab + box
	 * by the toy's class.
	 *
	 * @param {string} slug
	 */
	navigateToToyByAsset(slug) {

		const constructor = this.toysData?.asObject?.[slug];
		if (!constructor) {
			console.warn(`[navigateToToyByAsset] unknown slug: ${slug}`);
			return;
		}

		// tab indices match MainWindow.vue's tabs array.
		const cls = this.classOf(slug);
		const tabIndex = { toy: 2, game: 3, tool: 4 }[cls] ?? 2;
		chromeRef('mainTab', 0).value = tabIndex;

		this.selectForClass(cls, slug);
	}


	/**
	 * Selects a toy. (Kept for back-compat; prefer selectForClass.)
	 *
	 * @param {string} [toy] - slug, or undefined to clear
	 */
	selectToy(toy) {
		this.selectForClass('toy', toy);
	}


	/**
	 * Selects a tool. (Kept for back-compat; prefer selectForClass.)
	 *
	 * @param {string} [tool] - slug, or undefined to clear
	 */
	selectTool(tool) {
		this.selectForClass('tool', tool);
	}


	/**
	 * Adds a toy to the user's enabled toys, selecting it if its box is empty.
	 *
	 * @param {string} slug - toy slug to add to our list of enabled toys
	 */
	addToy(slug) {

		// if the toy is already enabled, don't add it again
		if (this.enabledToys.value.includes(slug) === true)
			return;

		// add the toy to the list of enabled toys
		this.enabledToys.value = [...this.enabledToys.value, slug];

		// if this is the first item in its box, make it the active one
		const ref = this.getSelectionRef(this.classOf(slug));
		if (ref.value === null)
			ref.value = slug;
	}


	/**
	 * Removes a toy from the user's enabled toys, advancing the selection
	 * within the same class if the removed item was selected.
	 *
	 * @param {string} slug - toy slug to remove from our list of enabled toys
	 */
	removeToy(slug) {

		const cls = this.classOf(slug);

		// the enabled items in the same box, in order
		const currentList = this.enabledToys.value.filter(s => this.classOf(s) === cls);
		const index = currentList.indexOf(slug);

		// remove the toy from the global list of enabled toys
		this.enabledToys.value = this.enabledToys.value.filter(s => s !== slug);

		const selectionRef = this.getSelectionRef(cls);

		// if it was the active item, select the next closest valid one
		if (selectionRef.value === slug) {

			const updatedList = currentList.filter(s => s !== slug);

			if (updatedList.length === 0) {
				selectionRef.value = null;
				return;
			}

			if (index >= updatedList.length)
				selectionRef.value = updatedList[updatedList.length - 1];
			else
				selectionRef.value = updatedList[index];
		}
	}

	
	/**
	 * For debug, resets the list of commands.
	 */
	resetCommands() {
		this.commands.value = {};
	}


	/**
	 * For debug, resets our local storage and reloads the page.
	 */
	nukeStorageAndReload() {
		localStorage.clear();
		location.reload();
	}

	/**
	 * Clean up the app when it's about to be removed
	 */
	end() {
		console.log('Ending ChatToysApp...');

		// stop general settings watch
		if (this.stopSettingsSocketWatch)
			this.stopSettingsSocketWatch();

		// tell toy manager to end all toys
		if (this.toyManager)
			this.toyManager.restartToysState(); // this calls end() on each toy
	}
	
}
