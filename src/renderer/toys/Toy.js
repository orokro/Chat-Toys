/*
	Toy.js
	------

	This will be the base class for all our toys.

	It will not only handle the state for when they're live,
	but also act as a base for the commands and settings.
*/

// vue
import { ref, shallowRef, watch } from 'vue';
import { socketRef, socketShallowRef } from 'socket-ref';

// our app
import { ToyManager } from "../scripts/ToyManager";
import { RefAggregator } from "../scripts/RefAggregator";
import { chromeShallowRef } from "../scripts/chromeRef";

// main export
export default class Toy {

	/**
	 * Constructs the Toy object
	 * 
	 * @param {ToyManager} toyManager - reference to the toy manager
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
		this.chatToysApp.commandProcessor.hookToyCommands(this.slug, this.onCommand.bind(this));
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

			// return the command object
            return {
                command,
                description,
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

		// now for some magic - we'll watch the settings object for changes
		// and update a socket ref with the json, so our live page can update
		this.settingsSocketRef = socketShallowRef(blockNameKebab + '-settings', this.settingsStorRef.value);
		this.stopSettingsSocketWatch = watch(this.settingsStorRef, (newVal) => {
			this.settingsSocketRef.value = newVal;
		});
		setTimeout(()=>
			this.settingsSocketRef.value = this.settingsStorRef.value, 1000);
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
			// otherwise, we'll just add the command from the commands state
			else {
				newLocalCommandsList.push(commandsState[slug]);
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

		// stop watching the settings
		this.stopSettingsSocketWatch();
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
			
			url += isDev ? 'live.html?' : '/live/?';

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
