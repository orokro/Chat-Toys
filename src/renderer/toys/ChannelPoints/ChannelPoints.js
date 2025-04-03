/*
	ChannelPoints.js
	----------------

	This class handles the state for the Channel Points system,
	which is really the heart of the app.

	NOTE: it does not handle the rendering, which will be the widgets.
*/

// vue
import { ref, shallowRef, computed } from 'vue';
import { socketRef, socketShallowRef, socketShallowRefAsync, bindRef } from 'socket-ref';

// our app
import Toy from "../Toy";

// lib/misc
import { v4 as uuidv4 } from 'uuid';

// components
import ChannelPointsPage from './ChannelPointsPage.vue';
import ChannelPointsWidget from "./ChannelPointsWidget.vue";

// main export
export default class ChannelPoints extends Toy {

	// static info	
	static name = 'Channel Points';
	static slug = 'channelPoints';
	static desc = 'Let users occasionally earn points for watching your stream.';
	static optionsPageComponent = ChannelPointsPage;
	static themeColor = '#EED43A';
	static widgetComponents = [
		{
			component: ChannelPointsWidget,
			key: 'widgetBox',
			allowResize: true,
			lockAspectRatio: true,			
			description: 'This widget periodically appears to show the current points available to claim.',
			slug: 'points'
		}
	];


	/**
	 * Constructs the ChannelPoints object
	 * 
	 * @param {ToyManager} toyManager - reference to the toy manager
	 */
	constructor(toyManager) {

		// call the parent constructor
		super(toyManager);

		// state vars we share w/ the UI
		this.claimCommand = this.initClaimCommand();
		this.claimsLeft = socketShallowRef(this.static.slugify('claimsLeft'), 0);
		this.mode = socketShallowRef(this.static.slugify('mode'), 'idle');
		this.timeLeftNormalised = socketShallowRef(this.static.slugify('timeLeftNormalised'), 0);
		this.userClaims = socketShallowRef(this.static.slugify('userClaims'), []);

		// internal state vars
		this.timeLeft = 0;

		// starts logic for this item
		setTimeout(()=>{
			this.start();
		}, 1000);
	}


	/**
	 * Builds logic for the claim command & binds it to a computed from our start
	 * 
	 * @returns {Ref} - the ref for the claim command
	 */
	initClaimCommand(){

		// all of the commands system wide are stored in this chrome shallow ref
		const commandsRef = this.chatToysApp.commands;

		// get the command used for claiming points
		const claimCommand = computed(() => {
			return commandsRef.value.channelPoints__get?.command || '';
		});

		// build the ref & bind it to our computed so it updates automatically
		const command = socketShallowRef(this.static.slugify('claimCommand'), claimCommand.value);
		bindRef(claimCommand).to(command);

		return command;
	}

	
	/**
	 * Initialize the settings for this toy
	 */
	initSettings() {

		// channel points settings
		this.buildSettingsBlock({

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
			widgetIconPath: ref('builtin/' + this.chatToysApp.assetsMgr.getFileData('1').name),
			widgetBox: shallowRef({
				x: 1280 - 150,
				y: 720 - 150,
				width: 150,
				height: 150
			}),
		});
	}


