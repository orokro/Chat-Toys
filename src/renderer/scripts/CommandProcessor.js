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

		// list of callbacks for when any command is detected / run
		this.commandCallbacks = [];
		this.commandRunCallbacks = [];

		// list of callbacks for when a command is rejected by its toy
		// (action couldn't be fulfilled). TwitchRedeems uses this to refund
		// the Twitch channel points for source:'twitch-redeem' messages.
		this.commandRejectCallbacks = [];

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
	 * Add a callback to run when a command is run
	 * 
	 * @param {Function} callback - Callback to run when a command is run
	 */
	onCommandRun(callback) {
		this.commandRunCallbacks.push(callback);
	}


	/**
	 * Clear a callback for when a command is run
	 * 
	 * @param {Function} callback - Callback to remove
	 */
	offCommandRun(callback) {
		this.commandRunCallbacks = this.commandRunCallbacks.filter(cb => cb !== callback);
	}

	
	/**
	 * Tell all listeners that a command was run (accepted / successful)
	 * 
	 * @param {String} commandSlug - slug for command that was run
	 * @param {Object} msg - the original chat message details that triggered the command
	 * @param {Object} commandData - details about the command from our settings
	 */
	_notifyRunListeners(commandSlug, msg, commandData) {

		// notify all listeners of this command that was successfully run
		for (const cb of this.commandRunCallbacks)
			cb(commandSlug, msg, commandData);
	}


	/**
	 * Add a callback to run when a command is rejected by its toy.
	 *
	 * @param {Function} callback - Callback to run when a command is rejected
	 */
	onCommandReject(callback) {
		this.commandRejectCallbacks.push(callback);
	}


	/**
	 * Clear a callback for when a command is rejected.
	 *
	 * @param {Function} callback - Callback to remove
	 */
	offCommandReject(callback) {
		this.commandRejectCallbacks = this.commandRejectCallbacks.filter(cb => cb !== callback);
	}


	/**
	 * Tell all listeners that a command was rejected (could not be
	 * fulfilled). For Twitch-redeem-sourced messages this is what drives
	 * the automatic channel-point refund.
	 *
	 * @param {String} commandSlug - slug for the command that was rejected
	 * @param {Object} msg - the original chat message details that triggered the command
	 * @param {String} reason - human-readable reason the command was rejected
	 * @param {Object} commandData - details about the command from our settings
	 */
	_notifyRejectListeners(commandSlug, msg, reason, commandData) {

		// notify all listeners of this command that was rejected
		for (const cb of this.commandRejectCallbacks)
			cb(commandSlug, msg, reason, commandData);
	}


	/**
	 * Refund a Twitch redeem that was dropped before it ever reached its
	 * toy - i.e. blocked by a pre-dispatch gate in handleChats (disabled,
	 * failed validation/cooldown, member-only, super-only, or no toy
	 * listening). Those gates short-circuit with `continue` and never run
	 * the accept/reject handshake, so without this the viewer's channel
	 * points would be taken with nothing to show for it. Routes through the
	 * same reject listeners as a toy-raised reject. No-op for ordinary chat
	 * messages (only source:'twitch-redeem' messages are refundable).
	 *
	 * @param {Object} msg - the message whose command was dropped
	 * @param {String} reason - human-readable reason it was dropped
	 * @param {Object} [commandData] - the command's settings record, if known
	 */
	_refundDroppedRedeem(msg, reason, commandData) {

		// only redeem-sourced messages carry a refundable redemption
		if (!msg || msg.source !== 'twitch-redeem')
			return;

		// commandData may be absent (unknown command); fall back to ''
		const commandSlug = commandData?.slug
			? (commandData.slug.split(/__/, 2)[1] || commandData.slug)
			: '';

		this._notifyRejectListeners(commandSlug, msg, reason, commandData);
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
	 * Remove hook for when toy is destructing
	 * 
	 * @param {String} toySlug - The toy slug to hook commands for, like "chat" or "tosser", etc
	 * @param {Function } callback - Function to clear the hook
	 */
	clearHook(toySlug, callback) {

		// remove the callback for this toySlug
		if (this.toyHooks.has(toySlug) == false)
			return;

		const hooks = this.toyHooks.get(toySlug);
		this.toyHooks.set(toySlug, hooks.filter(cb => cb !== callback));
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
	 * Lazily build / return a regex that matches a single emoji codepoint at the
	 * START of a string. Uses \p{Extended_Pictographic} when the engine supports
	 * it (Chromium / Electron does), with a BMP+SMP range fallback. Cached after
	 * first build. This is the same family of detection the EmojiFountain toy
	 * uses, kept local so the command parser has no toy dependency.
	 *
	 * @returns {RegExp} anchored, non-global emoji-start matcher
	 */
	getEmojiStartRegex() {

		if (this._emojiStartRegex)
			return this._emojiStartRegex;

		try {
			// Modern engines: proper Unicode property escape.
			this._emojiStartRegex = new RegExp('^\\p{Extended_Pictographic}', 'u');
		}
		catch (e) {
			// Fallback: common emoji blocks. Not exhaustive, but covers the
			// glyphs chatters actually type after a command.
			this._emojiStartRegex = /^[\u{1F300}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
		}

		return this._emojiStartRegex;
	}


	/**
	 * Repair messages where a chatter glued an emoji directly onto a command
	 * with no space, e.g. "!fountain🌸" or "!toss🤨". The parser keys off the
	 * first whitespace-delimited run, so "fountain🌸" never matches a command
	 * (and even if it did, the required emoji param would be empty). This finds
	 * the command hiding at the start of that run and inserts the missing space
	 * so the normal "!command <emoji…>" path can proceed.
	 *
	 * Safety (this runs for EVERY command across the whole app):
	 *  - Only messages starting with '!' are considered.
	 *  - If the first token is ALREADY a valid command, the message is returned
	 *    untouched - so no currently-working command can change behavior.
	 *  - A split only happens when a known command is immediately followed by an
	 *    emoji. That emoji requirement is what stops false splits like
	 *    "!rainbow" -> "!rain bow" (the char after "rain" is a letter, not an
	 *    emoji, so it's left alone).
	 *  - The longest matching command wins, so prefix pairs like toss/tosser
	 *    resolve to the more specific command (e.g. "tosser🤨" -> "tosser 🤨").
	 *
	 * The original message object is never mutated; only the text used for
	 * command lookup + param parsing is adjusted.
	 *
	 * @param {String} messageText - the raw chat message text
	 * @returns {String} repaired text (space inserted) or the original string
	 */
	normalizeCommandEmojiSpacing(messageText) {

		// only '!'-prefixed command messages are candidates
		if (typeof messageText !== 'string' || messageText.startsWith('!') === false)
			return messageText;

		// isolate the first token (the command run) after the '!'
		const afterBang = messageText.slice(1);
		const wsIndex = afterBang.search(/\s/);
		const firstToken = wsIndex === -1 ? afterBang : afterBang.slice(0, wsIndex);

		// already a real command? leave it completely alone
		if (this.commandMap[firstToken])
			return messageText;

		// find the longest known command that this token starts with AND that is
		// immediately followed by an emoji
		const emojiStart = this.getEmojiStartRegex();
		let best = null;

		for (const cmd of Object.keys(this.commandMap)) {

			if (!cmd || firstToken.length <= cmd.length)
				continue;
			if (firstToken.startsWith(cmd) === false)
				continue;

			// what follows the command name must START with an emoji
			const rest = firstToken.slice(cmd.length);
			if (emojiStart.test(rest) === false)
				continue;

			if (best === null || cmd.length > best.length)
				best = cmd;

		}// next cmd

		// nothing safe to repair
		if (best === null)
			return messageText;

		// insert a single space between the command and the glued-on emoji,
		// preserving everything after it (further emojis / text / params)
		return '!' + best + ' ' + messageText.slice(1 + best.length);
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

			// Repair "!command🌸" (an emoji glued onto the command with no
			// space) into "!command 🌸" so it parses normally. This is a no-op
			// for any message whose first token is already a valid command, so
			// existing commands are completely unaffected. We use the repaired
			// text for command lookup + param parsing, but never mutate `msg`.
			const effectiveText = this.normalizeCommandEmojiSpacing(messageText);

			// split the message into parts, starting after the '!'
			const parts = effectiveText.slice(1).split(/\s+/);

			// if the first part is not a complete command, skip
			// or if the command is not enabled GTFO
			const commandKey = parts[0];
			const commandData = commandMap[commandKey];
			if (!commandData)
				continue;
			if (!commandData.enabled) {
				this._refundDroppedRedeem(msg, 'command is disabled', commandData);
				continue;
			}

			// get potential params (not all commands have params)
			// use the repaired text so "!fountain🌸" yields the emoji param
			const params = this.parseParams(commandData, effectiveText);

			// get the user data from our data base
			const user = this.getUser(authorUniqueID);

			// make sure this command is able to be run
			if (this.validateCommand(commandData, user, params, msg) == false) {
				this._refundDroppedRedeem(msg, 'command could not be run (cooldown / cost / validation)', commandData);
				continue;
			}

			// lastly we need to check super chat and member status, if required
			if(commandData.memberOnly==true && isMember==false){
				this.chatToysApp.log.err(`${msg.author}: "${commandData.command}" is a member-only command`);
				this._refundDroppedRedeem(msg, 'member-only command', commandData);
				continue;
			}
			if(commandData.superOnly==true && isSuper==false){
				this.chatToysApp.log.err(`${msg.author}: "${commandData.command}" is a Super-Chat-only command`);
				this._refundDroppedRedeem(msg, 'Super-Chat-only command', commandData);
				continue;
			}

			// split the command slug into toy and command parts
			const [toySlug, commandSlug] = commandData.slug.split(/__/, 2);

			// notify all listeners of this command that was successfully run
			for (const cb of this.commandCallbacks)
				cb(commandSlug, msg, user, params);

			// if we don't have any listeners for this command, skip further processing
			if (this.toyHooks.has(toySlug) == false) {
				this._refundDroppedRedeem(msg, 'no toy is handling this command', commandData);
				continue;
			}

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
		if (userFromDB){

			// patch ID on
			userFromDB.id = id;

			return userFromDB;
		}

		// if not found, return a dummy user
		return {
			banned: 0,
			display_name: 'Unknown Chatter',
			points: 0,
			youtube_id: id,
			id: id,
		};
	}


	/**
	 * Parse the parameters from a command message
	 * 
	 * @param {Object} commandData - The command data object
	 * @param {String} messageText - The full message text
	 * @returns {Object} - Object of parsed parameters
	 */
	parseParams(commandData, messageText) {

		// get the raw message text, trim it
		const trimmedMsg = messageText.trim();
		const paramDefs = commandData.params || [];

		// if this command doesn't have any params, return an empty object
		if (paramDefs.length === 0) return {};

		// Split the message by whitespace, but ignore the command itself.
		// We use a regex to skip the command and leading '!'
		const commandAndRest = trimmedMsg.match(/^!(\S+)\s*(.*)$/);
		if (!commandAndRest) return {};
		
		const rawRemaining = commandAndRest[2] || "";
		if (rawRemaining.length === 0) return {};

		// If we only have one param, we can potentially take the whole raw remaining string
		// depending on the type.
		if (paramDefs.length === 1) {
			const def = paramDefs[0];
			let val = rawRemaining;

			if (def.type === 'number') {
				val = val.split(/\s+/)[0]; // only take first word
				val = parseFloat(val, 10);
			} else if (def.type === 'username') {
				val = val.split(/\s+/)[0]; // only take first word
				if (val.startsWith('@')) val = val.slice(1);
			} else if (def.type === 'string') {
				// Keep whole string for 'string' type
			}

			return { [def.name]: val };
		}

		// For multiple parameters, use a smarter split that respects quotes
		const tokens = rawRemaining.match(/"(.*?)"|(\S+)/g) || [];
		const cleanTokens = tokens.map(str => str.replace(/(^"|"$)/g, ''));

		const obj = {};
		for (let i = 0; i < paramDefs.length; i++) {
			const def = paramDefs[i];
			let val = cleanTokens[i];

			// If this is the last parameter and it's a string, we might want to 
			// re-join any remaining tokens if they weren't quoted.
			if (i === paramDefs.length - 1 && def.type === 'string' && cleanTokens.length > paramDefs.length) {
				// Re-calculate the start index of the last parameter in rawRemaining
				// This is a bit complex, but for now we'll just join the remaining tokens.
				val = cleanTokens.slice(i).join(' ');
			}

			if (val !== undefined) {
				if (def.type === 'number') {
					val = parseFloat(val, 10);
				} else if (def.type === 'username' && val.startsWith('@')) {
					val = val.slice(1);
				}
				obj[def.name] = val;
			}
		}

		return obj;
	}


	/**
	 * Check if a message is from an admin user
	 * 
	 * @param {Object} msg - The message object
	 * @returns {Boolean} - True if the user is an admin
	 */
	isAdmin(msg) {
		if (msg.twitch && msg.author.toLowerCase() === 'chattoys') return true;
		if (msg.youtube && msg.author === 'Chat-Toys') return true;
		return false;
	}


	/**
	 * Makes sure our command is able to be run
	 * 
	 * @param {Object} commandData - The command data object
	 * @param {Object} user - The user object
	 * @param {Object} params - Optional parameters
	 * @param {Object} msg - The original message object
	 * @returns {Boolean} - True if the command is valid and can be run
	 */
	validateCommand(commandData, user, params, msg) {

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

		// Param validation
		const paramDefs = commandData.params || [];
		const requiredParamsCount = paramDefs.filter(p => !p.optional).length;
		const providedParamsCount = Object.keys(params).length;

		if (providedParamsCount < requiredParamsCount) {
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

		// admins bypass all further checks (cooldowns, costs)
		if (this.isAdmin(msg)) return true;

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

				const timeToTryAgain = Math.ceil(commandData.coolDown - ((now - last) / 1000));
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

				const timeToTryAgain = Math.ceil(commandData.groupCoolDown - ((now - last) / 1000));
				this.chatToysApp.log.err(`${commandData.command}: is on group-cooldown, try again in ${timeToTryAgain} seconds`);

				return false;
			}
		}

		// Cost check
		if (this.enableCosts.value == true) {
			if (commandData.costEnabled && user.points < commandData.cost) {
				console.error('Not enough points');
				return false;
			}
		}

		// all checks passed
		return true;
	}


	/**
	 * Notifies all listeners of a command that was run.
	 *
	 * Each listener (Toy.onCommand) receives a `handshake` with `accept`/`reject`.
	 *
	 * Contract:
	 *  - `accept()` MUST be called only AFTER the toy has confirmed the
	 *    requested action can actually be fulfilled (lobby has room, asset
	 *    exists, queue accepted the item, etc). Calling accept() triggers
	 *    side effects: ChatToys point deduction, command-run callbacks, and
	 *    (when the message originated from a Twitch redeem) marks the
	 *    redemption fulfilled. Accepting prematurely charges the viewer for
	 *    an action the toy could not actually perform.
	 *  - `reject(reason)` MUST be called when the toy cannot fulfill the
	 *    action. No points are deducted. When the message originated as a
	 *    Twitch redeem (msg.source === 'twitch-redeem'), reject() triggers
	 *    an automatic refund of the Twitch channel points via Helix.
	 *  - Exactly one of accept()/reject() should be called per onCommand
	 *    invocation. Calling neither leaves the message in an indeterminate
	 *    state (no charge, no refund, no run-callback).
	 *  - Fire-and-forget toys (where there is genuinely no failure mode
	 *    after enqueueing, e.g. Tosser, HeadPat, EmojiFountain) may call
	 *    accept() immediately after enqueueing. Toys whose downstream
	 *    pipeline can drop the action (StreamBuddies lobby full, Media
	 *    asset missing) MUST capture the success boolean and accept/reject
	 *    accordingly.
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

		// only fire reject side-effects (e.g. the Twitch refund) once, and
		// never if a listener already accepted the command
		let wasRejected = false;

		// notify all listeners of this command that was successfully run
		for (const cb of hooks) {

			/**
			 * Accept the command. Call this only AFTER the action is
			 * confirmed to have succeeded. Triggers point deduction +
			 * commandRun callbacks. Idempotent across listeners; only the
			 * first call has effect.
			 *
			 * Redeem-sourced messages (msg.source === 'twitch-redeem')
			 * bypass ChatToys point deduction - Twitch already charged
			 * channel points on its side, and most Twitch streamers
			 * won't have the ChatToys point system in active use anyway.
			 * Cooldowns, member-only, and super-only still apply normally
			 * via the existing validate path.
			 */
			const accept = () => {

				// only allow one listener to accept the command
				if (wasAccepted)
					return;
				wasAccepted = true;

				const isRedeem = msg.source === 'twitch-redeem';

				// update the user's points and other data
				window.ytctDB.updateUser(msg.authorUniqueID, {
					displayName: msg.author,
					streamID: msg.streamID,
					command: commandData.command,
					relativePoints: (
						!isRedeem &&
						this.enableCosts.value === true &&
						commandData.costEnabled &&
						this.isAdmin(msg) === false
					)
						? -commandData.cost
						: 0,
				});

				// generic listener notification only when a command was successfully run
				this._notifyRunListeners(commandData.command, msg, commandData);
			};

			/**
			 * Reject the command. Call this when the action cannot be
			 * fulfilled. No point deduction. For redeem-sourced messages,
			 * this will trigger an automatic Twitch refund (Phase 3).
			 *
			 * @param {String} reason - human-readable reason, surfaced to chatters via the log
			 */
			const reject = (reason) => {
				const errMsg = `"!${commandSlug}" rejected by listener: ${reason}`;
				console.log(errMsg);
				this.chatToysApp.log.err(reason);

				// Fire reject side-effects at most once, and never if a
				// listener already accepted. For source:'twitch-redeem'
				// messages this is what triggers the channel-point refund
				// over in the TwitchRedeems toy.
				if (wasAccepted || wasRejected)
					return;
				wasRejected = true;

				this._notifyRejectListeners(commandSlug, msg, reason, commandData);
			};

			// call the listener with the command details
			cb(commandSlug, msg, user, params, { accept, reject });
		}
	}

}
