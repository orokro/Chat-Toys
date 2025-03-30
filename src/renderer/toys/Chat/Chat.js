/*
	Chat.js
	-------

	This class handles the state for the Chat features toy system.

	NOTE: it does not handle the rendering, which will be the widgets.
*/

// vue
import { ref, shallowRef } from 'vue';

// our app
import Toy from "../Toy";

// components
import ChatBoxPage from './ChatBoxPage.vue';

// main export
export default class Chat extends Toy {

	// static info	
	static name = 'Chat';
	static slug = 'chat';
	static desc = 'Add a chat overlay to your stream.';
	static optionsPageComponent = ChatBoxPage;
	static themeColor = '#60C5F1';
	static widgetComponents = [
		{
			component: null,
			key: 'chatWidgetBox',
			allowResize: true,
			lockAspectRatio: false,
		},
		{
			component: null,
			key: 'shoutWidgetBox',
			allowResize: true,
			lockAspectRatio: false,
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
	}


	/**
	 * Initialize the settings for this toy
	 */
	initSettings() {

		// channel points settings
		this.buildSettingsBlock({

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
			},
			{
				command: 'swarm',
				params: [
					{ name: 'message', type: 'string', optional: false, desc: 'The message a chatter will "swarm"' },
				],
				description: 'If enough chatters swarm at once, their messages will appear on screen',
			}
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
		console.log('Chat found', commandSlug, 'from', msg.author, 'with params', params);

		// accept the command which updates the database
		handshake.accept();
	}
	
}
