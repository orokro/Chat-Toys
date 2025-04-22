/*
	Tosser.js
	---------

	This class handles the state for the Tosser toy system.

	NOTE: it does not handle the rendering, which will be the Tosser widgets.
*/

// vue
import { ref, shallowRef } from 'vue';
import { socketRef, socketShallowRef, socketShallowRefAsync, bindRef } from 'socket-ref';

// lib/misc
import { v4 as uuidv4 } from 'uuid';

// our app
import Toy from "../Toy";

// components
import TosserPage from './TosserPage.vue';
import TosserWidget from './TosserWidget.vue';

// main export
export default class Tosser extends Toy {

	// static info
	static name = 'Tosser';
	static slug = 'tosser';
	static desc = 'Let viewers toss objects onto your stream.';
	static optionsPageComponent = TosserPage;
	static themeColor = '#E65A5A';
	static widgetComponents = [
		{
			component: TosserWidget,
			key: 'widgetBox',
			allowResize: true,
			lockAspectRatio: false,
			description: `
				This should be a browser source layer that is full screen. 
				It shows the 3d objects tossed at the set collider.`,
			slug: 'tosserLayer'
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

		// list of tosses to perform
		this.tossQueue = socketShallowRef(this.static.slugify('tossQueue'), []);

		// reset the toss queue
		this.resetTimeout = window.setElectronTimeout(() => {
			this.tossQueue.value = [];
		}, 2000);
	}


	/**
	 * Perform clean up when the toy is destroyed
	 */
	end(){
		super.end();
		window.clearElectronTimeout(this.resetTimeout);
	}


	/**
	 * Initialize the settings for this toy
	 */
	initSettings() {

		// tosser settings
		this.buildSettingsBlock({

			// list of items that can be tossed
			tosserAssets: ref([
				{
					model: "16",
					modelPath: this.getAssetPath('16'),
					sound: "15",
					soundPath: this.getAssetPath('15'),
					scale: 1,
					slug: "tomato",
					cmd: "tomato",
				},
				{
					model: "18",
					modelPath: this.getAssetPath('18'),
					sound: "15",
					soundPath: this.getAssetPath('15'),
					scale: 1,
					slug: "wad",
					cmd: "paper",
				}
			]),
			randomTossMode: ref(true),
			widgetBox: shallowRef({
				x: 20,
				y: 20,
				width: 1880,
				height: 1040
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
	 * @param {Object} params - the parameters passed to the command
	 * @param {Object} handshake - object like { accept: Function, reject: Function } to accept or reject the command
	 */
	onCommand(commandSlug, msg, user, params, handshake) {

		// if we don't have any tosser assets, then we can't toss anything
		if(this.settings.tosserAssets.value.length === 0) {
			this.chatToysApp.log.error('Toss command failed, no tossable items found');
			handshake.reject();
			return;
		}

		// if the slug iis 'toss' then we need to check for parameters
		if(commandSlug === 'toss') {

			// if item is undefined, toss random/unspecified & gtfo
			if(params.item === undefined) {
				this.tossUnspecifiedItem(msg);
				handshake.accept();
				return;
			}

			// check if the item is in the list of tossable items
			const matchItemSlug = params.item.toLowerCase();
			const tossableItem = this.settings.tosserAssets.value.find(item => item.slug === matchItemSlug);
			if(tossableItem !== undefined) {
				this.tossItem(msg, tossableItem.slug);
				handshake.accept();
				return;
			} 

			// otherwise we got TOSS and either there was no item, or it was invalid
			// so we can just toss a random item
			this.chatToysApp.log.msg(msg.author + ' chose invalid item, tossing random item instead');
			handshake.accept();
		}

		// if it wasn't specifically toss, then it's a custom user command, we need to get it's full data
		const fullCommandData = this.chatToysApp.commands.value[this.slug+'__'+commandSlug];
		const command = fullCommandData.command;
		const tossObject = this.settings.tosserAssets.value.find(item => item.cmd === command);

		// if un found, then we need to toss an unspecified item
		if(tossObject === undefined) {
			this.tossUnspecifiedItem(msg);
			handshake.accept();
			return;
		}

		// get it's slug & toss that sum-bitch
		const itemSlug = tossObject.slug;
		this.tossItem(msg, itemSlug);

		// accept the command which updates the database
		handshake.accept();
	}


	/**
	 * Tosses a random item, or the first item
	 * 
	 * @param {Object} msg - message object
	 */
	tossUnspecifiedItem(msg){

		// pick a random slug if non specified
		let randomIndex = Math.floor(Math.random() * this.settings.tosserAssets.value.length);

		// note: if random mode isn't enabled, we'll just pick the first item
		if(this.settings.randomTossMode.value === false)
			randomIndex = 0;

		// get the random item (or first item if random mode is disabled)
		const randomItem = this.settings.tosserAssets.value[randomIndex];
		const slug = randomItem.slug;

		// use regular method
		this.tossItem(msg, slug);
	}


	/**
	 * Tosses an item
	 * 
	 * @param {Object} msg - message object
	 * @param {String} itemSlug - item to toss
	 */
	tossItem(msg, itemSlug) {

		// add it to our toss queue w/ a unique id
		const tossId = uuidv4();
		const toss = {
			id: tossId,
			item: itemSlug,
			createdAt: Date.now(),
		};
		this.tossQueue.value = [...this.tossQueue.value, toss];

		this.chatToysApp.log.msg(msg.author + ' tossed a ' + itemSlug);
	}

}
