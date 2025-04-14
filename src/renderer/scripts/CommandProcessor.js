/*
	CommandProcessor.js
	-------------------

	Handles the commands we get from live chat.
*/

// vue
import { computed, watch } from 'vue';

// our app
import { ChatProcessor } from "./ChatProcessor";
import ChatToysApp from "./ChatToysApp";
import ChannelPoints from '@toys/ChannelPoints/ChannelPoints';

/**
 * CommandProcessor class
 */
export class CommandProcessor {

	/**
	 * Builds the command Processor
	 * 
	 * @param {ChatToysApp} chatToysApp - The main ChatToysApp object
	 * @param {ChatProcessor} chatProcessor - The ChatProcessor object
	 */
	constructor(chatToysApp, chatProcessor) {

		// save our app / references
		this.chatToysApp = chatToysApp;
		this.chatProcessor = chatProcessor;
		this.commandsRef = this.chatToysApp.commands

		// build a map of commands for easy lookup
		this.commandMap = {};
		this.buildCommandMap();

		// out map of listeners based on toySlugs
		this.toyHooks = new Map();

		// true when we have 'channelPoints' enabled
		this.enableCosts = computed(()=>
			this.chatToysApp.enabledToys.value.includes(ChannelPoints.slug));

		// maps of timestamps for user cooldowns
		this.userCooldowns = new Map();
		this.groupCooldowns = new Map();

		// list of callbacks for when any command is detected
		this.commandCallbacks = [];

		// set up our listeners / watchers
		this.subscribeEvents();
	}


	/**
	 * Add a callback to run when a command is found
	 * 
	 * @param {Function} callback - Callback to run when a command is found
	 */
	onCommandFound(callback) {
		this.commandCallbacks.push(callback);
	}


	/**
	 * Subscribe to events and set up vue watchers
	 */
	subscribeEvents() {

		// whenever the commands change, rebuild the command map
		watch(this.commandsRef, ()=> this.buildCommandMap());

		// subscribe to the stream of new chat messages to check for commands
		this.chatProcessor.onNewChats((messages) => this.handleChats(messages));
	}


	/**
	 * Allow app to hook into one of the slugs for those commands
	 * 
	 * @param {String} toySlug - The toy slug to hook commands for, like "chat" or "tosser", etc
	 * @param {Function} callback - What to call when one of the matching commands is found
	 */
	hookToyCommands(toySlug, callback) {

		// add to list of call backs for this toySlug
		if (this.toyHooks.has(toySlug) == false)
			this.toyHooks.set(toySlug, []);
		this.toyHooks.get(toySlug).push(callback);
	}


	/**
	 * Build a map of commands for easy lookup
	 */
	buildCommandMap(){

		// build a map of commands for easy lookup
		// note: we need to run this every time this.commandsRef changes
		this.commandMap = Object.values(this.commandsRef.value).reduce((map, cmd) => {
			map[cmd.command] = cmd;
			return map;
		}, {});
	}


	/**
	 * Check incoming chat messages for commands
	 * 
	 * @param {Array<Object>} messages - Array of new messages to look for commands
	 */
	handleChats(messages) {

		const commandMap = this.commandMap;

		// loop through each message
		for (const msg of messages) {

			// get the message text, author, if they're a member, and if its a super chat
			const { messageText, authorUniqueID, isMember, isSuper } = msg;

			// must contain and start with '!' to be a command
			if (messageText.startsWith('!') == false)
				continue;

			// split the message into parts, starting after the '!'
			const parts = messageText.slice(1).split(/\s+/);

			// if the first part is not a complete command, skip
			// or if the command is not enabled GTFO
			const commandKey = parts[0];
			const commandData = commandMap[commandKey];
			if (!commandData || !commandData.enabled)
				continue;

			// get potential params (not all commands have params)
			const params = this.parseParams(commandData, messageText);

			// get the user data from our data base
			const user = this.getUser(authorUniqueID);

			// make sure this command is able to be run
			if (this.validateCommand(commandData, user, params) == false)
				continue;

			// lastly we need to check super chat and member status, if required
			if(commandData.memberOnly==true && isMember==false){
				this.chatToysApp.log.err(`${msg.author}: "${commandData.command}" is a member-only command`);
				continue;
			}
			if(commandData.superOnly==true && isSuper==false){
				this.chatToysApp.log.err(`${msg.author}: "${commandData.command}" is a Super-Chat-only command`);
				continue;
			}

			// split the command slug into toy and command parts
			const [toySlug, commandSlug] = commandData.slug.split(/__/, 2);

			// notify all listeners of this command that was successfully run
			for (const cb of this.commandCallbacks)
				cb(commandSlug, msg, user, params);

			// if we don't have any listeners for this command, skip further processing
			if (this.toyHooks.has(toySlug) == false)
				continue;

			// notify all listeners of this command that was successfully run
			this._notifyListeners(toySlug, commandSlug, msg, user, params, commandData);

			// Update cooldowns
			const now = Date.now();
			this.userCooldowns.set(`${commandData.slug}:${user.id}`, now);
			this.groupCooldowns.set(commandData.slug, now);
		}
	}


