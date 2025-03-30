/*
	PrizeWheel.js
	-------------

	This class handles the state for the PrizeWheel toy system.

	NOTE: it does not handle the rendering, which will be the widgets.
*/

// vue
import { ref, shallowRef } from 'vue';

// our app
import ToyState from "../ToyState";

// components
import PrizeWheelPage from './PrizeWheelPage.vue';

// main export
export default class PrizeWheel extends ToyState {

	// static info
	static name = 'Prize Wheel';
	static slug = 'prizeWheel';
	static desc = 'Let viewers spin a wheel to win prizes.';
	static optionsPageComponent = PrizeWheelPage;
	static themeColor = '#FFAAC5';
	static widgetComponents = [
		{
			component: null,
			key: 'widgetBox',
			allowResize: true,
			lockAspectRatio: true,
		}
	];


	/**
	 * Constructs the PrizeWheel object
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

			wheelItems: ref([]),
			wheelColors: ref([]),
			wheelImageId: ref('5'),
			wheelSoundId: ref('12'),
			alwaysShowWheel: ref(false),
			widgetBox: shallowRef({
				x: (1280 / 2) - (420 / 2),
				y: (720 / 2) - (466 / 2),
				width: 420,
				height: 466
			}),
		});
	}


	/**
	 * Initialize the commands for this toy
	 */
	buildCommands() {

		super.buildCommands([
			{
				command: 'spin',
				params: [
					{ name: 'strength', type: 'number', optional: true, desc: 'How hard to spin' },
				],
				description: 'Lets the chatter spin the wheel!',
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
		console.log('PrizeWheel found', commandSlug, 'from', msg.author, 'with params', params);

		// accept the command which updates the database
		handshake.accept();
	}
	
}
