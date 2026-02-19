/*
	HorseRacing.js
	--------------

	This class handles the logic for the Horse Racing toy system.
*/

import { ref, shallowRef, watch, computed } from 'vue';
import { socketShallowRef, bindRef } from 'socket-ref';
// our app
import Toy from "../Toy";

// components
import HorseRacingPage from './HorseRacingPage.vue';
import HorseRacingWidget from './HorseRacingWidget.vue';

export default class HorseRacing extends Toy {

	static name = 'Horse Racing';
	static slug = 'horseRacing';
	static desc = 'A competitive horse racing game for chatters.';
	static optionsPageComponent = HorseRacingPage;
	static themeColor = '#5D4037';
	static widgetComponents = [
		{
			component: HorseRacingWidget,
			key: 'widgetBox',
			allowResize: true,
			lockAspectRatio: true,
			description: 'The horse racing track',
			slug: 'track'
		}
	];

	static STATES = {
		IDLE: 'IDLE',
		LOBBY: 'LOBBY',
		NOT_ENOUGH_PLAYERS: 'NOT_ENOUGH_PLAYERS',
		BET: 'BET',
		PRERACE: 'PRERACE',
		GAME: 'GAME',
		RESULTS: 'RESULTS',
		PAYOUT: 'PAYOUT'
	};

	constructor(toyManager) {
		super(toyManager);

		// Socket states
		this.gameState = socketShallowRef(this.static.slugify('gameState'), HorseRacing.STATES.IDLE);
		this.players = socketShallowRef(this.static.slugify('players'), []);
		this.bets = socketShallowRef(this.static.slugify('bets'), []);
		this.apples = socketShallowRef(this.static.slugify('apples'), []);
		this.timer = socketShallowRef(this.static.slugify('timer'), 0);
		this.winners = socketShallowRef(this.static.slugify('winners'), []);
		this.finishedList = socketShallowRef(this.static.slugify('finishedList'), []); // Order of finishing

		// Internal state
		this.stateTimer = null;
		this.appleTimer = null;
	}

	initSettings() {
		this.buildSettingsBlock({
			timeToJoin: ref(30),
			appleFrequency: ref(30),
			raceLength: ref(1000),
			allowBetting: ref(true),
			betTime: ref(30),
			payout1st: ref(5000),
			payout2nd: ref(3500),
			payout3rd: ref(2000),
			widgetBox: shallowRef({
				x: 0,
				y: 0,
				width: 800,
				height: 450
			})
		});
	}

	buildCommands() {
		super.buildCommands([
			{
				command: 'joinrace',
				description: 'Join the current horse race',
				userDesc: 'Join the race!',
				costEnabled: true,
			},
			{
				command: 'horsebet',
				params: [
					{ name: 'amount', type: 'number', optional: false, desc: 'Amount to bet' },
					{ name: 'user', type: 'username', optional: false, desc: 'The racer to bet on' },
				],
				description: 'Bet on a racer',
				userDesc: 'Place your bets!',
				costEnabled: true,
			},
			{
				command: 'eat',
				params: [
					{ name: 'number', type: 'number', optional: false, desc: 'The number on the apple' },
				],
				description: 'Eat an apple to gain points',
				userDesc: 'Eat!',
				costEnabled: true,
			}
		]);
	}

	onCommand(commandSlug, msg, user, params, handshake) {
		const state = this.gameState.value;

		if (commandSlug === 'joinrace') {
			this.handleJoinRace(msg, user, handshake);
		} else if (commandSlug === 'horsebet') {
			this.handleHorseBet(msg, user, params, handshake);
		} else if (commandSlug === 'eat') {
			this.handleEat(msg, user, params, handshake);
		} else {
			handshake.reject('Invalid command');
		}
	}

	handleJoinRace(msg, user, handshake) {
		const state = this.gameState.value;
		if (state !== HorseRacing.STATES.IDLE && state !== HorseRacing.STATES.LOBBY) {
			handshake.reject('Cannot join race at this time');
			return;
		}

		if (this.players.value.length >= 8) {
			handshake.reject('Race is full');
			return;
		}

		if (this.players.value.find(p => p.userID === msg.authorUniqueID)) {
			handshake.reject('You are already in the race');
			return;
		}

		const newPlayer = {
			userID: msg.authorUniqueID,
			username: msg.author,
			pfpUrl: msg.authorPFPUrl,
			points: 0,
			lane: this.players.value.length
		};

		this.players.value = [...this.players.value, newPlayer];
		handshake.accept();

		if (state === HorseRacing.STATES.IDLE) {
			this.startLobby();
		} else if (this.players.value.length === 8) {
			this.startBettingOrPreRace();
		}
	}

