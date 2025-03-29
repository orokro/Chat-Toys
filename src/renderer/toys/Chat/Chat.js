/*
	Chat.js
	-------

	This class handles the state for the Chat features toy system.

	NOTE: it does not handle the rendering, which will be the widgets.
*/

// our app
import ToyState from "../ToyState";

// main export
export default class Chat extends ToyState {

	// static info
	static name = 'Chat';
	static slug = 'chat_box';
	static desc = 'Add a chat overlay to your stream.';
	
	/**
	 * Constructs the Chat object
	 * 
	 * @param {ToyManager} toyManager - reference to the toy manager
	 */
	constructor(toyManager) {

		// call the parent constructor
		super(toyManager, Chat.slug);

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
		console.log('Chat found', commandSlug, 'from', msg.author, 'with params', params);

		// accept the command which updates the database
		handshake.accept();
	}
	
}
