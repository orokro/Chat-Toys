/*
	Shout.js
	--------

	This is the class to handle state for the !shout command.

	This was previously part of the Chat toy, but has been split out into its own toy.
*/

// vue
import { nextTick, ref, shallowRef, watch } from 'vue';
import { socketRef, socketShallowRef, socketShallowRefAsync, bindRef } from 'socket-ref';

// our app
import Toy from "../Toy";
import { StateTickerQueue } from '@scripts/StateTickerQueue';

// misc/lib
import { randUserName, randSentence, randPhrase, randUuid } from '@ngneat/falso';

// components
import ShoutPage from './ShoutPage.vue';
import ShoutWidget from './ShoutWidget.vue';

// main export
export default class Shout extends Toy {

	static evenOddCounter = 0;

	// static info	
	static name = 'Shout';
	static slug = 'shout';
	static desc = 'Let uses show on screen messages for points.';
	static optionsPageComponent = ShoutPage;
	static themeColor = '#60C5F1';
	static widgetComponents = [
		{
			component: ShoutWidget,
			key: 'shoutWidgetBox',
			allowResize: true,
			lockAspectRatio: false,
			description: 'Shows when a chatter uses the !shout command. Similar to super chats, but channel points instead.',
			slug: 'shoutBox'
		},
	];

	// Marks this toy as omni-includable + names which of its widgets is
	// the alert-style widget (Shout only has one, but the convention is
	// uniform across toys).
	static isAlertToy = true;
	static alertWidgetSlug = 'shoutBox';

	// Descriptor for the consolidated text-settings modal.
	static textSettings = [
		{
			groupKey: 'shout',
			groupLabel: 'Shout Text',
			groupDescription: 'Style for usernames and message bodies in the on-screen shout.',
			fields: [
				{ key: 'chatNameColor',  label: 'Username color', type: 'color' },
				{ key: 'chatTextColor',  label: 'Text color',     type: 'color' },
				{ key: 'chatTextSize',   label: 'Font size',      type: 'number', min: 8, max: 96 },
				{ key: 'chatTextShadow', label: 'Text shadow',    type: 'boolean' },
			],
			defaults: {
				chatNameColor:  '#00ABAE',
				chatTextColor:  '#FFFFFF',
				chatTextSize:   24,
				chatTextShadow: true,
			},
		},
	];


	/**
	 * Constructs the Chat object
	 * 
	 * @param {ToyManager} toyManager - reference to the toy manager
	 */
	constructor(toyManager) {

		// call the parent constructor
		super(toyManager);

		// we'll use a ticker for queuing up shout messages.
		// The canFire gate lets the Omni toy hold this queue while another
		// included toy is showing, so alerts serialize through a single visual
		// slot when the streamer's bundled them in an Omni widget.
		this.shoutQueue = new StateTickerQueue(
			this.handleShoutQueue.bind(this),
			2, 10,
			{ canFire: () => !this.chatToysApp.omniRegistry.isBlocking(this.slug) }
		);
		this.tickFN = () => this.shoutQueue.tick();
		electronAPI.tick(this.tickFN);

		// our socket state
		this.soundPath = socketShallowRef(
			this.static.slugify('soundPath'),
			this.getAssetPath(this.settings.shoutSoundId.value));
		this.shoutMessage = socketShallowRef(this.static.slugify('shoutMessage'), '');
		this.shoutMode = socketShallowRef(this.static.slugify('shoutMode'), 'IDLE');		

		nextTick(() => {
			this.shoutMode.value = 'IDLE';
		});

		// listen to changes in the shout sound
		watch(this.settings.shoutSoundId, (value) => {
			this.soundPath.value = this.getAssetPath(value);
		});
	}


	/**
	 * Whether this toy is currently displaying a shout. Used by the Omni
	 * registry to gate other included toys.
	 *
	 * @returns {boolean}
	 */
	isShowing() {
		return this.shoutMode.value !== 'IDLE';
	}


	/**
	 * Clean up
	 */
	end() {
		super.end();
		electronAPI.clearTick(this.tickFN);
	}


	/**
	 * Initialize the settings for this toy
	 */
	initSettings() {

		// chat settings
		this.buildSettingsBlock({

			enableSound: ref(true),
			shoutSoundId: ref('11'),
			displayDuration: ref(5),

			showChatterNames: ref(true),
			chatNameColor: ref('#00ABAE'),
			chatTextColor: ref('#FFFFFF'),
			chatTextShadow: ref(true),
			chatTextSize: ref(24),

			shoutWidgetBox: shallowRef({
				x: 20,
				y: 20,
				width: 400,
				height: 100
			}),
		});
	}


	/**
	 * Initialize the commands for this toy
	 */
	buildCommands() {

		super.buildCommands([
			{
				command: 'shout',
				params: [
					{ name: 'message', type: 'string', optional: false, desc: 'The message a chatter will "shout"' },
				],
				description: 'A chatter can shout a message in exchange for channel points',
				userDesc: 'Like Super Chat, but spend channel points',
				tipText: 'Got something to say? {cmd} <message> shouts it on stream',
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

		// if we got a shout command
		if (commandSlug === 'shout') {

			// NOTE: shout command should be fully validated by the time it gets here
			// so we can just accept it and queue it up

			// queue the shout message
			this.shoutQueue.addToQueue({
				message: {
					user: msg.author,
					message: params.message,					
				},
				duration: parseInt(this.settings.displayDuration.value, 10)
			});

			this.chatToysApp.log.msg(msg.author + ' used !shout ');

			// we gucci
			handshake.accept();
			return;
		}
	}


	/**
	 * Handle the shout queue change
	 * 
	 * @param {Object} item - the item in the queue
	 */
	handleShoutQueue(item) {

		// if it's null, we're in wait mode
		if (item === null) {
			this.shoutMode.value = 'IDLE';
			return;
		}

		// otherwise we're in SHOWING mode
		this.shoutMode.value = 'SHOWING';
		this.shoutMessage.value = item.message;
	}

}