	/**
	 * Get's a user from our database, or a dummy user if none is found
	 * 
	 * @param {String} id - user unique ID
	 */
	getUser(id){
		
		// get from database
		const userFromDB = window.ytctDB.getUser(id);

		// if not null, return as is
		if (userFromDB)
			return userFromDB;

		// if not found, return a dummy user
		return {
			banned: 0,
			display_name: 'Unknown Chatter',
			points: 0,
			youtube_id: id,
		};
	}


	/**
	 * Parse the parameters from a command message
	 * 
	 * @param {Object} commandData - The command data object
	 * @param {String} messageText - The full message text
	 * @returns {Array<String>} - Array of parsed parameters
	 */
	parseParams(commandData, messageText) {

		console.log('commandData', commandData, messageText);
		// get the raw message text, trim it, and remove the command part
		// +2 for '!' and space
		const raw = messageText.trim().slice(commandData.command.length + 2); 
		const paramDefs = commandData.params || [];

		// if this command doesn't have any params, return an empty array
		if (paramDefs.length === 0) return {};

		// if this command only has one param, return the raw remainder of the message
		if (paramDefs.length === 1) {

			if(raw.length === 0)
				return {};
			
			let val = raw;
			if(paramDefs[0].type === 'number')
				val = parseFloat(val, 10);
			if(paramDefs[0].type === 'username' && val.startsWith('@'))
				val = val.slice(1);
			return {
				[paramDefs[0].name]: val
			}
		};

		// If we got here, we have multiple params, so we need to parse them
		// some of them might be quoted, so we need to handle that
		const quoted = raw.match(/"(.*?)"|(\S+)/g) || [];
		const clean = quoted.map(str => str.replace(/(^"|"$)/g, ''));

		// if there's more params than defined, combine the last ones into one
		if (clean.length > paramDefs.length) {
			const last = clean.slice(paramDefs.length - 1).join(' ');
			clean.splice(paramDefs.length - 1, clean.length - paramDefs.length + 1, last);
		}

		// add some extra processing for params based on type
		for (let i = 0; i < paramDefs.length; i++) {

			// convert numbers to actual numbers (i.e. not strings)
			if (paramDefs[i].type === 'number')
				clean[i] = parseFloat(clean[i], 10);

			// if the type is username, remove potential @ symbol
			if (paramDefs[i].type === 'username' && clean[i].startsWith('@'))
				clean[i] = clean[i].slice(1);
			
		}// next i
		
		// instead of returning an array, make an object with the names as keys
		const obj = {};
		for (let i = 0; i < paramDefs.length; i++)
			obj[paramDefs[i].name] = clean[i];

		return obj;
	}


