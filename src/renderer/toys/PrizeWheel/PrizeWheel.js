/*
	PrizeWheel.js
	-------------

	This class handles the state for the PrizeWheel toy system.

	NOTE: it does not handle the rendering, which will be the widgets.
*/

// vue
import { ref, shallowRef, watch } from 'vue';
import { socketRef, socketShallowRef, socketShallowRefAsync, bindRef } from 'socket-ref';

// our app
import Toy from "../Toy";

// components
import PrizeWheelPage from './PrizeWheelPage.vue';
import PrizeWheelWidget from './PrizeWheelWidget.vue';

// main export
export default class PrizeWheel extends Toy {

	// static info
	static name = 'Prize Wheel';
	static slug = 'prizeWheel';
	static desc = 'Let viewers spin a wheel to win prizes.';
	static optionsPageComponent = PrizeWheelPage;
	static themeColor = '#FFAAC5';
	static widgetComponents = [
		{
			component: PrizeWheelWidget,
			key: 'widgetBox',
			allowResize: true,
			lockAspectRatio: true,
			description: 'The spinnable prize wheel!',
			slug: 'wheel'
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

		// our socket state
		this.wheelImagePath = socketShallowRef(
			this.static.slugify('wheelImagePath'),
			this.getAssetPath(this.settings.wheelImageId.value));
		this.wheelSoundPath = socketShallowRef(
			this.static.slugify('wheelSoundPath'),
			this.getAssetPath(this.settings.wheelSoundId.value));
		this.rotation = socketShallowRef(this.static.slugify('rotation'), 0);
		this.spinMessage = socketShallowRef(this.static.slugify('spinMessage'), 'Orokro');
		this.spinItem = socketShallowRef(this.static.slugify('spinItem'), '');

		// listen to changes in the shout sound
		watch(this.settings.wheelImageId, (value) => {
			this.wheelImagePath.value = this.getAssetPath(value);
		});
		watch(this.settings.wheelSoundId, (value) => {
			this.wheelSoundPath.value = this.getAssetPath(value);
		});

		setInterval(() => {
			this.rotation.value = (this.rotation.value + 1) % 360;			
		}, 30);

		watch(this.rotation, (value) => {
			this.spinItem.value = this.computeSpinItem(value);
		})
	}


	/**
	 * Handles fewer than 6 items with auto-repeating
	 * 
	 * @param {Array<String>} baseItems - wheel items
	 * @returns {Array<String>} - the items to show on the wheel
	 */
	repeatItems(baseItems) {
		const count = baseItems.length;
		if (count === 0) return [];
		if (count === 1) return Array(6).fill(baseItems[0]);
		if (count === 2) return Array.from({ length: 6 }, (_, i) => baseItems[i % 2]);
		if (count === 3) return Array.from({ length: 6 }, (_, i) => baseItems[i % 3]);
		if (count === 4) return Array.from({ length: 8 }, (_, i) => baseItems[i % 4]);
		if (count === 5) return Array.from({ length: 10 }, (_, i) => baseItems[i % 5]);
		return baseItems;
	}


	/**
	 * Figure out which item is currently selected on the wheel
	 * 
	 * @param {Number} rot - rotation of wheel
	 * @returns {String} - which item is currently selected on the wheel
	 */
	computeSpinItem(rot){

		// get the adjusted list of items so we can compute angles
		const items = this.repeatItems(this.settings.wheelItems.value);

		// if we have no items, return
		if (items.length === 0)
			this.spinItem.value = '';

		const anglePerSlice = 360 / items.length;

		// // Normalize angle to be between 0 and 360
		// let normalized = ((rot % 360) + 360) % 360;

		// // Flip the angle so 0 is at the top (like a wheel)
		// normalized = (360 - normalized - 90) % 360;

		let normalized = (-rot + (360*100) -90) % 360;

		const index = Math.floor(normalized / anglePerSlice);
		return items[index];

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
