/*
	HeadPat.js
	----------

	This class handles the state for the HeadPat toy system.

	NOTE: it does not handle the rendering, which will be the widgets.
*/

// vue
import { ref, shallowRef, watch } from 'vue';
import { socketRef, socketShallowRef, socketShallowRefAsync, bindRef } from 'socket-ref';

// our app
import Toy from "../Toy";
import { StateTickerQueue } from '@scripts/StateTickerQueue';

// components
import HeadPatsPage from './HeadPatsPage.vue';
import HeadPatsWidget from './HeadPatsWidget.vue';
import HeadPatsUserWidget from './HeadPatsUserWidget.vue';

// main export
export default class HeadPat extends Toy {

	// static info
	static name = 'Head Pat';
	static slug = 'headPat';
	static desc = 'Let viewers give and receive head pats.';
	static optionsPageComponent = HeadPatsPage;
	static themeColor = '#A4704C';
	static themeColor = '#C6C37A';
	static widgetComponents = [
		{
			component: HeadPatsWidget,
			key: 'streamerWidgetBox',
			allowResize: true,
			lockAspectRatio: true,
			description: 'This widget should go over the streamers avatar or webcam feed.',
			slug: 'streamer'
		},
		{
			component: HeadPatsUserWidget,
			key: 'chatterWidgetBox',
			allowResize: true,
			lockAspectRatio: true,			
			description: 'This widget will show a pat over a generic profile picture of a chatter, and can be placed anywhere.',
			slug: 'chat'
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

		// make two queues - one for chatter pats and one for streamer pats
		this.streamerPatQueue = new StateTickerQueue(this.handlePatQueue.bind(this), 2, 10);
		this.chatterPatQueue = new StateTickerQueue(this.handleChatQueue.bind(this), 2, 10);
		
		// listen to ticks
		electronAPI.tick(() => {
			this.streamerPatQueue.tick();
			this.chatterPatQueue.tick();
		});

		// the mode we're in, either 'IDLE', or 'SHOWING'
		this.streamerMode = socketShallowRef(this.static.slugify('streamerMode'), 'IDLE');
		this.chatterMode = socketShallowRef(this.static.slugify('chatterMode'), 'IDLE');

		// path to the user image
		this.userImagePath = socketShallowRef(this.static.slugify('userImagePath'), this.getUserImagePath());

		// we will have two queues for head pats - one for streamer and one for chatters
		// but at any given time one variable to hold the current pattern being shown
		this.currentPat = socketShallowRef(this.static.slugify('currentPat'), null);
		this.currentChatterPat = socketShallowRef(this.static.slugify('currentChatterPat'), null);
		
		// set up a watcher to update the user image path
		watch(this.settings.headPatChatterImage, () => {
			this.userImagePath.value = this.getUserImagePath();
		});
	}


	/**
	 * Helper to get the path to the user image
	 * 
	 * @returns {String} - the path to the user image
	 */
	getUserImagePath() {

		const imageID = this.settings.headPatChatterImage.value;
		const fileData = this.chatToysApp.assetsMgr.getFileData(imageID);
		return `builtin/${fileData.name}`;
	}


	/**
	 * Initialize the settings for this toy
	 */
	initSettings() {

		// channel points settings
		this.buildSettingsBlock({

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
				height: 250
			}),
		});
	}


	/**
	 * Initialize the commands for this toy
	 */
	buildCommands() {

		super.buildCommands([
			{
				command: 'pat',
				params: [
					{ name: 'user', type: 'username', optional: true, desc: 'Which chatter to head pat' },
				],
				description: 'Show head pat graphic on streamer, or optionally a chatter.!',
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
		console.log('head pat found', commandSlug, 'from', msg.author, 'with params', params);

		// if the command is a pat command, we will show the pat on the streamer
		if(commandSlug === 'pat') {
			
			// if the user param is provided on the params {} object
			// only show the pat on the chatter if it's enabled, otherwise show it on the streamer
			if(params.user) {
				if(this.settings.allowUserPats.value) {
					this.chatterPatQueue.addToQueue({patter: msg.author, pattee:params.user, duration: 10});
				} else {
					this.streamerPatQueue.addToQueue({patter: msg.author, pattee: '', duration: 10});
				}
			} else {
				this.streamerPatQueue.addToQueue({patter: msg.author, pattee: '', duration: 10});
			}
		}

		// accept the command which updates the database
		handshake.accept();
	}


	/**
	 * Handle the pat queue change
	 * 
	 * @param {Object} stateDetails - arbitrary state
	 */
	handlePatQueue(stateDetails) {

		// if details null, we're in IDLE mode
		if(stateDetails === null) {
			this.streamerMode.value = 'IDLE';
			this.currentPat.value = null;
			return;
		}

		// otherwise we're in SHOWING mode
		this.streamerMode.value = 'SHOWING';
		this.currentPat.value = stateDetails;
	}


	/**
	 * Handle the chat queue change
	 * 
	 * @param {Object} stateDetails - arbitrary state or null
	 */
	handleChatQueue(stateDetails) {

		// if details null, we're in IDLE mode
		if(stateDetails === null) {
			this.chatterMode.value = 'IDLE';
			this.currentChatterPat.value = null;
			return;
		}

		// otherwise we're in SHOWING mode
		this.chatterMode.value = 'SHOWING';
		this.currentChatterPat.value = stateDetails;
	}

}