	/**
	 * Makes sure our command is able to be run
	 * 
	 * @param {Object} commandData - The command data object
	 * @param {Object} user - The user object
	 * @param {Object} params - Optional parameters
	 * @returns {Boolean} - True if the command is valid and can be run
	 */
	validateCommand(commandData, user, params) {

		// if the user is banned, GTFO
		if (user.banned){
			console.error(`User ${user.display_name} is banned`);
			return false;
		}

		// if the command is not enabled, GTFO
		if (!commandData.enabled){
			console.error(`Command "${commandData.command}" is disabled`);
			return false;
		}

		// gather some data we need
		const now = Date.now();
		const slug = commandData.slug;
		const userKey = `${commandData.slug}:${user.id}`;

		// Cooldowns
		if (commandData.coolDown) {

			// check if the time since the last time THIS user ran THIS command
			// is less than the cooldown time, if so, GTFO
			const last = this.userCooldowns.get(userKey);

			if (last && (now - last) < commandData.coolDown * 1000) {

				console.error('User cooldown not met');

				const timeToTryAgain = Math.ceil(commandData.coolDown - ((now - last)/ 1000) );
				this.chatToysApp.log.err(`${user.display_name}: try again in ${timeToTryAgain} seconds`);

				return false;
			}
		}

		// Group cooldown
		if (commandData.groupCoolDown) {

			// check if the time since the last time ANY user ran THIS command
			// is less than the cooldown time, if so, GTFO
			const last = this.groupCooldowns.get(slug);
			if (last && (now - last) < commandData.groupCoolDown * 1000) {
				console.error('Group cooldown not met');

				const timeToTryAgain = Math.ceil(commandData.groupCoolDown - ((now - last)/ 1000) );
				this.chatToysApp.log.err(`${commandData.command}: is on group-cooldown, try again in ${timeToTryAgain} seconds`);

				return false;
			}
		}

		// Cost check
		if (this.enableCosts.value==true){
			if(commandData.costEnabled && user.points < commandData.cost) {
				console.error('Not enough points');
				return false;
			}
		}

		// Param validation
		const paramDefs = commandData.params || [];
		if (params.length < paramDefs.filter(p => !p.optional).length) {
			console.error('Missing required parameters');
			return false;
		}

		// Check param types
		for (let i = 0; i < paramDefs.length; i++) {

			const def = paramDefs[i];
			const val = params[def.name];

			if (!val && !def.optional) {
				console.error(`Missing required param: ${def.name}`);
				return false;
			}
			
			if(val!==undefined && !def.optional){

				if (!val && def.type === 'number' && isNaN(parseFloat(val, 10))) {
					console.log(val, parseInt(val, 10), isNaN(parseInt(val, 10)));
					console.error(`Invalid number for param: ${def.name}`);
					return false;
				}
			}

		}// next i

		return true;
	}


	/**
	 * Notifies all listeners of a command that was run
	 * 
	 * @param {String} toySlug - slug for the toy that listeners are hooked to (like "chat" or "tosser")
	 * @param {String} commandSlug - specifically which command was run
	 * @param {Object} msg - the original chat message details that triggered the command
	 * @param {Object} user - details about the user MAY BE a dummy object if user is not found
	 * @param {Array<String>} params - the parameters passed to the command
	 * @param {Object} commandData - details about the command from our settings
	 */
	_notifyListeners(toySlug, commandSlug, msg, user, params, commandData) {

		// get all the listeners for this toySlug
		const hooks = this.toyHooks.get(toySlug) || [];

		// only allow one listener to accept the command
		let wasAccepted = false;
	
		// notify all listeners of this command that was successfully run
		for (const cb of hooks) {

			// build a method to accept the command
			const accept = () => {

				// only allow one listener to accept the command
				if (wasAccepted) 
					return;
				wasAccepted = true;

				// update the user's points and other data
				window.ytctDB.updateUser(msg.authorUniqueID, {
					displayName: msg.author,
					streamID: msg.streamID,
					command: commandData.command,
					relativePoints: (this.enableCosts.value === true && commandData.costEnabled)
						? commandData.cost
						: 0,
				});
			};
			
			// build a method to reject the command
			const reject = (reason) => {
				const errMsg = `"!${commandSlug}" rejected by listener: ${reason}`
				console.log(errMsg);
				this.chatToysApp.log.err(reason);
			};
	
			// call the listener with the command details
			cb(commandSlug, msg, user, params, { accept, reject });
		}
	}

}
