/*
	Swarm.js
	--------

	This is the class to handle state for the !swarm command.

	This was previously part of the Chat toy, but has been split out into its own toy.

	If enough users use the !swarm command within a short time frame,
	their messages will appear on screen in a swarm effect.
*/

// vue
import { ref, shallowRef, watch } from 'vue';
import { socketRef, socketShallowRef, socketShallowRefAsync, bindRef } from 'socket-ref';

// our app
import Toy from "../Toy";
import { SwarmLogic } from './SwarmLogic';
import { StateTickerQueue } from '@scripts/StateTickerQueue';

// misc/lib
import { randUserName, randSentence, randPhrase, randUuid } from '@ngneat/falso';

// components
import SwarmPage from './SwarmPage.vue';
import SwarmWidget from './SwarmWidget.vue';

// main export
export default class Chat extends Toy {

	static evenOddCounter = 0;

	// static info	
	static name = 'Swarm';
	static slug = 'swarm';
	static desc = 'Users can swarm messages on screen.';
	static optionsPageComponent = SwarmPage;
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
	];

	// Descriptor for the consolidated text-settings modal.
	static textSettings = [
		{
			groupKey: 'swarm',
			groupLabel: 'Swarm Text',
			groupDescription: 'Style for usernames and message bodies in the swarm overlay.',
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

		// our socket state
		this.swarmLog = socketShallowRef(this.static.slugify('swarmLog'), []);
		this.swarmMode = socketShallowRef(this.static.slugify('swarmMode'), 'IDLE');

		// build new swarm logic
		this.swarmLogic = new SwarmLogic(
			50,
			this.settings.swarmSize,
			this.settings.swarmDuration,
			(messages) => { this.swarmLog.value = messages; },
			(swarmIsActive) => {
				this.swarmMode.value = swarmIsActive ? 'SHOWING' : 'IDLE';
				if (swarmIsActive) {
					this.chatToysApp.log.msg('SWARM ACTIVATED!');
				}
			}
		);
		this.tickFN = () => this.swarmLogic.tick();
		electronAPI.tick(this.tickFN);
	}


	/**
	 * Clean up
	 */
	end() {
		super.end();
		electronAPI.clearTick(this.tickFN);
		window.clearElectronTimeout(this.swarmTimeout);
	}


	/**
	 * Initialize the settings for this toy
	 */
	initSettings() {

		// chat settings
		this.buildSettingsBlock({

			swarmSize: ref(5),
			swarmDuration: ref(10),

			showChatterNames: ref(true),
			chatNameColor: ref('#00ABAE'),
			chatTextColor: ref('#FFFFFF'),
			chatTextShadow: ref(true),
			chatTextSize: ref(24),

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
				command: 'swarm',
				params: [
					{ name: 'message', type: 'string', optional: false, desc: 'The message a chatter will "swarm"' },
				],
				description: 'If enough chatters swarm at once, their messages will appear on screen',
				userDesc: 'When many chatters use this at once, it may appear on steam',
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
	 * Tests swarm mode by generating random messages
	 */
	testSwarm() {

		// toggle the swarm mode
		if (this.testingSwarm === undefined)
			this.testingSwarm = true;
		else
			this.testingSwarm = !this.testingSwarm;

		// stop interval & gtfo
		if (this.testingSwarm == false) {
			if (this.swarmTimeout !== null)
				window.clearElectronTimeout(this.swarmTimeout);
			return;
		}

		// recursive timeout to send random messages
		const randomMessage = () => {

			if (this.testingSwarm === false)
				return;

			const id = randUuid();
			const username = randUserName();
			const message = randPhrase();
			this.swarmLogic.newMessage(username, id, message);

			const randomTime = Math.floor(Math.random() * 1500) + 500;
			this.swarmTimeout = window.setElectronTimeout(randomMessage, randomTime);
		}

		// start the random message
		randomMessage();
	}

}
