/*
	Fishing.js
	----------

	This class handles the state for the Fishing toy system.

	NOTE: it does not handle the rendering, which will be the widgets.
*/

// vue
import { ref, shallowRef } from 'vue';

// our app
import Toy from "../Toy";

// components
import FishingPage from './FishingPage.vue';

// main export
export default class Fishing extends Toy {

	// static info	
	static name = 'Fishing Mini-game';
	static slug = 'fishing';
	static desc = 'Let viewers play a fishing mini-game on your stream.';
	static optionsPageComponent = FishingPage;
	static themeColor = '#A4704C';
	static widgetComponents = [
		{
			component: null,
			key: 'widgetBox',
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

			// our local settings
			fishSpawnInterval: ref(120),
			fishList: shallowRef([
				{
					name: 'runt',
					image: '10',
					scale: 1,
					points: 10,
					rarity: 10
				},
				{
					name: 'common',
					image: '9',
					scale: 1,
					points: 30,
					rarity: 5
				},
				{
					name: 'lunker',
					image: '8',
					scale: 1,
					points: 100,
					rarity: 1
				},
				{
					name: 'boot',
					image: '21',
					scale: 1,
					points: 0,
					rarity: 1
				},
			]),
			widgetBox: shallowRef({
				x: 0,
				y: 720 - 300,
				width: 300,
				height: 300
			}),
		});
	}


	/**
	 * Initialize the commands for this toy
	 */
	buildCommands() {

		super.buildCommands([
			{
				command: 'cast',
				params: [
					{ name: 'x', type: 'number', optional: true, desc: 'where on x axis to cast line' },
					{ name: 'y', type: 'number', optional: true, desc: 'where on y axis to cast line' }
				],
				description: 'Cast your fishing line, optionally specify x and y coordinates',
			},
			{
				command: 'reel',
				description: 'Attempt to reel in your fishing line',
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
		console.log('Fishing found', commandSlug, 'from', msg.author, 'with params', params);

		// accept the command which updates the database
		handshake.accept();
	}

}
