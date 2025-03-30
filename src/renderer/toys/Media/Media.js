/*
	Media.js
	--------

	This class handles the state for the Media toy system.

	NOTE: it does not handle the rendering, which will be the widgets.
*/

// vue
import { ref, shallowRef } from 'vue';

// our app
import ToyState from "../ToyState";

// components
import MediaPage from './MediaPage.vue';

// main export
export default class Media extends ToyState {

	// static info
	static name = 'Media';
	static slug = 'media';
	static desc = 'Display images, GIFs, or play sounds on your stream.';
	static optionsPageComponent = MediaPage;
	static themeColor = '#51547D';
	static widgetComponents = [
		{
			component: null,
			key: 'widgetBox',
			allowResize: true,
			lockAspectRatio: false,
		}
	];


	/**
	 * Constructs the Media object
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

			mediaAssets: shallowRef([]),
			widgetBox: shallowRef({
				x: 20,
				y: 20,
				width: 400,
				height: 200
			}),			
		});
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
		console.log('Media found', commandSlug, 'from', msg.author, 'with params', params);

		// accept the command which updates the database
		handshake.accept();
	}
	
}
