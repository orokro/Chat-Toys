/*
	Tosser.js
	---------

	This class handles the state for the Tosser toy system.

	NOTE: it does not handle the rendering, which will be the Tosser widgets.
*/

// vue
import { ref, shallowRef } from 'vue';

// our app
import ToyState from "../ToyState";

// components
import TosserPage from './TosserPage.vue';

// main export
export default class Tosser extends ToyState {

	// static info
	static name = 'Tosser';
	static slug = 'tosser';
	static desc = 'Let viewers toss objects onto your stream.';
	static optionsPageComponent = TosserPage;
	static themeColor = '#E65A5A';
	static widgetComponents = [
		{
			component: null,
			key: 'targetWidgetBox',
			allowResize: true,
			lockAspectRatio: true,
		}
	];


	/**
	 * Constructs the Tosser object
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

			// list of items that can be tossed
			tosserAssets: ref([
				{
					model: "16",
					sound: "15",
					scale: 1,
					slug: "tomato",
					cmd: "tomato",
				},
				{
					model: "18",
					sound: "15",
					scale: 1,
					slug: "wad",
					cmd: "paper",
				}
			]),
			randomTossMode: ref(false),
			targetWidgetBox: ref({
				x: (1280 / 2) - (200 / 2),
				y: 720 - 400,
				width: 200,
				height: 400
			}),
		});
	}


	/**
	 * Initialize the commands for this toy
	 */
	buildCommands() {

		super.buildCommands([
			{
				command: 'toss',
				params: [
					{ name: 'item', type: 'string', optional: true, desc: 'Which item to toss' },
				],
				description: 'Lets the toss an item!',
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
		console.log('Tosser found', commandSlug, 'from', msg.author, 'with params', params);

		// accept the command which updates the database
		handshake.accept();
	}

	
}
