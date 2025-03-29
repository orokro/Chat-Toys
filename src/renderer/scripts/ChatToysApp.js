/*
	Options.js
	----------

	This file will provide a class that manages the state for the Options page.
*/

// vue
import { ref, shallowRef } from 'vue';
import { chromeRef, chromeShallowRef } from './chromeRef';

// our app
import { toysData } from './ToysData';
import { ToySettings } from './ToySettings';
import { AssetManager } from './assets_state/AssetManager';
import { ChatProcessor } from './ChatProcessor';
import { CommandProcessor } from './CommandProcessor';
import { ToyManager } from './ToyManager';

// lib/misc
import DragHelper from 'gdraghelper';

// main export
export default class ChatToysApp {

	/**
	 * Builds the main ChatToysApp object
	 */
	constructor() {

		// our global list of commands
		this.commands = chromeShallowRef('commands', {});
		
		// we will use a chromeRef to persist the list of enabled toys
		this.enabledToys = chromeShallowRef('enabledToys', []);

		// but a regular ref for the active toy (if any), since
		// this doesn't need to persist across tabs or even refreshes
		this.selectedToy = chromeRef('selectedToy', null);

		// if we have at least one enabled toy, set the first one as the active toy
		if (this.selectedToy.value==null && this.enabledToys.value.length > 0)
			this.selectedToy.value = this.enabledToys.value[0];

		// we'll load our assets from the AssetManager here in the Options class
		// the popup will also have it's own assets manager ref
		this.assetsMgr = new AssetManager();

		// this will build and/or populate the toy settings app-wide
		// they're stored from localStorage, so this will init them or repopulate them
		this.toySettings = new ToySettings(this);
		
		// make a new chat processor to handle all incoming chats from outside
		// note: this will handle messages coming from IPC messages from the electron
		// main process. The main process gets them from a WebSocket server from
		// a chrome plugin.
		this.chatProcessor = new ChatProcessor();

		// make a new command processor to handle all incoming commands
		this.commandProcessor = new CommandProcessor(this, this.chatProcessor);

		// for debug
		// this.commandProcessor.onCommandFound((commandSlug, msg, user, params) => {
		// 	console.log(`Command found: ${commandSlug} from `, user, 'in', msg, 'with params', params);
		// });

		// this will actually instantiate the toys and manage their state
		this.toyManager = new ToyManager(this);

		// reusable drag helper
		this.dragHelper = new DragHelper();

		// layout size
		this.layoutWidth = chromeRef('layoutWidth', 1280);
		this.layoutHeight = chromeRef('layoutHeight', 720);
	}
	

	/**
	 * Selects a toy to be the selected toy.
	 * 
	 * @param {string} toy - OPTIONAL; toy slug to set as selected, or leave undefined to clear the selected toy
	 */
	selectToy(toy) {

		// if toy is undefined, set selected toy to null
		if (toy === undefined) {
			this.selectedToy.value = null;
			return;
		}

		// set the selected toy
		this.selectedToy.value = toy;
	}


	/**
	 * Adds a toy to the user's enabled toys.
	 * 
	 * @param {string} slug - toy slug to add to our list of enabled toys
	 */
	addToy(slug) {

		// if the toy is already enabled, don't add it again
		if (this.enabledToys.value.includes(slug) === true)
			return;
		
		// add the toy to the list of enabled toys
		this.enabledToys.value = [...this.enabledToys.value, slug];

		// if this is the first toy added, set it as the active toy
		if (this.selectedToy.value === null)
			this.selectedToy.value = slug;
	}


	/**
	 * Removes a toy from users list of toys
	 * 
	 * @param {string} slug - toy slug to remove from our list of enabled toys
	 */
	removeToy(slug) {

		// find where the toy was in the list index wise
		const index = this.enabledToys.value.indexOf(slug);

		// remove the toy from the list of enabled toys
		this.enabledToys.value = this.enabledToys.value.filter(s => s !== slug);

		// if the toy was the active toy, we should select the next closest index
		// that is still valid in the array
		if (this.selectedToy.value === slug) {

			// if there are no toys left, set active toy to null
			if (this.enabledToys.value.length === 0) {
				this.selectedToy.value = null;
				return;
			}

			// if the toy was the last in the list, select the previous toy
			if (index === this.enabledToys.value.length)
				this.selectedToy.value = this.enabledToys.value[index - 1];
			else
				this.selectedToy.value = this.enabledToys.value[index];
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

}
