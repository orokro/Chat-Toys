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
import { StateTickerQueue } from '@scripts/StateTickerQueue';

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

		// new queue for scheduling multiple requests to spin
		this.spinQueue = new StateTickerQueue(this.handleSpinQueue.bind(this), 2, 10);
		electronAPI.tick(() => this.spinQueue.tick());

		// our socket state
		this.wheelImagePath = socketShallowRef(
			this.static.slugify('wheelImagePath'),
			this.getAssetPath(this.settings.wheelImageId.value));
		this.wheelSoundPath = socketShallowRef(
			this.static.slugify('wheelSoundPath'),
			this.getAssetPath(this.settings.wheelSoundId.value));
		this.wheelMode = socketShallowRef(this.static.slugify('wheelMode'), 'IDLE');
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

		// Normalize angle to be between 0 and 360 & adjust for angle
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
	 * @param {Object} params - the parameters passed to the command
	 * @param {Object} handshake - object like { accept: Function, reject: Function } to accept or reject the command
	 */
	onCommand(commandSlug, msg, user, params, handshake) {

		// if we got a spin command...
		if (commandSlug === 'spin') {

			console.log('spin command', params);

			// get the strength of the spin
			let strength = Math.max(Math.min(parseInt(params.strength, 10) || 50, 100), 0);
			strength = ((strength+15) / 115) * 100;
			const spinTime = (Math.floor(Math.random() * 3000) + 15000) * (strength / 100.0);

			// queue the spin message
			this.spinQueue.addToQueue({
				chatter: msg.author,
				strength,
				spinTime,
				duration: (spinTime / 1000) + 2,
			});

			console.log('spin time ' + spinTime);

			// log the spin to the screen
			this.chatToysApp.log.msg(msg.author + ' spun the wheel with strength ' + strength);

			// accept the command which updates the database
			handshake.accept();
			return;
		}

		// otherwise
		handshake.reject();
	}


	/**
	 * Handle the shout queue change
	 * 
	 * @param {Object} item - the item in the queue
	 */
	handleSpinQueue(item) {

		// if it's null, we're in wait mode
		if(item === null) {
			this.wheelMode.value = 'IDLE';
			return;
		}

		this.doSpin(item);

	}


	/**
	 * Spin the wheel!
	 * 
	 * @param {Object} item - details about the spin (i.e. author, strength, etc)
	 */
	doSpin(item) {

		// we spinning now baby
		this.wheelMode.value = 'SPEEEN';

		// get the current time
		const now = new Date();

		// update message w/ user name
		this.spinMessage.value = item.chatter;

		// use our electron interval so we don't throttle
		const spinInterval = window.setElectronInterval(() => {

			// compute delta time
			const deltaTime = (new Date() - now);

			// GTFO if we're outta time
			if (deltaTime > item.spinTime) {
				window.clearElectronInterval(spinInterval);
				this.finishSpin(item);
				return;
			}

			// normalise time
			const normalizedTime = Math.max(Math.min(deltaTime / item.spinTime, 1), 0);

			// method for calculating the speed of the spin
			function spinEasing(normalizedTime) {
				
				// degrees per tick at the start
				const maxSpeed = 10; 				
			
				// easeOutCubic easing
				const t = Math.min(Math.max(normalizedTime, 0), 1);
				const easeOut = 1 - Math.pow(1 - t, 3);
			
				// Invert so that it's fast at first, slow at the end
				const speed = (1 - easeOut) * maxSpeed;
			
				return speed;
			}
			
			// update the rotation with the easing function
			this.rotation.value = this.rotation.value + spinEasing(normalizedTime);
			
		}, 10);
	}


	/**
	 * Handle when a spin finishes
	 * 
	 * @param {Object} item - the spin details
	 */
	finishSpin(item) {

		// make sure current spinItem is up to date
		this.spinItem.value = this.computeSpinItem(this.rotation.value);

		// log message
		this.chatToysApp.log.msg(item.chatter + ' spun the wheel and got ' + this.spinItem.value);

		// return to idle
		setTimeout(() => {
			this.wheelMode.value = 'IDLE';
		}, 2000);
	}

}
