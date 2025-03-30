/*
	StreamBuddies.js
	----------------

	This class handles the state for the StreamBuddies toy system.

	NOTE: it does not handle the rendering, which will be the StreamBuddies widgets.
*/

// vue
import { ref, shallowRef } from 'vue';

// our app
import Toy from "../Toy";

// components
import StreamBuddiesPage from './StreamBuddiesPage.vue';

// main export
export default class StreamBuddies extends Toy {

	// static info
	static name = 'Stream Buddies';
	static slug = 'streamBuddies';
	static desc = 'Let viewers spawn buddies on your stream.';
	static optionsPageComponent = StreamBuddiesPage;
	static themeColor = '#B59EDE';
	static widgetComponents = [];


	/**
	 * Constructs the StreamBuddies object
	 * 
	 * @param {ToyManager} toyManager - reference to the toy manager
	 */
	constructor(toyManager) {

		// call the parent constructor
		super(toyManager);
	}
	

	/**
	 * Initialize the settings for this toy
	 */
	initSettings() {

		// channel points settings
		this.buildSettingsBlock({

			maxBuddyCount: ref(5),
			buddySize: ref(1.0),
		});
	}


	/**
	 * Initialize the commands for this toy
	 */
	buildCommands() {

		super.buildCommands([
			{
				command: 'join',
				description: 'Being on screen is optional, users can opt-in with this command.',
			},
			{
				command: 'leave',
				description: 'Being on screen is optional, users can opt-out with this command.',
			},
			{
				command: 'left',
				params: [
					{ name: 'amount', type: 'number', optional: true, desc: 'Amount to walk left in pixels' },
				],
				description: 'Make their character walk left',
			},
			{
				command: 'right',
				params: [
					{ name: 'amount', type: 'number', optional: true, desc: 'Amount to walk right in pixels' },
				],
				description: 'Make their character walk right',
			},
			{
				command: 'jump',
				params: [
					{ name: 'amount', type: 'string', optional: true, desc: 'Either "left" or "right"' },
				],
				description: 'Make their character jump up, or optionally, a direction.',
			},
			{
				command: 'hug',
				params: [
					{ name: 'user', type: 'username', optional: false, desc: 'user to hug' },
				],
				description: 'Make their character hug another user.',
			},
			{
				command: 'attack',
				params: [
					{ name: 'user', type: 'username', optional: false, desc: 'user to attack' },
				],
				description: 'Make their character attack another user.',
			},
			{
				command: 'sit',
				description: 'Make character sit down.',
			},
			{
				command: 'fart',
				description: 'Make character fart.',
			}
		]);
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
		console.log('StreamBuddies found', commandSlug, 'from', msg.author, 'with params', params);

		// accept the command which updates the database
		handshake.accept();
	}
	
}
