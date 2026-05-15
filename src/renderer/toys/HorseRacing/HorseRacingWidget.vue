<!--
	HorseRacingWidget.vue
	---------------------

	The visual component for the horse racing track.
-->
<template>
	<div class="horseRacingWidget" v-if="ready">
		<!-- Track Background -->
		<div class="track-bg" :style="{ backgroundImage: `url(${bgImagePath})` }">
			
			<!-- Lanes and Horses -->
			<div class="lanes-container">
				<div v-for="lane in 8" :key="lane" class="lane" :style="getLaneStyle(lane - 1)">
					<Horse 
						v-if="getPlayerInLane(lane - 1)"
						v-bind="getPlayerInLane(lane - 1)"
						:raceLength="socketSettingsRef.raceLength"
					/>
				</div>
			</div>

			<!-- Apples -->
			<div v-for="apple in apples" :key="apple.id" class="apple" :style="{ left: apple.x + '%', top: apple.y + '%' }">
				<img src="/assets/horse_racing/apple.png" class="apple-img" />
				<div class="apple-label">!eat {{ apple.number }}</div>
			</div>

			<!-- Finish Notifications -->
			<div class="finish-notifications">
				<transition-group name="notif">
					<div v-for="n in notifications" :key="n.id" class="notif-item" :class="'rank-' + n.rank">
						{{ n.text }}
					</div>
				</transition-group>
			</div>

			<!-- UI Overlays -->
			<div class="overlay" v-if="gameState !== 'IDLE' && gameState !== 'GAME'">
				<div class="overlay-content">
					<template v-if="gameState === 'LOBBY'">
						<h2>Joining Race...</h2>
						<div class="timer">{{ timer }}s</div>
						<div class="msg">Type !joinrace to play!</div>
						<div class="players-count">{{ players.length }} / 8 Players</div>
					</template>

					<template v-if="gameState === 'NOT_ENOUGH_PLAYERS'">
						<h2>Not enough players!</h2>
						<div class="msg">Need at least 2 racers. Returning to idle...</div>
					</template>

					<template v-if="gameState === 'BET'">
						<h2>Place Your Bets!</h2>
						<div class="timer">{{ timer }}s</div>
						<div class="msg">!horsebet &lt;amount&gt; @username</div>
						<div class="bets-info">{{ bets.length }} bets placed</div>
					</template>

					<template v-if="gameState === 'PRERACE'">
						<h2>Get Ready!</h2>
						<div class="msg">Collect apples to gain points!</div>
					</template>

					<template v-if="gameState === 'RESULTS'">
						<h2>Race Results!</h2>
						<div class="winners-list">
							<div v-for="(winner, index) in winners" :key="winner.userID" class="winner-item">
								<span class="rank">{{ ordinal(index + 1) }}:</span>
								<span class="name">{{ winner.username }}</span>
							</div>
						</div>
					</template>

					<template v-if="gameState === 'PAYOUT'">
						<template v-if="payoutInfo.hasWinningBets">
							<h2>Paying out winners!</h2>
							<div class="msg">
								{{ payoutInfo.winnerCount }} winning bet{{ payoutInfo.winnerCount === 1 ? '' : 's' }}
								splitting ₱ {{ payoutInfo.totalPool }}
							</div>
						</template>
						<template v-else>
							<h2>No winning bets!</h2>
							<div class="msg">All bets go to the house.</div>
						</template>
					</template>
				</div>
			</div>

			<!-- Idle Message -->
			<div class="idle-msg" v-if="gameState === 'IDLE'">
				Type !joinrace to play!
			</div>
		</div>
	</div>
</template>

<script setup>
import { ref, watch, computed, inject } from 'vue';
import { socketShallowRefReadOnly } from 'socket-ref';
import { useToySettings } from '@toys/useToySettings';
import { keepAliveSocket } from '../keepAliveSocket.js';
import Horse from './Horse.vue';

const thisSlug = 'horseRacing';
const widgetSlug = 'track';
const slugify = (text) => thisSlug + '__' + text.toLowerCase();

// keep alive the socket
keepAliveSocket(thisSlug, widgetSlug);

const emit = defineEmits(['boxChange']);

// gets our settings
const ready = ref(false);
const socketSettingsRef = useToySettings('horse-racing', 'widgetBox', emit, () => {
	ready.value = true;
});

// Gets live sockets
const gameState = socketShallowRefReadOnly(slugify('gameState'), 'IDLE');
const players = socketShallowRefReadOnly(slugify('players'), []);
const bets = socketShallowRefReadOnly(slugify('bets'), []);
const apples = socketShallowRefReadOnly(slugify('apples'), []);
const timer = socketShallowRefReadOnly(slugify('timer'), 0);
const winners = socketShallowRefReadOnly(slugify('winners'), []);
const finishedList = socketShallowRefReadOnly(slugify('finishedList'), []);
const bgImagePath = socketShallowRefReadOnly(slugify('bgImagePath'), '');
const payoutInfo = socketShallowRefReadOnly(slugify('payoutInfo'), {
	hasWinningBets: false,
	winnerCount: 0,
	totalPool: 0
});

/**
 * Format a 1-based rank as an English ordinal string (1 -> "1st", 2 -> "2nd", ...).
 * @param {number} n
 * @returns {string}
 */
