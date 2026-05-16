/*
	Chat.js
	-------

	This class handles the state for the Chat features toy system.

	NOTE: it does not handle the rendering, which will be the widgets.

	ALSO NOTE: there's technically a few different systems in this toy:
	- Chat Box
	- Shout Box
	- Swarm Box

	Technically I could break the logic down into separate classes, but
	I decided just to do that for Swarm since it's the most technical.
*/

// vue
import { ref, shallowRef, watch } from 'vue';
import { socketRef, socketShallowRef, socketShallowRefAsync, bindRef } from 'socket-ref';

// our app
import Toy from "../Toy";
import { StateTickerQueue } from '@scripts/StateTickerQueue';
import { ChatPointsHelper } from './ChatPointsHelper';

// misc/lib
import { randUserName, randSentence, randPhrase, randUuid } from '@ngneat/falso';

// components
import ChatBoxPage from './ChatBoxPage.vue';
import ChatBoxWidget from './ChatBoxWidget.vue';

// main export
export default class Chat extends Toy {

	static evenOddCounter = 0;

	// static info	
	static name = 'Chat';
	static slug = 'chat';
	static desc = 'Add a chat overlay to your stream.';
	static optionsPageComponent = ChatBoxPage;
	static themeColor = '#60C5F1';
	static widgetComponents = [
		{
			component: ChatBoxWidget,
			key: 'chatWidgetBox',
			allowResize: true,
			lockAspectRatio: false,
			description: 'Displays live chat.',
			slug: 'liveChat'
		},
	];

