<!--
	Horse.vue
	---------

	A component representing a single horse in the race.
-->
<template>
	<div class="horse-container" :style="{ left: progress + '%' }" :class="rankClass">
		<div class="horse-visual">
			
			<!-- Medal Overlay -->
			<div v-if="rank > 0" class="medal-overlay">
				{{ medalIcon }}
			</div>

			<!-- Horse Overlay -->
			<img src="/assets/horse_racing/horse_avatar.png" class="horse-img" />

			<!-- User Avatar (behind) -->
			<div class="user-avatar-circle">
				<img :src="pfpUrl || defaultPfp" class="avatar-img" />
			</div>

		</div>
		<div class="user-name">{{ username }}</div>
	</div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
	username: String,
	pfpUrl: String,
	points: Number,
	raceLength: Number,
	rank: {
		type: Number,
		default: 0 // 0 means not yet finished/ranked
	}
});

const defaultPfp = 'assets/icons/chat.png';

const progress = computed(() => {
	const p = (props.points / props.raceLength) * 100;
	return Math.min(Math.max(p, 0), 100);
});

const rankClass = computed(() => {
	if (props.rank === 1) return 'rank-first';
	if (props.rank === 2) return 'rank-second';
	if (props.rank === 3) return 'rank-third';
	return '';
});

const medalIcon = computed(() => {
	if (props.rank === 1) return '🥇';
	if (props.rank === 2) return '🥈';
	if (props.rank === 3) return '🥉';
	return '';
});
</script>

<style lang="scss" scoped>
.horse-container {
	position: absolute;
	top: 50%;
	transform: translate(-50%, -50%);
	transition: left 0.5s ease-out;
	display: flex;
	flex-direction: column;
	align-items: center;
	z-index: 10;

	&.rank-first { z-index: 15; }
}

.horse-visual {
	position: relative;
	width: 80px;
	height: 80px;
}

.medal-overlay {
	position: absolute;
	top: -10px;
	right: -10px;
	font-size: 24px;
	z-index: 5;
	filter: drop-shadow(0 0 2px black);
}

.user-avatar-circle {
	position: absolute;
	top: 15px;
	left: 45px;
	transform: translate(-50%, -50%);
	width: 30px;
	height: 30px;
	border-radius: 50%;
	overflow: hidden;
	background: #ccc;
	// border: 2px solid white;
	border: 2px solid black;
}

.avatar-img {
	width: 100%;
	height: 100%;
	object-fit: cover;
	z-index: 2;
	
}

.horse-img {
	position: absolute;
	top: 0;
	left: 0;
	width: 80px;
	height: 80px;
	
}

.user-name {
	background: rgba(0, 0, 0, 0.7);
	color: white;
	padding: 2px 8px;
	border-radius: 10px;
	font-size: 12px;
	font-weight: bold;
	margin-top: 4px;
	white-space: nowrap;
	position: relative;
	top: -20px;
	transition: background 0.3s, color 0.3s;
}

// Winner Styles
.rank-first .user-name {
	background: #FFD700; // Gold
	color: #000;
	border: 1px solid #B8860B;
}

.rank-second .user-name {
	background: #C0C0C0; // Silver
	color: #000;
	border: 1px solid #808080;
}

.rank-third .user-name {
	background: #CD7F32; // Bronze
	color: #fff;
	border: 1px solid #8B4513;
}
</style>
