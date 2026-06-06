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

		// Top-level tab indices (mirror MainWindow.vue's `tabs` array). The
		// single source of truth for "which tab is what" so navigation +
		// search don't hardcode magic numbers all over.
		this.TAB = { help: 0, settings: 1, toy: 2, game: 3, tool: 4, system: 5 };

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
	 * Tab index for a toyClass.
	 *
	 * @param {string} cls
	 * @returns {number}
	 */
	tabIndexForClass(cls) {
		return this.TAB[cls] ?? this.TAB.toy;
	}


	/**
	 * Switch the main window to a top-level tab by index. `mainTab` is a
	 * chromeRef, so writing it here syncs to MainWindow's `activeTab`.
	 *
	 * @param {number} tabIndex
	 */
	navigateToTab(tabIndex) {
		chromeRef('mainTab', 0).value = tabIndex;
	}


	/**
	 * Open a toy/tool/game's settings page: switch to its class tab and select
	 * it in that box's strip.
	 *
	 * @param {string} slug
	 */
	navigateToToy(slug) {
		if (!this.toysData.asObject[slug]) {
			console.warn(`[navigateToToy] unknown slug: ${slug}`);
			return;
		}
		const cls = this.classOf(slug);
		this.navigateToTab(this.tabIndexForClass(cls));
		this.selectForClass(cls, slug);
	}


	/**
	 * Unified navigation entry point. Destinations come from
	 * getNavDestinations() (and the store / spotlight search).
	 *
	 * @param {Object} dest - { slug } to open a toy, or { tab } for a top-level tab
	 */
	navigateTo(dest) {
		if (!dest) return;
		if (dest.slug) { this.navigateToToy(dest.slug); return; }
		if (typeof dest.tab === 'number') {
			// sub-page: set the page's side-tab chromeRef before switching tab
			if (dest.subKey)
				chromeRef(dest.subKey, dest.subValue).value = dest.subValue;
			this.navigateToTab(dest.tab);
			return;
		}
	}


	/**
	 * Back-compat alias used by the asset browser.
	 *
	 * @param {string} slug
	 */
	navigateToToyByAsset(slug) {
		this.navigateToToy(slug);
	}


	/**
	 * The list of navigable destinations for search / quick-jump UIs: the
	 * permanent app pages plus every currently-enabled toy/tool/game (dynamic
	 * pages only exist when added). Each entry carries keywords for matching.
	 *
	 * @returns {Array<Object>} { id, label, tab?, slug?, toyClass?, keywords[] }
	 */
	getNavDestinations() {

		const isDev = !!(typeof window !== 'undefined' && window.env && window.env.isDev);

		// top-level tabs
		const out = [
			{ id: 'tab:help',     label: 'Help',                tab: this.TAB.help,     icon: 'menu_book',         kind: 'Page', keywords: ['help', 'docs', 'guide', 'how to'] },
			{ id: 'tab:settings', label: 'Connection Settings', tab: this.TAB.settings, icon: 'settings_ethernet', kind: 'Page', keywords: ['connection', 'settings', 'auth'] },
			{ id: 'tab:toy',      label: 'Toy Box',             tab: this.TAB.toy,      icon: 'toys',              kind: 'Page', keywords: ['toys', 'toy box', 'add'] },
			{ id: 'tab:game',     label: 'Games',               tab: this.TAB.game,     icon: 'sports_esports',    kind: 'Page', keywords: ['games'] },
			{ id: 'tab:tool',     label: 'Tool Box',            tab: this.TAB.tool,     icon: 'build',             kind: 'Page', keywords: ['tools', 'tool box'] },
			{ id: 'tab:system',   label: 'System',              tab: this.TAB.system,   icon: 'storage',           kind: 'Page', keywords: ['system', 'database'] },
		];

		// sub-pages within the permanent tabs (each sets its side-tab chromeRef)
		const sub = (id, label, tab, subKey, subValue, icon, group, kw = []) =>
			({ id, label, tab, subKey, subValue, icon, kind: group, keywords: [label, group, ...kw] });

		out.push(
			// Help
			sub('help:welcome', 'Welcome', this.TAB.help, 'helpPageTab', 'help_welcome', 'waving_hand', 'Help'),
			sub('help:docs', 'Help Docs', this.TAB.help, 'helpPageTab', 'helpDocs', 'help', 'Help', ['guide', 'how to']),
			sub('help:videos', 'Videos', this.TAB.help, 'helpPageTab', 'help_videos', 'play_circle', 'Help'),
			sub('help:contact', 'Contact', this.TAB.help, 'helpPageTab', 'help_contact', 'mail', 'Help', ['support', 'email']),
			sub('help:credits', 'Credits', this.TAB.help, 'helpPageTab', 'credits', 'workspace_premium', 'Help'),
			// Connection Settings
			sub('set:chat', 'Chat Settings', this.TAB.settings, 'settingsPageTab', 'chatSettings', 'chat', 'Settings', ['youtube']),
			sub('set:twitch', 'Twitch Settings', this.TAB.settings, 'settingsPageTab', 'twurple', 'sensors', 'Settings', ['connect', 'auth']),
			sub('set:general', 'General Settings', this.TAB.settings, 'settingsPageTab', 'obsSettings', 'tune', 'Settings', ['obs', 'port']),
			sub('set:vts', 'VTubeStudio Settings', this.TAB.settings, 'settingsPageTab', 'vtsSettings', 'face', 'Settings', ['vtuber', 'vts']),
			sub('set:bttv', 'BTTV Integration', this.TAB.settings, 'settingsPageTab', 'bttv', 'sentiment_satisfied', 'Settings', ['emotes']),
			// System
			sub('sys:widgets', 'Widgets', this.TAB.system, 'databasePageTab', 'widgets', 'widgets', 'System'),
			sub('sys:commands', 'Commands', this.TAB.system, 'databasePageTab', 'commands', 'terminal', 'System', ['triggers']),
			sub('sys:assets', 'Assets', this.TAB.system, 'databasePageTab', 'assets_db', 'folder', 'System', ['images', 'sounds']),
			sub('sys:users', 'Users', this.TAB.system, 'databasePageTab', 'users_db', 'group', 'System', ['points', 'viewers']),
		);
		if (isDev)
			out.push(sub('sys:debug', 'Debug Tools', this.TAB.system, 'databasePageTab', 'debug', 'bug_report', 'System'));

		// dynamic: each enabled toy/tool/game is its own page
		for (const slug of this.enabledToys.value) {
			const c = this.toysData.asObject[slug];
			if (!c) continue;
			out.push({
				id: `toy:${slug}`,
				label: c.name,
				slug,
				toyClass: c.toyClass || 'toy',
				keywords: [c.name, c.desc || ''].filter(Boolean),
			});
		}

		return out;
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
