<!--
	Horse.vue
	---------

	A component representing a single horse in the race.
-->
<template>
	<div class="horse-container" :style="{ left: progress + '%' }">
		<div class="horse-visual">
			
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
	raceLength: Number
});

const defaultPfp = 'assets/icons/chat.png';

const progress = computed(() => {
	const p = (props.points / props.raceLength) * 100;
	return Math.min(Math.max(p, 0), 100);
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
}

.horse-visual {
	position: relative;
	width: 80px;
	height: 80px;
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
	padding: 2px 6px;
	border-radius: 10px;
	font-size: 12px;
	font-weight: bold;
	margin-top: 4px;
	white-space: nowrap;
	position: relative;
	top: -20px;
}
</style>
