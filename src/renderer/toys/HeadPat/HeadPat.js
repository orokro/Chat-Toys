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

// components
import HeadPatsPage from './HeadPatsPage.vue';
import HeadPatsWidget from './HeadPatsWidget.vue';
import HeadPatsUserWidget from './HeadPatsUserWidget.vue';

import DummyWidget from '../DummyWidget.vue';

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
		},
		{
			component: HeadPatsUserWidget,
			key: 'chatterWidgetBox',
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

		// queues for streamer/chatter head pats
		this.streamerPatQueue = [];
		this.chatterPatQueue = [];

		// time counters to show the head pat for a certain amount of time
		this.streamerTimer = 0;
		this.chatterTimer = 0;

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

		// listen to ticks
		electronAPI.tick(() => this.tick());
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
					this.chatterPatQueue.push({patter: msg.author, pattee:params.user});
				} else {
					this.streamerPatQueue.push({patter: msg.author, pattee: ''});
				}
			} else {
				this.streamerPatQueue.push({patter: msg.author, pattee: ''});
			}
		}

		// accept the command which updates the database
		handshake.accept();
	}


	/**
	 * Tick function that runs every second
	 */
	tick() {

		/*
			NOTE: the code below is redundant.

			I KNO "DRY" aka "Don't Repeat Yourself" is a thing.

			But, I got other things to do rn. So, I'm just gonna leave it as is for now.
			TODO: Refactor this to be DRY.
		*/

		// run state logic for both queues
		this.tickStreamer();
		this.tickChatter();
	}


	/**
	 * Tick state logic for the streamer head pats
	 */
	tickStreamer() {
		
		// if we have time on the clock, decrement it
		if(this.streamerTimer > 0) {
			this.streamerTimer--;

			// if times up, determine what to do next
			if(this.streamerTimer === 0) {				

				// if we were in IDLE, check the queue to see if we should show a new pat
				if(this.streamerMode.value === 'IDLE') {

					if(this.streamerPatQueue.length > 0) {
						this.currentPat.value = this.streamerPatQueue.shift();
						this.streamerMode.value = 'SHOWING';
						this.streamerTimer = 5;
					}

				// if we were in SHOWING, reset the current pat and go back to IDLE
				} else {
					this.currentPat.value = null;
					this.streamerMode.value = 'IDLE';
					this.streamerTimer = 1;
				}

			}
		}else{
			this.streamerMode.value = 'IDLE';

			if(this.streamerPatQueue.length > 0) {
				this.currentPat.value = this.streamerPatQueue.shift();
				this.streamerMode.value = 'SHOWING';
				this.streamerTimer = 10;
			}
		}
	}	


	/**
	 * Tick state logic for the chatter head pats
	 */
	tickChatter() {
		
		// if we have time on the clock, decrement it
		if(this.chatterTimer > 0) {
			this.chatterTimer--;

			// if times up, determine what to do next
			if(this.chatterTimer === 0) {				

				// if we were in IDLE, check the queue to see if we should show a new pat
				if(this.chatterMode.value === 'IDLE') {

					if(this.chatterPatQueue.length > 0) {
						this.currentChatterPat.value = this.chatterPatQueue.shift();
						this.chatterMode.value = 'SHOWING';
						this.chatterTimer = 5;
					}

				// if we were in SHOWING, reset the current pat and go back to IDLE
				} else {
					this.currentChatterPat.value = null;
					this.chatterMode.value = 'IDLE';
					this.chatterTimer = 1;
				}

			}
		}else{
			this.chatterMode.value = 'IDLE';

			if(this.chatterPatQueue.length > 0) {
				this.currentChatterPat.value = this.chatterPatQueue.shift();
				this.chatterMode.value = 'SHOWING';
				this.chatterTimer = 10;
			}
		}
	}	
}
