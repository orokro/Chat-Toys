/*
	HeadPat.js
	----------

	This class handles the state for the HeadPat toy system.

	NOTE: it does not handle the rendering, which will be the widgets.
*/

// vue
import { ref, shallowRef } from 'vue';

// our app
import Toy from "../Toy";

// components
import HeadPatsPage from './HeadPatsPage.vue';

// main export
export default class HeadPat extends Toy {

	// static info
	static name = 'Head Pat';
	static slug = 'headPat';
	static desc = 'Let viewers give and receive head pats.';
	static optionsPageComponent = HeadPatsPage;
	static themeColor = '#A4704C';
	static themeColor = '#C6C37A';
	static widgetComponents = [
		{
			component: null,
			key: 'streamerWidgetBox',
			allowResize: true,
			lockAspectRatio: true,
		},
		{
			component: null,
			key: 'chatterWidgetBox',
			allowResize: true,
			lockAspectRatio: true,
		}
	];


	/**
	 * Constructs the Gamba object
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

			allowUserPats: ref(true),
			headPatChatterImage: ref('22'),
			streamerWidgetBox: shallowRef({
				x: 1280 - 200,
				y: 200,
				width: 200,
				height: 200
			}),
			chatterWidgetBox: shallowRef({
				x: (1280 / 2) - 100,
				y: 720 - 400,
				width: 200,
				height: 200
			}),
		});
	}


	/**
	 * Initialize the commands for this toy
	 */
	buildCommands() {

		super.buildCommands([
			{
				command: 'pat',
				params: [
					{ name: 'user', type: 'username', optional: true, desc: 'Which chatter to head pat' },
				],
				description: 'Show head pat graphic on streamer, or optionally a chatter.!',
			},	
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
		console.log('head pat found', commandSlug, 'from', msg.author, 'with params', params);

		// accept the command which updates the database
		handshake.accept();
	}

}
