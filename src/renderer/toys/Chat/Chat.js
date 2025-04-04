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
import { ref, registerRuntimeCompiler, shallowRef, watch } from 'vue';
import { socketRef, socketShallowRef, socketShallowRefAsync, bindRef } from 'socket-ref';

// our app
import Toy from "../Toy";
import { Swarm } from './Swarm';
import { StateTickerQueue } from '@scripts/StateTickerQueue';

// misc/lib
import { randUserName, randSentence, randPhrase, randUuid } from '@ngneat/falso';

// components
import ChatBoxPage from './ChatBoxPage.vue';
import ChatBoxWidget from './ChatBoxWidget.vue';
import ShoutWidget from './ShoutWidget.vue';
import SwarmWidget from './SwarmWidget.vue';

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
			component: SwarmWidget,
			key: 'swarmWidgetBox',
			allowResize: true,
			lockAspectRatio: false,
			description: 'Shows swarm messages. Should ideally be placed full screen for maximum effect.',
			slug: 'swarmBox'
		},
		{
			component: ChatBoxWidget,
			key: 'chatWidgetBox',
			allowResize: true,
			lockAspectRatio: false,
			description: 'Displays live chat.',
			slug: 'liveChat'
		},
		{
			component: ShoutWidget,
			key: 'shoutWidgetBox',
			allowResize: true,
			lockAspectRatio: false,
			description: 'Shows when a chatter uses the !shout command. Similar to super chats, but channel points instead.',
			slug: 'shoutBox'
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

		// we'll use a ticker for queuing up shout messages
		this.shoutQueue = new StateTickerQueue(this.handleShoutQueue.bind(this), 2, 10);
		electronAPI.tick(() => this.shoutQueue.tick());

		// our socket state
		this.soundPath = socketShallowRef(
			this.static.slugify('soundPath'),
			this.getAssetPath(this.settings.shoutSoundId.value));
		this.chatFramePath = socketShallowRef(
			this.static.slugify('chatFramePath'),
			this.getAssetPath(this.settings.chatBoxImage.value));
		this.shoutMessage = socketShallowRef(this.static.slugify('shoutMessage'), '');
		this.shoutMode = socketShallowRef(this.static.slugify('shoutMode'), 'IDLE');
		this.chatLog = socketShallowRef(this.static.slugify('chatLog'), []);
		this.swarmLog = socketShallowRef(this.static.slugify('swarmLog'), []);
		this.swarmMode = socketShallowRef(this.static.slugify('swarmMode'), 'IDLE');

		// listen to changes in the shout sound
		watch(this.settings.shoutSoundId, (value) => {
			this.soundPath.value = this.getAssetPath(value);
		});

		// listen to changes in the chat box image
		watch(this.settings.chatBoxImage, (value) => {
			this.chatFramePath.value = this.getAssetPath(value);
		});

		// listen for incoming chat messages from chat processor
		this.handleChatMessage = this.handleChatMessage.bind(this);
		this.chatToysApp.chatProcessor.onNewChats(this.handleChatMessage);

		// build new swarm logic
		this.swarmLogic = new Swarm(
			50,
			this.settings.swarmSize,
			this.settings.swarmDuration,
			(messages) => { this.swarmLog.value = messages; },
			(swarmIsActive) => { this.swarmMode.value = swarmIsActive ? 'SHOWING' : 'IDLE'; }
		);
		electronAPI.tick(() => this.swarmLogic.tick());

	}


	/**
	 * Initialize the settings for this toy
	 */
	initSettings() {

		// channel points settings
		this.buildSettingsBlock({

			enableChatBox: ref(false),
			enableChatBoxImage: ref(false),
			chatBoxImage: ref('3'),
			filterCommands: ref(true),
			showChatterNames: ref(true),
			chatNameColor: ref('#00ABAE'),
			chatTextColor: ref('#FFFFFF'),
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
			swarmWidgetBox: shallowRef({
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

		// if we got a shout command
		if (commandSlug === 'shout') {

			// NOTE: shout command should be fully validated by the time it gets here
			// so we can just accept it and queue it up

			// queue the shout message
			this.shoutQueue.addToQueue({
				message: {
					user: msg.author,
					message: params.message,
				}
			});

			// we gucci
			handshake.accept();
			return;
		}

		// if we got a swarm command
		if (commandSlug === 'swarm') {

			// NOTE: swarm command should be fully validated by the time it gets here
			// so we can just accept it and queue it up

			// queue the swarm message
			this.swarmLogic.newMessage(msg.author, msg.authorUniqueID, params.message);

			// we gucci
			handshake.accept();
			return;
		}

	}


	/**
	 * Handle when a new chat message comes in
	 * 
	 * @param {Array<Object>} chats - list of new chat messages
	 */
	handleChatMessage(chats) {

		// spread into new array for new pointer
		const chatLogMessages = [...this.chatLog.value];

		// process each of the chat messages
		for(const chat of chats) {

			// skip chat.message starts with !
			if(this.settings.filterCommands.value==true && chat.messageText.startsWith('!'))
				continue;

			// add smaller chat object to the array
			chatLogMessages.push({
				id: chat.id,
				author: chat.author,
				message: chat.messageText,
				isMember: chat.isMember,
			});
			
		}// next chat

		// trim list if it's too long
		while(chatLogMessages.length > 100)
			chatLogMessages.shift();
		
		// update our socket ref
		this.chatLog.value = chatLogMessages;
	}


	/**
	 * Handle the shout queue change
	 * 
	 * @param {Object} item - the item in the queue
	 */
	handleShoutQueue(item) {

		// if it's null, we're in wait mode
		if(item === null) {
			this.shoutMode.value = 'IDLE';
			return;
		}

		// otherwise we're in SHOWING mode
		this.shoutMode.value = 'SHOWING';
		this.shoutMessage.value = item.message;
	}


	/**
	 * Clean up
	 */
	end(){
		this.chatToysApp.chatProcessor.removeNewChatsListener(this.onNewChats);
	}


	/**
	 * Tests swarm mode by generating random messages
	 */
	testSwarm(){

		// toggle the swarm mode
		if(this.testingSwarm === undefined)
			this.testingSwarm = true;
		else
			this.testingSwarm = !this.testingSwarm;

		// stop interval & gtfo
		if(this.testingSwarm==false){
			if(this.swarmTimeout !== null)
				clearTimeout(this.swarmTimeout);
			return;
		}

		// recursive timeout to send random messages
		const randomMessage = () => {

			if(this.testingSwarm === false)
				return;

			const id =  randUuid();
			const username =  randUserName();
			const message =  randPhrase();
			this.swarmLogic.newMessage(username, id, message);

			const randomTime = Math.floor(Math.random() * 1500) + 500;
			this.swarmTimeout = setTimeout(randomMessage, randomTime);
		}

		// start the random message
		randomMessage();
	}

}
