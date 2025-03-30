/*
	ToyState.js
	-----------

	This will be the base class for all the various state classes for
	our toys. Nothing will instantiate this class directly, but
	all toys (including the placeholder DummyToy) will extend this class.
*/

// our app
import { ToyManager } from "../scripts/ToyManager";
import { RefAggregator } from "../scripts/RefAggregator";
import { chromeShallowRef } from "../scripts/chromeRef";

// main export
export default class ToyState {

	/**
	 * Constructs the ToyState object
	 * 
	 * @param {ToyManager} toyManager - reference to the toy manager
	 * @param {String} slug - the toy's slug from the class that extends this one
	 */
	constructor(toyManager, slug) {

		// save reference to the toy manager but also grab our chat app
		this.toyManager = toyManager;
		this.chatToysApp = toyManager.chatToysApp;

		// save our slug even though it's also technically static
		this.slug = slug;

		// build our settings right away (the toy can override this)
		this.initSettings();

		// we'll auto-subscribe to the commands for this toy!
		// we'll use a callback that can be overridden by the toy
		this.chatToysApp.commandProcessor.hookToyCommands(this.slug, this.onCommand.bind(this));
	}


	/**
	 * Initialize the settings for this toy
	 * 
	 * This is a placeholder that the toy can override to set up its settings.
	 */
	initSettings() {

		// let the toy override this
	}


	/**
	 * Handle when an incoming command is sent to this toy
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
		// make both block and camel case versions
		const blockNameKebab = this.slug.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
		const blockNameCamel = blockNameKebab.replace(/-([a-z])/g, (g) => g[1].toUpperCase());

		// create a ref that will sync with chrome storage
		this.settingsStorRef = chromeShallowRef(blockNameKebab + '-settings', {});

		// create a ref aggregator to sync the settings & register them
		this.settingsAggregator = new RefAggregator(this.settingsStorRef);
		this.settingsAggregator.registerObject(this.settings);
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

}
