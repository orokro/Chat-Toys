/*
	StreamBuddies.js
	----------------

	This class handles the state for the StreamBuddies toy system.

	NOTE: it does not handle the rendering, which will be the StreamBuddies widgets.
*/

// vue
import { ref, shallowRef } from 'vue';
import { socketRef, socketShallowRef, socketShallowRefAsync, bindRef } from 'socket-ref';

// our app
import Toy from "../Toy";
import { BuddySystem } from './BuddySystem';

// components
import StreamBuddiesPage from './StreamBuddiesPage.vue';
import StreamBuddiesWidget from './StreamBuddiesWidget.vue';
import { chromeShallowRef } from '../../scripts/chromeRef';

// main export
export default class StreamBuddies extends Toy {

	// static info
	static name = 'Stream Buddies';
	static slug = 'streamBuddies';
	static desc = 'Let viewers spawn buddies on your stream.';
	static optionsPageComponent = StreamBuddiesPage;
	static themeColor = '#B59EDE';
	static widgetComponents = [
		{
			component: StreamBuddiesWidget,
			key: 'widgetBox',
			allowResize: true,
			lockAspectRatio: false,
		}
	];


	/**
	 * Constructs the StreamBuddies object
	 * 
	 * @param {ToyManager} toyManager - reference to the toy manager
	 */
	constructor(toyManager) {

		// call the parent constructor
		super(toyManager);

		// list of commands to perform on the renderer
		this.buddiesState = socketShallowRef(this.static.slugify('buddiesState'), []);
		this.commandQueue = socketShallowRef(this.static.slugify('commandQueue'), []);
		this.activeBuddies = chromeShallowRef('activeBuddies', []);
		
		// build new buddy system
		this.buddySystem = new BuddySystem(
			this,
			this.activeBuddies,
			this.settings.widgetBox,
		); 

		// set up repeating interval to call the buddy system game tick function
		this.buddyInterval = window.setElectronInterval(()=>{
			this.buddiesState.value = {...this.buddySystem.tick()};
		}, 10);
	}
	

	/**
	 * Clean up
	 */
	end(){
		window.clearElectronInterval(this.buddyInterval);
		this.buddySystem.end();
	}
	

	/**
	 * Initialize the settings for this toy
	 */
	initSettings() {

		// channel points settings
		this.buildSettingsBlock({

			maxBuddyCount: ref(5),
			buddySize: ref(1.0),
			widgetBox: shallowRef({
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
				command: 'join',
				description: 'Being on screen is optional, users can opt-in with this command.',
			},
			{
				command: 'leave',
				description: 'Being on screen is optional, users can opt-out with this command.',
			},
			{
				command: 'left',
				params: [
					{ name: 'amount', type: 'number', optional: true, desc: 'Amount to walk left in pixels' },
				],
				description: 'Make their character walk left',
			},
			{
				command: 'right',
				params: [
					{ name: 'amount', type: 'number', optional: true, desc: 'Amount to walk right in pixels' },
				],
				description: 'Make their character walk right',
			},
			{
				command: 'jump',
				params: [
					{ name: 'direction', type: 'string', optional: true, desc: 'Either "left" or "right"' },
				],
				description: 'Make their character jump up, or optionally, a direction.',
			},
			{
				command: 'hug',
				params: [
					{ name: 'user', type: 'username', optional: false, desc: 'user to hug' },
				],
				description: 'Make their character hug another user.',
			},
			{
				command: 'attack',
				params: [
					{ name: 'user', type: 'username', optional: false, desc: 'user to attack' },
				],
				description: 'Make their character attack another user.',
			},
			{
				command: 'dance',
				params: [
					{ name: 'dance_name', type: 'string', optional: true, desc: 'dance to perform, or random if not specified' },
				],
				description: 'Make their character attack another user.',
			},
			{
				command: 'sit',
				description: 'Make character sit down.',
			},
			{
				command: 'fart',
				description: 'Make character fart.',
			}
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

		// log it:
		// console.log('StreamBuddies found', commandSlug, 'from', msg.author, 'with params', params);

		// save these
		const userID = msg.authorUniqueID;
		const username = msg.author;

		// handle commands based on which params they require
		switch(commandSlug){

			// no params
			case 'join':
			case 'leave':
			case 'sit':
			case 'fart':
				this.buddySystem.doCommand(userID, username, commandSlug );
				handshake.accept();
				return;

			// optional amount:
			case 'left':
			case 'right':
				const amtIsUndefined = params.amount === undefined || isNaN(params.amount);
				const amt = amtIsUndefined ? null : parseInt(params.amount, 10);
				this.buddySystem.doCommand(userID, username, commandSlug, amt);
				handshake.accept();
				return;

			// optional direction
			case 'jump':
				const dir = params.direction === undefined ? null : params.direction.toLowerCase();
				if(dir !== null && dir !== 'left' && dir !== 'right'){
					this.chatToysApp.log.error(`${username}: Invalid direction for jump command`);
					handshake.reject();
					return;
				}
				this.buddySystem.doCommand(userID, username, commandSlug, dir);
				handshake.accept();
				return;

			// optional dance name
			case 'dance':
				const dance = params.dance_name === undefined ? null : params.dance_name.toLowerCase();
				if(dance == null || (dance !== 'twerk' && dance !== 'hiphop')){
					handshake.reject(`${username}: Invalid dance name for dance command`);
					return;
				}
				
				this.buddySystem.doCommand(userID, username, commandSlug, dance);
				handshake.accept();
				return;

			// required user
			case 'hug':
			case 'attack':
				if(params.user === undefined || params.user === null){
					this.chatToysApp.log.error(`${username}: Missing user parameter for hug/attack command`);
					handshake.reject();
					return;
				}
				this.buddySystem.doCommand(userID, username, commandSlug, params.user);
				handshake.accept();
				return;
			
		}// switch

		// accept the command which updates the database
		handshake.reject(`${username}: Invalid buddy command`);
	}
	
}
