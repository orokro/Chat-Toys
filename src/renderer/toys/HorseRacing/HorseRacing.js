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

	/**
	 * Bonus points awarded to a horse the instant it crosses the finish line,
	 * indexed by finish position (0 = 1st, 1 = 2nd, 2 = 3rd).
	 *
	 * Because points double as the horse's distance down the track, a sort by
	 * points alone can put a horse that crossed second above the horse that
	 * actually crossed first (e.g. they grabbed a 99-value apple on their last
	 * tick). Stacking a finish bonus that dwarfs anything reachable from a
	 * single apple keeps the points-sort and the true podium in agreement
	 * without having to change how the widget renders progress.
	 */
	static FINISH_BONUSES = [100000, 70000, 50000];

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

		// Summary of how the betting pool resolved, so the widget's PAYOUT
		// overlay can show "$X paid to N winners" or "no winning bets - all
		// points go to the house" instead of a generic "paying out winners"
		// message that lies when nobody won.
		this.payoutInfo = socketShallowRef(this.static.slugify('payoutInfo'), {
			hasWinningBets: false,
			winnerCount: 0,
			totalPool: 0
		});

		// because the CSS in the widget resolves paths differently, we gotta make the path more explicit when live
		const fixPathForLive = (path) => {
			return window.env.isDev ? path : `/live/${path}`;
		}

		// path to the background image for the track
		this.bgImagePath = socketShallowRef(
			this.static.slugify('bgImagePath'), 
			fixPathForLive('assets/horse_racing/track.png'));

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

		// Sanitize - chat-sourced params are usually numbers already, but be
		// defensive in case a future code path delivers a string.
		const eatNumber = Number(params.number);
		const appleIndex = this.apples.value.findIndex(a => a.number === eatNumber);
		if (appleIndex === -1) {
			handshake.reject('Apple not found');
			return;
		}

		const apple = this.apples.value[appleIndex];

		// Update racer points
		const updatedPlayers = [...this.players.value];
		const pIdx = updatedPlayers.findIndex(p => p.userID === racer.userID);
		updatedPlayers[pIdx].points += apple.value;

		// Did this apple push the racer across the finish line for the first time?
		const justFinished = updatedPlayers[pIdx].points >= this.settings.raceLength.value
			&& !this.finishedList.value.find(f => f.userID === racer.userID);

		// Stack the finish bonus before re-publishing the players list so the
		// podium sort in endRace lines up with actual finish order. See the
		// note on HorseRacing.FINISH_BONUSES.
		if (justFinished) {
			const finishPosition = this.finishedList.value.length; // 0 = 1st, 1 = 2nd, 2 = 3rd
			const bonus = HorseRacing.FINISH_BONUSES[finishPosition] ?? 0;
			updatedPlayers[pIdx].points += bonus;
		}

		this.players.value = updatedPlayers;

		if (justFinished) {
			this.finishedList.value = [...this.finishedList.value, {
				userID: racer.userID,
				username: racer.username,
				time: Date.now()
			}];
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
		const totalPool = this.bets.value.reduce((sum, b) => sum + b.amount, 0);
		const winningBets = winner
			? this.bets.value.filter(b => b.targetID === winner.userID)
			: [];
		const totalWinningBets = winningBets.reduce((sum, b) => sum + b.amount, 0);

		if (totalWinningBets > 0) {
			for (const bet of winningBets) {
				const share = bet.amount / totalWinningBets;
				const payout = Math.floor(share * totalPool);
				window.ytctDB.updateUser(bet.bettorID, { relativePoints: payout });
				this.chatToysApp.log.info(`${bet.bettorName} won ${payout} points betting on ${winner.username}!`);
			}
		} else if (totalPool > 0) {
			// Nobody backed the actual winner - the pool stays with the house.
			this.chatToysApp.log.info(`No winning bets - ${totalPool} points go to the house.`);
		}

		// Tell the widget how to label the PAYOUT overlay.
		this.payoutInfo.value = {
			hasWinningBets: totalWinningBets > 0,
			winnerCount: winningBets.length,
			totalPool: totalPool
		};

		window.setElectronTimeout(() => this.resetGame(), 10000);
	}

	/**
	 * Force-finish a race that's stuck in GAME state by transitioning straight
	 * into RESULTS using whatever points the racers have right now. The
	 * settings page exposes this so the streamer has an escape hatch when
	 * racers refuse to keep playing - otherwise the race never ends.
	 */
	forceEndRace() {
		if (this.gameState.value !== HorseRacing.STATES.GAME) return;
		this.endRace();
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
		this.payoutInfo.value = { hasWinningBets: false, winnerCount: 0, totalPool: 0 };
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