	/**
	 * Initialize the commands for this toy
	 */
	buildCommands() {
		
		super.buildCommands([
			{
				command: 'get',
				description: 'Claim points',
				costEnabled: false,
			},	
			{
				command: 'me',
				description: 'Have on screen text show your points',
				costEnabled: false,
			},
			{
				command: 'give',
				params: [
					{ name: 'amount', type: 'number', optional: false, desc: 'The amount of points to give' },
					{ name: 'user', type: 'username', optional: false, desc: 'The user to give points to' },
				],
				description: 'One user can give points to another user',
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
		console.log('Channel Points found', commandSlug, 'from', msg.author, 'with params', params);

		// handle get attempts
		if(commandSlug === 'get'){
			this.doGet(msg, user, params, handshake);
			return;
		}

		// handle me attempts
		if(commandSlug === 'me'){
			this.doMe(msg, user, params, handshake);
			return;
		}

		// handle give attempts
		if(commandSlug === 'give'){
			this.doGive(msg, user, params, handshake);
			return;
		}
		
		// accept the command which updates the database
		handshake.accept();
	}


	/**
	 * User attempts to get the points
	 * 
	 * @param {Object} msg - the message object
	 * @param {Object} user - the user object
	 * @param {Object} params - the parameters passed to the command
	 * @param {Object} handshake - object like { accept: Function, reject: Function } to accept or reject the command
	 */
	doGet(msg, user, params, handshake) {

		// if we're not in the get mode, reject the command
		if(this.mode.value !== 'GET'){
			handshake.reject(`${msg.author}: Not in GET mode`);
			return;
		}

		// if we don't have any claims left, reject the command
		if(this.claimsLeft.value <= 0){
			handshake.reject(`${msg.author}: No claims left`);
			return;
		}

		// decrement the claims left
		this.claimsLeft.value--;

		// if there's no claims left, return to idle mode
		if(this.claimsLeft.value <= 0)
			setTimeout(()=>{
				this.startGetMode();
			}, 1000);

		// update the user's points and other data
		window.ytctDB.updateUser(msg.authorUniqueID, {
			relativePoints: this.settings.pointsPerClaim.value,
		});

		// log success!
		this.chatToysApp.log.msg(msg.author + ' claimed ' + this.settings.pointsPerClaim.value + ' points!');
		
		// get list of claims so we can send to the UI
		const userClaims = [...this.userClaims.value];
		userClaims.push({
			id: uuidv4(),
			text: `${msg.author} +${this.settings.pointsPerClaim.value}!`,
		});

		// if the length is greater than 10, remove the first one
		if(userClaims.length > 10)
			userClaims.shift();
	
		this.userClaims.value = userClaims;

		// we have accepted the command
		handshake.accept();
	}
	

	/**
	 * Logs user current points
	 * 
	 * @param {Object} msg - the message object
	 * @param {Object} user - the user object
	 * @param {Object} params - the parameters passed to the command
	 * @param {Object} handshake - object like { accept: Function, reject: Function } to accept or reject the command
	 */
	doMe(msg, user, params, handshake) {

		// get the user
		const userData = window.ytctDB.getUser(msg.authorUniqueID);

		const points = userData ? userData.points : 0;

		// log success!
		this.chatToysApp.log.info(`${msg.author} has ${points} points`);

		// we have accepted the command
		handshake.accept();
	}


	/**
	 * User attempts to give points to another user
	 * 
	 * @param {Object} msg - the message object
	 * @param {Object} user - the user object
	 * @param {Object} params - the parameters passed to the command
	 * @param {Object} handshake - object like { accept: Function, reject: Function } to accept or reject the command
	 */
	doGive(msg, user, params, handshake) {

		// first we have to see if the user has enough points to give
		const giveUserData = window.ytctDB.getUser(msg.authorUniqueID);
		const giveUserPoints = giveUserData ? giveUserData.points : 0;

		// if the user doesn't have enough points, reject the command
		if(giveUserPoints < params.amount){
			handshake.reject(`${msg.author}: Not enough points to give`);
			return;
		}

		// first we'll check to see if we have the params.user in the database
		const receiveUserData = window.ytctDB.getUserByDisplayName(params.user);

		// if we have it, we can: subtract points from the caller user & add points to the receiver user
		if(receiveUserData){

			// update the user's points and other data
			window.ytctDB.updateUser(msg.authorUniqueID, {
				relativePoints: -params.amount,
			});

			// update the user's points and other data
			window.ytctDB.updateUser(receiveUserData.youtube_id, {
				relativePoints: params.amount,
			});

			// log success!
			this.chatToysApp.log.msg(`${msg.author} gave ${params.amount} points to ${params.user}`);
			
			// we have accepted the command
			handshake.accept();
			return;
		}

		// check to see if we've seen them in chat recently
		const receiveUser = this.chatToysApp.chatProcessor.seenAuthors.get(params.user)[0];

		// if we haven't seen them, reject the command
		if(!receiveUser){
			handshake.reject(`${msg.author}: User "${params.user}" not found`);
			return;
		}

		// if we have seen them, we'll add them to the database
		window.ytctDB.updateUser(receiveUser, {

			displayName: params.user,
			streamID: msg.streamID,
			relativePoints: params.amount,
		});

		// subtract points from the caller user
		window.ytctDB.updateUser(msg.authorUniqueID, {
			relativePoints: -params.amount,
		});

		// log success!
		this.chatToysApp.log.msg(`${msg.author} gave ${params.amount} points to ${params.user}`);
		handshake.accept();
	}


	/**
	 * Starts the logic loop for this toy
	 */
	start(){

		// set our mode to 'get' to begin with
		this.startGetMode();

		// universal tick
		this.tickInterval = setInterval(()=>{

			this.tick();
		}, 500);
	}


	/**
	 * Regardless of which mode we're in (GET or IDLE), we're always ticking
	 */
	tick(){

		// decrement the time left
		this.setTimeLeft(this.timeLeft - 1);

		// if we're out of time, switch modes
		if(this.timeLeft <= 0){
			console.log('Time is up!');
			
			if(this.mode.value === 'GET')
				this.startIdleMode();
			else
				this.startGetMode();
			
		}
	}


	/**
	 * Set time remaining for our current mode
	 * 
	 * @param {Number} timeLeft - decrements our time left & normalizes it for the UI
	 */
	setTimeLeft(timeLeft){

		// console.log(timeLeft + ' seconds left');
		this.timeLeft = timeLeft;
		this.timeLeftNormalised.value = timeLeft / this.settings.claimDuration.value;
	}


	/**
	 * Switch to the GET mode
	 */
	startGetMode(){
		
		// set our mode to GET to render the UI for Get mode
		this.mode.value = 'GET';

		// reset the number of claims available
		this.claimsLeft.value = this.settings.maxClaims.value;

		// reset the time for the fixed get duration
		const duration = this.settings.claimDuration.value;
		console.log('Starting timer for GET mode');
		console.log(duration + ' seconds on the clock!')
		this.setTimeLeft(duration);
	}


	/**
	 * IDLE mode... users cannot GET during this time
	 */
	startIdleMode(){

		// set our mode to IDLE to render the UI for Idle mode
		this.mode.value = 'IDLE';

		// cancel out claims
		this.claimsLeft.value = 0;

		// compute the interval (with possible randomness) for the next claim
		const interval = this.settings.claimInterval.value;
		const randomness = this.settings.claimRandomness.value;
		const randomSeconds = Math.floor(Math.random() * randomness);
		const duration = interval + randomSeconds;
		console.log('Starting timer for IDLE mode');
		console.log('Randomness: ' + randomSeconds + ' seconds');
		console.log(duration + ' seconds on the clock!')
		this.setTimeLeft(duration);

	}


}
