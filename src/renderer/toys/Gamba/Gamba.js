/*
	Gamba.js
	--------

	This class handles the state for the Gamba toy system.

	NOTE: it does not handle the rendering, which will be the Gamba widgets.
*/

// vue
import { ref, shallowRef, computed } from 'vue';
import { socketRef, socketShallowRef, socketShallowRefAsync, bindRef } from 'socket-ref';

// our app
import Toy from "../Toy";

// components
import GambaPage from './GambaPage.vue';
import DummyWidget from '../DummyWidget.vue';

// main export
export default class Gamba extends Toy {

	// static info
	static name = 'Gamba';
	static slug = 'gamba';
	static desc = 'Let viewers gamble their points.';
	static optionsPageComponent = GambaPage;
	static themeColor = '#458233';
	static widgetComponents = [
		{
			component: DummyWidget,
			key: 'widgetBox',
			allowResize: true,
			lockAspectRatio: false,
			description: 'Shows the current bet options.',
			slug: 'bet'
		},
		{
			component: DummyWidget,
			key: 'resultsWidgetBox',
			allowResize: true,
			lockAspectRatio: false,
			description: 'Shows the results after the bet ends.',
			slug: 'results'
		}
	];

	// define modes for the gamba state
	static MODE = {
		OFF: 'OFF',
		OPEN: 'OPEN',
		CLOSED: 'CLOSED',
		PAID: 'PAID'
	}


	/**
	 * Constructs the Gamba object
	 * 
	 * @param {ToyManager} toyManager - reference to the toy manager
	 */
	constructor(toyManager) {

		// call the parent constructor
		super(toyManager);

		// subscribe to the tick event
		electronAPI.tick(() => this.tick());

		// will keep one array of all bets
		this.betsPlaced = socketShallowRef(this.static.slugify('allBets'), []);
		this.timeToBet = socketShallowRef(this.static.slugify('timeToBet'), 0);
		this.bettingPool = socketShallowRef(this.static.slugify('bettingPool'), 0);
		this.optionStats = socketShallowRef(this.static.slugify('optionStats'), []);

		// get the command used for claiming points
		this.bettingPoolTotal = computed(() => {
			
			// get all the bets
			const bets = [...this.betsPlaced.value];

			// & return the total of all bets
			return bets.reduce((total, bet) => total + bet.points, 0);
		});

		// get the current stats for each option
		this.bettingOptionStats = computed(() => {

			// first get the unique options
			const options = [...this.settings.gambaOptions.value]
			.map((option) => { 
				return {
					text: option,
					total: 0,
					percentage: 0,
				}
			});

			// then get the bets
			const bets = [...this.betsPlaced.value];

			// map over the options and get the total for each option
			bets.map((bet) => {

				// add the points to the total for this option
				const option = options[bet.optionIndex]
				option.total += bet.points;
				option.percentage = (option.total / bettingPoolTotal.value) * 100;
			});

			return options
		});

		// bind the computed values to the sockets
		bindRef(this.bettingPoolTotal).to(this.bettingPool);
		bindRef(this.bettingOptionStats).to(this.optionStats);		
	}


	/**
	 * Initialize the settings for this toy
	 */
	initSettings() {

		// channel points settings
		this.buildSettingsBlock({

			gambaStateMode: shallowRef('OFF'),
			gambaPrompt: shallowRef('Streamer will beat the boss?'),
			gambaOptions: shallowRef(['Yes', 'No']),
			gambaBetTime: shallowRef(30),
			resultsWidgetBox: shallowRef({
				x: (1280 / 2) - (500 / 2),
				y: (720 / 2) - (600 / 2),
				width: 500,
				height: 600
			}),
			widgetBox: shallowRef({
				x: (1280 / 2) - (400 / 2),
				y: 720 - 220,
				width: 400,
				height: 200
			}),
		});
	}