	handleHorseBet(msg, user, params, handshake) {
		if (this.gameState.value !== HorseRacing.STATES.BET) {
			handshake.reject('Betting is not open');
			return;
		}

		if (!this.settings.allowBetting.value) {
			handshake.reject('Betting is disabled for this race');
			return;
		}

		if (this.players.value.find(p => p.userID === msg.authorUniqueID)) {
			handshake.reject('Racers cannot bet');
			return;
		}

		const amount = Math.floor(params.amount);
		if (amount <= 0) {
			handshake.reject('Invalid bet amount');
			return;
		}

		const bettorData = window.ytctDB.getUser(msg.authorUniqueID);
		const bettorPoints = bettorData ? bettorData.points : 0;
		if (bettorPoints < amount) {
			handshake.reject('Not enough points');
			return;
		}

		const targetRacer = this.players.value.find(p => p.username.toLowerCase() === params.user.toLowerCase());
		if (!targetRacer) {
			handshake.reject('User is not in the race');
			return;
		}

		// Deduct points
		window.ytctDB.updateUser(msg.authorUniqueID, { relativePoints: -amount });

		this.bets.value = [...this.bets.value, {
			bettorID: msg.authorUniqueID,
			bettorName: msg.author,
			targetID: targetRacer.userID,
			amount: amount
		}];

		handshake.accept();
	}

	handleEat(msg, user, params, handshake) {
		if (this.gameState.value !== HorseRacing.STATES.GAME) {
			handshake.reject('Not currently racing');
			return;
		}

		const racer = this.players.value.find(p => p.userID === msg.authorUniqueID);
		if (!racer) {
			handshake.reject('You are not in the race');
			return;
		}

		// check if the racer has already finished
		if (racer.points >= this.settings.raceLength.value) {
			handshake.reject('You have already finished the race!');
			return;
		}

		const appleIndex = this.apples.value.findIndex(a => a.number === params.number);
		if (appleIndex === -1) {
			handshake.reject('Apple not found');
			return;
		}

		const apple = this.apples.value[appleIndex];
		
		// Update racer points
		const updatedPlayers = [...this.players.value];
		const pIdx = updatedPlayers.findIndex(p => p.userID === racer.userID);
		updatedPlayers[pIdx].points += apple.value;
		this.players.value = updatedPlayers;

		// Check if this horse just finished
		if (updatedPlayers[pIdx].points >= this.settings.raceLength.value) {
			if (!this.finishedList.value.find(f => f.userID === racer.userID)) {
				this.finishedList.value = [...this.finishedList.value, {
					userID: racer.userID,
					username: racer.username,
					time: Date.now()
				}];
			}
		}

		// Remove apple
		const updatedApples = [...this.apples.value];
		updatedApples.splice(appleIndex, 1);
		this.apples.value = updatedApples;

		handshake.accept();

		this.checkRaceEnd();
	}

	startLobby() {
		this.gameState.value = HorseRacing.STATES.LOBBY;
		this.startTimer(this.settings.timeToJoin.value, () => {
			if (this.players.value.length < 2) {
				this.gameState.value = HorseRacing.STATES.NOT_ENOUGH_PLAYERS;
				window.setElectronTimeout(() => this.resetGame(), 5000);
			} else {
				this.startBettingOrPreRace();
			}
		});
	}

	startBettingOrPreRace() {
		this.stopTimer();
		if (this.settings.allowBetting.value) {
			this.gameState.value = HorseRacing.STATES.BET;
			this.startTimer(this.settings.betTime.value, () => this.startPreRace());
		} else {
			this.startPreRace();
		}
	}

	startPreRace() {
		this.stopTimer();
		this.gameState.value = HorseRacing.STATES.PRERACE;
		window.setElectronTimeout(() => this.startGame(), 5000);
	}

	startGame() {
		this.gameState.value = HorseRacing.STATES.GAME;
		this.spawnApples();
		this.appleTimer = window.setElectronInterval(() => this.spawnApples(), this.settings.appleFrequency.value * 1000);
	}

