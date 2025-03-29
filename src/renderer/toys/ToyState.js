/*
	ToyState.js
	-----------

	This will be the base class for all the various state classes for
	our toys. Nothing will instantiate this class directly, but
	all toys (including the placeholder DummyToy) will extend this class.
*/

// our app
import { ToyManager } from "../scripts/ToyManager";

// main export
export default class ToyState {

	/**
	 * Constructs the ToyState object
	 * 
	 * @param {ToyManager} toyManager - reference to the toy manager
	 * @param {Object} toyInfo - the toy's info from the toysData
	 */
	constructor(toyManager, toyInfo) {

		// save reference to the toy manager but also grab our chat app
		this.toyManager = toyManager;
		this.chatToysApp = toyManager.chatToysApp;

		// save our toy info locally
		this.slug = toyInfo.slug;
		this.toyInfo = toyInfo;

		// we'll auto-subscribe to the commands for this toy!
		// we'll use a callback that can be overridden by the toy
		this.chatToysApp.commandProcessor.hookToyCommands(this.slug, this.onCommand.bind(this));
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

}