	/**
	 * Initialize the commands for this toy
	 */
	buildCommands() {

		super.buildCommands([
			{
				command: 'bet',
				params: [
					{ name: 'amount', type: 'number', optional: false, desc: 'How many points to wage.' },
					{ name: 'option', type: 'string', optional: false, desc: 'Which option to gamble on' },
				],
				description: 'Gamble points on options set up by the Streamer',
			},
			{
				command: 'cancel_bet',
				description: 'Revokes bet before the game starts.',
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
		console.log('Gamba found', commandSlug, 'from', msg.author, 'with params', params);

		// handle when user places a bet
		if(commandSlug === 'bet') {

			this.doBet(commandSlug, msg, user, params, handshake);
			return;
		}

		// handle when user cancels a bet
		if(commandSlug === 'cancel_bet') {

			this.doCancel(commandSlug, msg, user, params, handshake);
			return;
		}
	}


	/**
	 * When user tries to place a bet
	 * 
	 * @param {String} commandSlug - the slug of the command
	 * @param {Object} msg - details about the chat message that invoked the command
	 * @param {Object} user - details about the user that invoked the command (could be dummy if not in database yet)
	 * @param {Array<String>} params - the parameters passed to the command
	 * @param {Object} handshake - object like { accept: Function, reject: Function } to accept or reject the command
	 */
	doBet(commandSlug, msg, user, params, handshake) {

		// check if we are in the right state
		if(this.settings.gambaStateMode.value !== Gamba.MODE.OPEN) {
			handshake.reject('Gamba is not open for betting');
			return;
		}

		// check if the user has enough points
		// first we have to see if the user has enough points to give
		const betUserData = window.ytctDB.getUser(msg.authorUniqueID);
		const betUserPoints = betUserData ? betUserData.points : 0;
		if(betUserPoints < params.amount) {
			handshake.reject(`${msg.author} does not have enough points to place this bet`);
			return;
		}

		// the option has to be a letter, a-z and we need to see iif
		// it matches a valid index in our total list of options
		let userOption = params.option.toLowerCase();
		if(userOption.length !== 1 || !userOption.match(/[a-z]/i)) {
			handshake.reject(`${msg.author} did not provide a valid option`);
			return;
		}

		// convert from a-z to 0-25
		const optionIndex = userOption.charCodeAt(0) - 'a'.charCodeAt(0);

		// check if the option is valid
		if(optionIndex < 0 || optionIndex >= this.settings.gambaOptions.value.length) {
			handshake.reject(`${msg.author} did not provide a valid option`);
			return;
		}

		// deduct the points from the user
		window.ytctDB.updateUser(msg.authorUniqueID, {
			relativePoints: -params.amount,
		});

		// add the bet to the bets placed array
		this.betsPlaced.value = [...this.betsPlaced.value, {
			userID: msg.authorUniqueID,	
			userData: betUserData,
			bet: params.option,
			optionIndex: optionIndex,
			points: params.amount,
		}];

		// accept the command which updates the database
		handshake.accept();
	}


	/**
	 * When user tries to place a bet
	 * 
	 * @param {String} commandSlug - the slug of the command
	 * @param {Object} msg - details about the chat message that invoked the command
	 * @param {Object} user - details about the user that invoked the command (could be dummy if not in database yet)
	 * @param {Array<String>} params - the parameters passed to the command
	 * @param {Object} handshake - object like { accept: Function, reject: Function } to accept or reject the command
	 */
	doCancel(commandSlug, msg, user, params, handshake){
		
		// check if we are in the right state
		if(this.settings.gambaStateMode.value !== Gamba.MODE.OPEN) {
			handshake.reject('Gamba is not open for canceling');
			return;
		}

		// refund this users bets
		this.cancelAndRefund(bet => bet.userID === msg.authorUniqueID);

		// accept the command which updates the database
		handshake.accept();
	}


	/**
	 * Cancels and refunds bets based on the filter function
	 * 
	 * @param {Function} filterFN - filter fn for which bets to refund
	 */
	cancelAndRefund(filterFN){

		// duplicate our list of bets so far
		const bets = [...this.betsPlaced.value];

		// filter the bets using the filter function
		const betsToRefund = bets.filter(filterFN);

		// refund the bets
		for(const bet of betsToRefund) {

			// refund the user
			window.ytctDB.updateUser(bet.userID, {
				relativePoints: bet.points,
			});
		}// next bet

		// remove the bets from our list
		this.betsPlaced.value = [...this.betsPlaced.value].filter(bet => {
			return !betsToRefund.includes(bet)
		});
	}


	/**
	 * Starts the round allowing bets to be placed
	 */
	startRound(){

		// start time on the clock
		this.timeToBet.value = this.settings.gambaBetTime.value;
		this.settings.gambaStateMode.value = Gamba.MODE.OPEN;
	}


	/**
	 * Closes the ability to bet, now we wait for the streamer to cancel or resolve the bets
	 */
	closeRound(){

		// closed
		this.settings.gambaStateMode.value = Gamba.MODE.CLOSED;
	}


	/**
	 * Cancels and refunds all bets so far
	 */
	cancelRound(){

		// refund all bets
		this.cancelAndRefund(() => true);

		// cancel the round
		this.settings.gambaStateMode.value = Gamba.MODE.OFF;
	}
	

	/**
	 * Resolves the round and pays out the winners
	 * 
	 * @param {Number} option - which option index was picked as the winner
	 */
	resolveRound(option){

		
	}


	/**
	 * Handles count down when betting is open!
	 */
	tick(){

		// if we're not collecting bets, nothing to do here
		if(this.settings.gambaStateMode.value !== Gamba.MODE.OPEN)
			return;

		// decrement the time to bet
		this.timeToBet.value = this.timeToBet.value - 1;

		// if time is up, close the bet
		if(this.timeToBet.value <= 0) {

			// close the bets
			this.closeRound();

			// reset the time to bet
			this.timeToBet.value = this.settings.gambaBetTime.value;
		}		
	}

}