	// Text-style settings, grouped for the consolidated text-settings modal.
	// Keys here MUST match the refs declared in initSettings() below; this is
	// purely a presentation descriptor for the SettingsTextRow + TextSettingsModal.
	static textSettings = [
		{
			groupKey: 'chat',
			groupLabel: 'Chat Text',
			groupDescription: 'Style for usernames and message bodies in the chat overlay.',
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

		this.chatFramePath = socketShallowRef(
			this.static.slugify('chatFramePath'),
			this.getAssetPath(this.settings.chatBoxImage.value));
		this.chatLog = socketShallowRef(this.static.slugify('chatLog'), []);
		this.pointsData = socketShallowRef(this.static.slugify('pointsData'), []);

		// listen to changes in the chat box image
		watch(this.settings.chatBoxImage, (value) => {
			this.chatFramePath.value = this.getAssetPath(value);
		});

		// listen for incoming chat messages from chat processor
		this.handleChatMessage = this.handleChatMessage.bind(this);
		this.chatToysApp.chatProcessor.onNewChats(this.handleChatMessage);

		this.pointsDataHelper = (pointsData) => {
			this.pointsData.value = pointsData;
		};
		this.pointsDataHelper = this.pointsDataHelper.bind(this);
		this.chatPointsHelper = new ChatPointsHelper(this, this.pointsDataHelper);
	}


	/**
	 * Clean up when the toy is removed.
	 *
	 * Two bugs lived here previously, both of which threw
	 *   "The 'listener' argument must be of type function. Received undefined"
	 * because the wrong (undefined) value was being passed to a removeListener-
	 * style API:
	 *   - electronAPI.clearTick(this.tickFN) - this toy never assigned tickFN
	 *     (it has no tick loop), so the arg was always undefined. Removed
	 *     entirely.
	 *   - removeNewChatsListener(this.onNewChats) - the listener was actually
	 *     registered as this.handleChatMessage (see the constructor); the
	 *     `onNewChats` field doesn't exist on Chat. Fixed.
	 */
	end() {
		super.end();
		this.chatToysApp.chatProcessor.removeNewChatsListener(this.handleChatMessage);
		this.chatPointsHelper.destroy();
	}


	/**
	 * Initialize the settings for this toy
	 */
	initSettings() {

		// chat settings
		this.buildSettingsBlock({

			enableChatBox: ref(true),
			enableChatBoxImage: ref(false),
			chatBoxImage: ref('3'),
			filterCommands: ref(true),
			showChatterNames: ref(true),
			showChatterPFP: ref(true),
			pfpSize: ref(32),
			messageOnNewLine: ref(true),
			customChatTheme: ref(''),
			chatNameColor: ref('#00ABAE'),
			chatTextColor: ref('#FFFFFF'),
			chatTextShadow: ref(true),
			chatTextSize: ref(24),
			showSystemMessages: ref(true),
			cachePFPImages: ref(true),
			groupUserMessages: ref(false),
			showChatterPoints: ref(true),

			chatWidgetBox: shallowRef({
				x: 1280 - 300,
				y: 0,
				width: 300,
				height: 400
			}),
		});

		// this must always be true now
		// (old installed versions may have it false, but we want to force it true now)
		this.settings.enableChatBox.value = true;
	}


	/**
	 * Initialize the commands for this toy
	 */
	buildCommands() {

		// super.buildCommands([
		// 	{
		// 		command: 'shout',
		// 		params: [
		// 			{ name: 'message', type: 'string', optional: false, desc: 'The message a chatter will "shout"' },
		// 		],
		// 		description: 'A chatter can shout a message in exchange for channel points',
		// 		userDesc: 'Like Super Chat, but spend channel points',
		// 	},
		// 	{
		// 		command: 'swarm',
		// 		params: [
		// 			{ name: 'message', type: 'string', optional: false, desc: 'The message a chatter will "swarm"' },
		// 		],
		// 		description: 'If enough chatters swarm at once, their messages will appear on screen',
		// 		userDesc: 'When many chatters use this at once, it may appear on steam',
		// 	}
		// ]);
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


	}


	/**
	 * Handle when a new chat message comes in
	 *      * @param {Array<Object>} chats - list of new chat messages
	 */
	handleChatMessage(chats) {

		// Ensure our static group trackers exist (initialize if first run)
		if (typeof Chat.groupCounter === 'undefined') Chat.groupCounter = 0;
		if (typeof Chat.lastAuthorUniqueID === 'undefined') Chat.lastAuthorUniqueID = null;

		// spread into new array for new pointer
		const chatLogMessages = [...this.chatLog.value];

		// process each of the chat messages
		for (const chat of chats) {

			// skip chat.message starts with !
			if (this.settings.filterCommands.value == true && chat.messageText.startsWith('!'))
				continue;

			// --- 1. Standard Message Parity (Existing Logic) ---
			Chat.evenOddCounter++;
			if (Chat.evenOddCounter > 1000000)
				Chat.evenOddCounter = 0;

			// --- 2. Group Parity (New Logic) ---
			// We check if this author is different from the absolute last one seen in the stream
			if (chat.authorUniqueID !== Chat.lastAuthorUniqueID) {
				Chat.groupCounter++;
				Chat.lastAuthorUniqueID = chat.authorUniqueID;

				// Reset safety (matches your existing pattern)
				if (Chat.groupCounter > 1000000) Chat.groupCounter = 0;
			}

			// package and add smaller chat object to the array
			const chatData = {
				id: chat.id,
				author: chat.author,
				authorUniqueID: chat.authorUniqueID,
				pfpUrl: chat.authorPFPUrl,
				message: chat.messageText,
				isMember: chat.isMember,
				emojis: chat.emojis,
				syslogger: chat.syslogger,

				// Standard Message coloring
				isOdd: (Chat.evenOddCounter % 2 === 1),
				moduloKey: ['a', 'b', 'c', 'd'][Chat.evenOddCounter % 4],

				// NEW: Group coloring
				// Every message knows what color its Group should be
				isGroupOdd: (Chat.groupCounter % 2 === 1),
				groupModuloKey: ['a', 'b', 'c', 'd'][Chat.groupCounter % 4],
			};
			chatLogMessages.push(chatData);

			// tell our points fetcher to hit the database eventually
			this.chatPointsHelper.addMessage(chatData);
		}// next chat

		// trim list if it's too long
		while (chatLogMessages.length > 100)
			chatLogMessages.shift();

		// update our socket ref
		this.chatLog.value = chatLogMessages;
	}

}
