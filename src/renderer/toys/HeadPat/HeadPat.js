/*
	HeadPat.js
	----------

	This class handles the state for the HeadPat toy system.

	NOTE: it does not handle the rendering, which will be the widgets.
*/

// vue
import { ref, shallowRef, watch, nextTick } from 'vue';
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
	static name = 'Head Pat/Bonk/Slap';
	static slug = 'headPat';
	static desc = 'Let viewers give and receive head pats, bonks, and slaps.';
	static optionsPageComponent = HeadPatsPage;
	static themeColor = '#A4704C';
	static themeColor = '#C6C37A';
	static widgetComponents = [
		{
			component: HeadPatsWidget,
			key: 'streamerWidgetBox',
			allowResize: true,
			lockAspectRatio: true,
			description: 'This widget should be placed over the streamers avatar or webcam feed.',
			slug: 'streamer'
		},
		{
			component: HeadPatsUserWidget,
			key: 'chatterWidgetBox',
			allowResize: true,
			lockAspectRatio: true,
			description: 'This widget will show a head-pat over a generic profile picture of a chatter, and can be placed anywhere.',
			slug: 'chat'
		}
	];

	// Marks this toy as omni-includable. Only the chatter widget is alert-
	// eligible (the streamer-cam variant is persistent overlay state, not a
	// transient popup).
	static isAlertToy = true;
	static alertWidgetSlug = 'chat';

	// Descriptor for the consolidated text-settings modal. The
	// `chatterNameShadow` ref here actually only shadows the username
	// elements (verified in HeadPatsWidget.vue's
	// `&.showTextShadow .patUserName, .targetUserName`), so the label
	// stays "Name shadow" rather than the generic "Text shadow" used
	// elsewhere.
	static textSettings = [
		{
			groupKey: 'chatter',
			groupLabel: 'Chatter Name',
			groupDescription: 'Style for the chatter names shown above the pat/bonk/slap targets.',
			fields: [
				{ key: 'chatterNameFontSize', label: 'Font size',      type: 'number', min: 8, max: 96 },
				{ key: 'chatterNameColor',    label: 'Username color', type: 'color' },
				{ key: 'chatterTextColor',    label: 'Text color',     type: 'color' },
				{ key: 'chatterNameShadow',   label: 'Name shadow',    type: 'boolean' },
			],
			defaults: {
				chatterNameFontSize: 25,
				chatterNameColor:    '#00ABAE',
				chatterTextColor:    '#FFFFFF',
				chatterNameShadow:   true,
			},
		},
	];


	/**
	 * Constructs the Gamba object
	 * 
	 * @param {ToyManager} toyManager - reference to the toy manager
	 */
	constructor(toyManager) {

		// call the parent constructor
		super(toyManager);

		// make two queues - one for chatter pats and one for streamer pats.
		// Only the chatter queue is omni-gated - the streamer widget lives
		// over the streamer's avatar / cam and runs continuously, it's not
		// an alert-style popup and isn't included in omnis.
		this.streamerPatQueue = new StateTickerQueue(this.handlePatQueue.bind(this), 2, 10);
		this.chatterPatQueue = new StateTickerQueue(
			this.handleChatQueue.bind(this),
			2, 10,
			{ canFire: () => !this.chatToysApp.omniRegistry.isBlocking(this.slug) }
		);
		
		// listen to ticks
		this.tickFN = () => {
			this.streamerPatQueue.tick();
			this.chatterPatQueue.tick();
		};
		electronAPI.tick(this.tickFN);

		// the mode we're in, either 'IDLE', or 'SHOWING'
		this.streamerMode = socketShallowRef(this.static.slugify('streamerMode'), 'IDLE');
		this.chatterMode = socketShallowRef(this.static.slugify('chatterMode'), 'IDLE');

		// path to the user image
		this.userImagePath = socketShallowRef(
			this.static.slugify('userImagePath'), 
			this.getAssetPath(this.settings.headPatChatterImage.value));

		// we will have two queues for head pats - one for streamer and one for chatters
		// but at any given time one variable to hold the current pattern being shown
		this.currentPat = socketShallowRef(this.static.slugify('currentPat'), null);
		this.currentChatterPat = socketShallowRef(this.static.slugify('currentChatterPat'), null);
		
		// sounds
		this.bonkSoundPath = socketShallowRef(
			this.static.slugify('bonkSoundPath'),
			this.getAssetPath(this.settings.bonkSoundId.value));
		this.slapSoundPath = socketShallowRef(
			this.static.slugify('slapSoundPath'),
			this.getAssetPath(this.settings.slapSoundId.value));

		// set up a watcher to update the user image path
		watch(this.settings.headPatChatterImage, () => {
			this.userImagePath.value = this.getAssetPath(this.settings.headPatChatterImage.value);
		});
		
		// watch sound ids
		watch(this.settings.bonkSoundId, () => {
			this.bonkSoundPath.value = this.getAssetPath(this.settings.bonkSoundId.value);
		}, { immediate: true });
		watch(this.settings.slapSoundId, () => {
			this.slapSoundPath.value = this.getAssetPath(this.settings.slapSoundId.value);
		}, { immediate: true });
	}


	/**
	 * Whether the chatter pat popup is currently on screen. Used by the
	 * Omni registry to gate other included toys. Only the chatter widget
	 * is considered for omni purposes - the streamer-cam variant doesn't
	 * count, it runs persistently over the avatar.
	 *
	 * @returns {boolean}
	 */
	isShowing(){
		return this.chatterMode.value !== 'IDLE';
	}


	/**
	 * Clean up
	 */
	end(){
		super.end();
		electronAPI.clearTick(this.tickFN);
	}


	/**
	 * Initialize the settings for this toy
	 */
	initSettings() {

		// head pat settings
		this.buildSettingsBlock({
			timeToShow: ref(5),
			showPatterName: ref(true),
			chatterNameFontSize: ref(25),
			chatterNameColor: ref('#00ABAE'),
			chatterTextColor: ref('#FFFFFF'),
			chatterNameShadow: ref(true),
			allowUserPats: ref(true),
			headPatChatterImage: ref('22'),
			enableWidgetSound: ref(true),
			bonkSoundId: ref('32'),
			slapSoundId: ref('33'),
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
				description: 'Show head pat graphic on streamer, or optionally a chatter!',
				userDesc: 'Give out head pats!',
				tipText: 'Pat the streamer with {cmd}, or pat someone else: {cmd} @user',
			},
			{
				command: 'bonk',
				params: [
					{ name: 'user', type: 'username', optional: true, desc: 'Which chatter to bonk' },
				],
				description: 'Show bonk graphic on streamer, or optionally a chatter!',
				userDesc: 'Give out bonks!',
				tipText: 'Bonk the streamer with {cmd}, or bonk someone else: {cmd} @user',
			},
			{
				command: 'slap',
				params: [
					{ name: 'user', type: 'username', optional: true, desc: 'Which chatter to slap' },
				],
				description: 'Show slap graphic on streamer, or optionally a chatter!',
				userDesc: 'Give out slaps!',
				tipText: 'Slap the streamer with {cmd}, or slap someone else: {cmd} @user',
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

		// if the command is a pat command, we will show the pat on the streamer
		if(['pat', 'slap', 'bonk'].includes(commandSlug)){
			
			// if the user param is provided on the params {} object
			// only show the pat on the chatter if it's enabled, otherwise show it on the streamer
			if(params.user) {
				if(this.settings.allowUserPats.value) {
					this.chatterPatQueue.addToQueue({
						patter: msg.author, pattee:params.user, duration: this.settings.timeToShow.value, kind: commandSlug});
				} else {
					this.streamerPatQueue.addToQueue({
						patter: msg.author, pattee: '', duration: this.settings.timeToShow.value, kind: commandSlug});
				}
			} else {
				this.streamerPatQueue.addToQueue({
					patter: msg.author, pattee: '', duration: this.settings.timeToShow.value, kind: commandSlug});
			}
		}

		// show on system console
		this.chatToysApp.log.msg(msg.author + ' used !' + this.getCommandFromSlug(commandSlug));

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
		this.currentPat.value = stateDetails;
		nextTick(()=>{
			this.streamerMode.value = 'SHOWING';		
		});
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
		this.currentChatterPat.value = stateDetails;
		nextTick(()=>{
			this.chatterMode.value = 'SHOWING';		
		});
	}

}