function ordinal(n) {
	const suffixes = ['th', 'st', 'nd', 'rd'];
	const v = n % 100;
	return n + (suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0]);
}

// Notifications for when a horse finishes
const notifications = ref([]);
watch(() => finishedList.value.length, (newLen, oldLen) => {
	if (newLen > (oldLen || 0)) {
		const latest = finishedList.value[newLen - 1];
		const rankText = newLen === 1 ? 'FIRST' : newLen === 2 ? 'SECOND' : 'THIRD';
		const id = Date.now();
		notifications.value.push({
			id,
			text: `@${latest.username} finished ${rankText}!`,
			rank: newLen
		});

		// Remove notification after 4 seconds
		setTimeout(() => {
			notifications.value = notifications.value.filter(n => n.id !== id);
		}, 4000);
	}
});

const getPlayerInLane = (laneIndex) => {
	const player = players.value.find(p => p.lane === laneIndex);
	if (!player) return null;

	// Determine rank if in finishedList
	const finishIndex = finishedList.value.findIndex(f => f.userID === player.userID);
	const rank = finishIndex !== -1 ? finishIndex + 1 : 0;

	return {
		...player,
		rank
	};
};

const getLaneStyle = (index) => {
	// Native aspect ratio of track.png should be respected.
	// We divide the vertical space into 8 lanes.
	// Perspective slant: each lane slightly shifted right as we go down? 
	// Or maybe just centered.
	const top = 10 + (index * 11); // Simple vertical distribution
	return {
		top: top + '%',
		left: '5%',
		width: '90%',
		height: '10%'
	};
};
</script>

<style lang="scss" scoped>
.horseRacingWidget {
	width: 100%;
	height: 100%;
	position: relative;
	overflow: hidden;
}

.track-bg {
	width: 100%;
	height: 100%;
	background-size: 100% 100%;
	background-repeat: no-repeat;
	position: relative;
}

.lanes-container {
	position: absolute;
	inset: 0;
}

.lane {
	position: absolute;
	/* border-bottom: 1px dashed rgba(255, 255, 255, 0.2); */
}

.apple {
	position: absolute;
	width: 60px;
	height: 60px;
	transform: translate(-50%, -50%);
	display: flex;
	flex-direction: column;
	align-items: center;
	z-index: 20;
}

.apple-img {
	width: 40px;
	height: 40px;
}

.apple-label {
	background: rgba(255, 0, 0, 0.8);
	color: white;
	padding: 2px 6px;
	border-radius: 10px;
	font-size: 14px;
	font-weight: bold;
	white-space: nowrap;
}

.overlay {
	position: absolute;
	inset: 0;
	background: rgba(0, 0, 0, 0.6);
	display: flex;
	justify-content: center;
	align-items: center;
	z-index: 100;
	color: white;
	text-align: center;

	.overlay-content {
		padding: 40px;
		background: rgba(0, 0, 0, 0.8);
		border: 4px solid #5D4037;
		border-radius: 20px;
		box-shadow: 0 0 20px rgba(0, 0, 0, 0.5);
	}

	h2 {
		font-size: 32px;
		margin-bottom: 20px;
		color: #EED43A;
	}

	.timer {
		font-size: 48px;
		font-weight: bold;
		margin-bottom: 10px;
	}

	.msg {
		font-size: 20px;
		margin-bottom: 10px;
	}

	.players-count, .bets-info {
		font-size: 18px;
		font-style: italic;
	}

	.winners-list {
		display: flex;
		flex-direction: column;
		gap: 10px;
		margin-top: 20px;

		.winner-item {
			font-size: 24px;
			.rank { color: #EED43A; font-weight: bold; margin-right: 10px; }
		}
	}
}

.idle-msg {
	position: absolute;
	bottom: 20px;
	left: 50%;
	transform: translateX(-50%);
	background: rgba(0, 0, 0, 0.7);
	color: white;
	padding: 10px 20px;
	border-radius: 20px;
	font-size: 24px;
	font-weight: bold;
}

.finish-notifications {
	position: absolute;
	top: 20px;
	left: 50%;
	transform: translateX(-50%);
	display: flex;
	flex-direction: column;
	gap: 10px;
	align-items: center;
	z-index: 200;
	pointer-events: none;

	.notif-item {
		background: rgba(0, 0, 0, 0.8);
		color: white;
		padding: 10px 20px;
		border-radius: 10px;
		font-size: 24px;
		font-weight: bold;
		border: 2px solid white;
		box-shadow: 0 4px 10px rgba(0, 0, 0, 0.5);
		text-shadow: 2px 2px 0px black;

		&.rank-1 { background: #FFD700; color: black; border-color: #B8860B; text-shadow: none; }
		&.rank-2 { background: #C0C0C0; color: black; border-color: #808080; text-shadow: none; }
		&.rank-3 { background: #CD7F32; color: white; border-color: #8B4513; }
	}
}

// Notifications transition
.notif-enter-active, .notif-leave-active {
	transition: all 0.5s ease;
}
.notif-enter-from {
	opacity: 0;
	transform: translateY(-20px);
}
.notif-leave-to {
	opacity: 0;
	transform: scale(0.8);
}
</style>
