/*
	Gamba.js
	--------

	This class handles the state for the Gamba toy system.

	NOTE: it does not handle the rendering, which will be the Gamba widgets.
*/

// our app
import ToyState from "../ToyState";

// main export
export default class Gamba extends ToyState {

	// static info
	static name = 'Gamba';
	static slug = 'gamba';
	static desc = 'Let viewers gamble their points.';

	/**
	 * Constructs the Gamba object
	 * 
	 * @param {ToyManager} toyManager - reference to the toy manager
	 */
	constructor(toyManager) {

		// call the parent constructor
		super(toyManager, Gamba.slug);

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
		console.log('Gamba found', commandSlug, 'from', msg.author, 'with params', params);

		// accept the command which updates the database
		handshake.accept();
	}
	
}
