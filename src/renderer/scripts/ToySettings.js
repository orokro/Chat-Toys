/*
	ToySettings.js
	--------------

	This will compartmentalize all the logic for setting up the various settings
	for the toys. This will sync the settings via chrome storage, and provide
	a simple API for getting and setting the settings.
*/

// vue
import { ref, shallowRef } from 'vue';
import { chromeRef, chromeShallowRef } from './chromeRef';
import { RefAggregator } from './RefAggregator';

/**
 * Main class for handling the settings for the toys
 */
export class ToySettings {

	/**
	 * Builds the ToySettings object
	 * 
	 * @param {ChatToysApp} ctApp The main app object
	 */
	constructor(ctApp) {

		// save our app reference
		this._ctApp = ctApp;

		// we'll stick our internal refs of the aggregators and settings refs
		this._internals = {
			aggregators: {},
			settings: {}
		};

		// build all the settings
		this.buildSettings();
	}


	/**
	 * Builds all the settings for the toys, with the proper defaults
	 */
	buildSettings() {

		// channel points settings
		this.buildSettingsBlock('channel-points', {
			claimInterval: ref(300),
			claimRandomness: ref(0),
			claimDuration: ref(60),
			pointsPerClaim: ref(100),
			maxClaims: ref(0),
			showTimerBar: ref(true),
			showClaimsRemaining: ref(true),
			showUserClaims: ref(true),
			showTextPrompt: ref(true),
			widgetColorTheme: ref('#00ABAE'),
			widgetIconId: ref('1'),
			widgetIconPath: ref('builtin/' + this._ctApp.assetsMgr.getFileData('1').name),
			widgetBox: shallowRef({
				x: 1280 - 150,
				y: 720 - 150,
				width: 150,
				height: 150
			}),
		});

		// build the settings for the chat toy
		this.buildSettingsBlock('chat', {
			enableChatBox: ref(false),
			chatBoxImage: ref('3'),
			filterCommands: ref(true),
			showChatterNames: ref(true),
			chatNameColor: ref('#00ABAE'),
			chatTextColor: ref('#000000'),
			shoutSoundId: ref('11'),
			swarmSize: ref(5),
			swarmDuration: ref(10),
			chatWidgetBox: shallowRef({
				x: 1280 - 300,
				y: 0,
				width: 300,
				height: 400
			}),
			shoutWidgetBox: shallowRef({
				x: 20,
				y: 20,
				width: 400,
				height: 100
			}),
		});

		// build the settings for the media page
		this.buildSettingsBlock('media', {
			mediaAssets: shallowRef([]),
			widgetBox: shallowRef({
				x: 20,
				y: 20,
				width: 400,
				height: 200
			}),
		});

		// build tosser settings
		this.buildSettingsBlock('tosser', {

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

		// build the prize wheel settings
		this.buildSettingsBlock('prize-wheel', {
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

		// build all the gamba settings
		this.buildSettingsBlock('gamba', {
			gambaStateMode: shallowRef('off'),
			gambaPrompt: shallowRef('Streamer will beat the boss?'),
			gambaOptions: shallowRef(['Yes', 'No']),
			resultsWidgetBox: shallowRef({
				x: (1280 / 2) - (500 / 2),
				y: (720 / 2) - (600 / 2),
				width: 500,
				height: 600
			}),
			widgetBox: shallowRef({
				x: (1280 / 2) - (400 / 2),
				y: 720 - 220,
				width: 400,
				height: 200
			}),
		});

		// build the head pat settings
		this.buildSettingsBlock('head-pat', {
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

		// build settings for the buddy system
		this.buildSettingsBlock('buddy', {
			maxBuddyCount: ref(5),
			buddySize: ref(1.0),
		});

		// build settings for the fishing minigame
		this.buildSettingsBlock('fishing', {

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
				y: 720-300,
				width: 300,
				height: 300
			}),
		});
	}


	/**
	 * Builds block of settings that are reactive and sync with chrome storage
	 * 
	 * @param {String} blockNameKebab - proper variable name for the block
	 * @param {Object} settings - object like { settingName: ref, ... }
	 */
	buildSettingsBlock(blockNameKebab, settings) {

		// convert from kebab to camel case
		const blockNameCamel = blockNameKebab.replace(/-([a-z])/g, (g) => g[1].toUpperCase());

		// create a ref that will sync with chrome storage
		const blockSettingsStorRef = chromeShallowRef(blockNameKebab + '-settings', {});
		this._internals.settings[blockNameCamel + 'SettingsStorRef'] = blockSettingsStorRef;

		// save the settings object with a public name
		this[blockNameCamel + 'Settings'] = settings;

		// create a ref aggregator to sync the settings
		const settingsAggregator = new RefAggregator(blockSettingsStorRef);
		this._internals.aggregators[blockNameCamel + 'SettingsAggregator'] = settingsAggregator;

		// register all the settings at once
		settingsAggregator.registerObject(settings);
	}

}
