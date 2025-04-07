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
import DummyWidget from '../DummyWidget.vue';

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
		setTimeout(() => {
			this.tossQueue.value = [];
		}, 2000);
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
			randomTossMode: ref(false),
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

		// log it:
		console.log('Tosser found', commandSlug, 'from', msg.author, 'with params', params);

		// if the slug iis 'toss' then we need to check for parameters
		if(commandSlug === 'toss') {

			// if item is undefined, toss random & gtfo
			if(params.item === undefined) {
				this.tossRandomItem(msg);
				handshake.accept();
				return;
			}

			// check if the item is in the list of tossable items
			const tossableItem = this.settings.tosserAssets.value.find(item => item.slug === params.item);
			if(tossableItem !== undefined) {
				this.tossRandomItem(msg);
				handshake.accept();
				return;
			} 

			// we should never get here, but just in case
			handshake.reject('Invalid item: ' + params.item);
		}

		// if it wasn't specifically toss, then it's a custom user command, we need to get it's full data
		const fullCommandData = this.chatToysApp.commands.value[this.slug+'__'+1];
		const command = fullCommandData.command;
		const tossObject = this.settings.tosserAssets.value.find(item => item.cmd === command);

		// get it's slug & toss that sum-bitch
		const itemSlug = tossObject.slug;
		this.tossItem(msg, itemSlug);

		// accept the command which updates the database
		handshake.accept();
	}


	/**
	 * Tosses a random item
	 * 
	 * @param {Object} msg - message object
	 */
	tossRandomItem(msg){

		// pick a random slug if non specified
		const randomIndex = Math.floor(Math.random() * this.settings.tosserAssets.value.length);
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
