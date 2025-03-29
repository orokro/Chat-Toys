/*
	HeadPat.js
	----------

	This class handles the state for the HeadPat toy system.

	NOTE: it does not handle the rendering, which will be the widgets.
*/

// our app
import ToyState from "../ToyState";

// main export
export default class HeadPat extends ToyState {

	// static info
	static name = 'Head Pat';
	static slug = 'head_pats';
	static desc = 'Let viewers give and receive head pats.';

	/**
	 * Constructs the Gamba object
	 * 
	 * @param {ToyManager} toyManager - reference to the toy manager
	 */
	constructor(toyManager) {

		// call the parent constructor
		super(toyManager, HeadPat.slug);

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

		// log it:
		console.log('head pat found', commandSlug, 'from', msg.author, 'with params', params);

		// accept the command which updates the database
		handshake.accept();
	}
	
}