	spawnApples() {
		if (this.gameState.value !== HorseRacing.STATES.GAME) return;
		
		const newApples = [];
		const usedNumbers = new Set();
		
		for (let i = 0; i < 3; i++) {
			let num;
			do {
				num = Math.floor(Math.random() * 90) + 10;
			} while (usedNumbers.has(num));
			usedNumbers.add(num);

			newApples.push({
				id: Math.random().toString(36).substr(2, 9),
				number: num,
				value: num, // Points given
				x: Math.random() * 80 + 10,
				y: Math.random() * 80 + 10
			});
		}
		this.apples.value = newApples;
	}

	checkRaceEnd() {
		const finished = this.players.value.filter(p => p.points >= this.settings.raceLength.value);
		if (finished.length >= 3 || (this.players.value.length < 3 && finished.length === this.players.value.length)) {
			this.endRace();
		}
	}

	endRace() {
		window.clearElectronInterval(this.appleTimer);
		this.apples.value = [];
		this.gameState.value = HorseRacing.STATES.RESULTS;

		const sorted = [...this.players.value].sort((a, b) => b.points - a.points);
		this.winners.value = sorted.slice(0, 3);

		// Reward the top racers
		if (this.winners.value[0]) {
			window.ytctDB.updateUser(this.winners.value[0].userID, { relativePoints: this.settings.payout1st.value });
			this.chatToysApp.log.info(`${this.winners.value[0].username} won the race and earned ₱ ${this.settings.payout1st.value}!`);
		}
		if (this.winners.value[1]) {
			window.ytctDB.updateUser(this.winners.value[1].userID, { relativePoints: this.settings.payout2nd.value });
			this.chatToysApp.log.info(`${this.winners.value[1].username} came in 2nd and earned ₱ ${this.settings.payout2nd.value}!`);
		}
		if (this.winners.value[2]) {
			window.ytctDB.updateUser(this.winners.value[2].userID, { relativePoints: this.settings.payout3rd.value });
			this.chatToysApp.log.info(`${this.winners.value[2].username} came in 3rd and earned ₱ ${this.settings.payout3rd.value}!`);
		}

		window.setElectronTimeout(() => {
			if (this.settings.allowBetting.value && this.bets.value.length > 0) {
				this.payoutBets();
			} else {
				this.resetGame();
			}
		}, 10000);
	}

	payoutBets() {
		this.gameState.value = HorseRacing.STATES.PAYOUT;
		const winner = this.winners.value[0];
		
		if (winner) {
			const winningBets = this.bets.value.filter(b => b.targetID === winner.userID);
			const totalPool = this.bets.value.reduce((sum, b) => sum + b.amount, 0);
			const totalWinningBets = winningBets.reduce((sum, b) => sum + b.amount, 0);

			if (totalWinningBets > 0) {
				for (const bet of winningBets) {
					const share = bet.amount / totalWinningBets;
					const payout = Math.floor(share * totalPool);
					window.ytctDB.updateUser(bet.bettorID, { relativePoints: payout });
					this.chatToysApp.log.info(`${bet.bettorName} won ${payout} points betting on ${winner.username}!`);
				}
			}
		}

		window.setElectronTimeout(() => this.resetGame(), 10000);
	}

	resetGame() {
		this.stopTimer();
		window.clearElectronInterval(this.appleTimer);

		// Refund bets if race was interrupted
		if (this.gameState.value !== HorseRacing.STATES.RESULTS && this.gameState.value !== HorseRacing.STATES.PAYOUT) {
			for (const bet of this.bets.value) {
				window.ytctDB.updateUser(bet.bettorID, { relativePoints: bet.amount });
			}
		}

		this.gameState.value = HorseRacing.STATES.IDLE;
		this.players.value = [];
		this.bets.value = [];
		this.apples.value = [];
		this.timer.value = 0;
		this.winners.value = [];
		this.finishedList.value = [];
	}

	startTimer(seconds, callback) {
		this.stopTimer();
		this.timer.value = seconds;
		this.stateTimer = window.setElectronInterval(() => {
			this.timer.value--;
			if (this.timer.value <= 0) {
				this.stopTimer();
				if (callback) callback();
			}
		}, 1000);
	}

	stopTimer() {
		if (this.stateTimer) {
			window.clearElectronInterval(this.stateTimer);
			this.stateTimer = null;
		}
	}

	end() {
		super.end();
		this.resetGame();
	}
}
