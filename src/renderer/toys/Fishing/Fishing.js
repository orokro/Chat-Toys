/*
	Fishing.js
	----------

	This class handles the state for the Fishing toy system.

	NOTE: it does not handle the rendering, which will be the widgets.
*/

// vue
import { ref, shallowRef } from 'vue';
import { socketRef, socketShallowRef, socketShallowRefAsync, bindRef } from 'socket-ref';

// lib/misc
import { v4 as uuidv4 } from 'uuid';

// our app
import Toy from "../Toy";
import { FishingGame } from './FishingGame';

// components
import FishingPage from './FishingPage.vue';
import FishingWidget from './FishingWidget.vue';

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
			component: FishingWidget,
			key: 'widgetBox',
			allowResize: true,
			lockAspectRatio: true,
			description: 'The scene that shows the fishing lake',
			slug: 'scene'
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

		// make a new fishing game to manage our logic & set up a timer for it
		const corners = [{x: 35, y: 53}, {x: 210, y: 53}, {x: 12, y: 188}, {x: 232, y: 188}];
		const fishList = this.settings.fishList;
		const maxFish = this.settings.maxFish;
		const fishSpawnInterval = this.settings.fishSpawnInterval;
		const castTimeout = this.settings.castTimeout;
		this.fishingGame = new FishingGame(
			corners,
			fishList,
			maxFish,
			fishSpawnInterval,
			castTimeout
		);

		// use the first time get initial state
		const initialState = this.fishingGame.tick();
		this.gameState = socketShallowRef(this.static.slugify('gameState'), initialState);

		// set up repeating interval to call the fishing game tick function
		this.fishingInterval = window.setElectronInterval(()=>{
			this.gameState.value = {...this.fishingGame.tick()};
		}, 100);

		// handle when fishing game has events
		this.fishingGame.onLog((log)=>{
			this.chatToysApp.log.info(log);
		});

		// make state var for 'catches' to show in the widget when a chatter catches a fish
		this.catches = socketShallowRef(this.static.slugify('catches'), []);

		// when user catches a fish, add it to the catches list for UI to render
		this.fishingGame.onCatch((fish)=>{

			// get the points from the fish so we can reward the user
			const easyMoney = fish.fish.points;
			window.ytctDB.updateUser(fish.cast.userID, {
				relativePoints: easyMoney,
			});

			// push details about the fish on the list
			const newCatches = [...this.catches.value,
				{
					id: uuidv4(),
					userID: fish.cast.userID,
					username: fish.cast.username,
					fishName: fish.fish.name,
					fishImage: this.getAssetPath(fish.fish.image),
					fishScale: fish.fish.scale,
					fishPoints: fish.fish.points,
					time: Date.now(),
				}
			];

			// trim size
			while(newCatches.length > 20)
				newCatches.shift();
			
			// update socket state
			this.catches.value = newCatches;
		});

	}


	/**
	 * Clean up
	 */
	end(){
		super.end();
		window.clearElectronInterval(this.fishingInterval);
	}


	/**
	 * Initialize the settings for this toy
	 */
	initSettings() {

		// fishing settings
		this.buildSettingsBlock({

			// our local settings
			maxFish: ref(5),
			fishSpawnInterval: ref(120),
			castTimeout: ref(300),
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
				userDesc: 'Cast your rod in the fishing mini game, with an optional location',
			},
			{
				command: 'reel',
				params: [
					{ name: 'strength', type: 'number', optional: true, desc: 'how hard to reel in' },
				],
				description: 'Attempt to reel in your fishing line',
				userDesc: 'Reel in your rod in the fishing mini game',
			}
		]);
	}


	/**
	 * Handle when an incoming command is sent to this toy
	 * 
	 * @param {String} commandSlug - the slug of the command
	 * @param {Object} msg - details about the chat message that invoked the command
	 * @param {Object} user - details about the user that invoked the command (could be dummy if not in database yet)
	 * @param {Object} params - the parameters passed to the command as an object
	 * @param {Object} handshake - object like { accept: Function, reject: Function } to accept or reject the command
	 */
	onCommand(commandSlug, msg, user, params, handshake) {

		// only allow cast or reel commands
		if (commandSlug !== 'cast' && commandSlug !== 'reel') {
			handshake.reject('Invalid command');
			return;
		}

		if(params.x===undefined || isNaN(params.x))
			delete params.x;
		if(params.y===undefined || isNaN(params.y))
			delete params.y;
		
		// pack command into object for fishing game
		const fishingCommand = {
			userID: msg.authorUniqueID,
			username: msg.author,
			command: commandSlug,
			params: params,
			handshake: handshake,
		};

		// tell the fishing game this command happened
		this.fishingGame.doCommand(fishingCommand);
	}

}
