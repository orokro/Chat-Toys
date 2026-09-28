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
				<img
					:src="avatarSrc"
					referrerpolicy="no-referrer"
					class="avatar-img"
					@error="onAvatarError"
				/>
			</div>

		</div>
		<div class="user-name">{{ username }}</div>
	</div>
</template>

<script setup>
import { computed, ref, watch } from 'vue';

// same avatar cache the chat widget uses (IndexedDB, per-origin - so avatars
// chat has already shown are reused here instead of re-fetched)
import { getPfpSource } from '../Chat/sub_components/pfpCache';

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


/*
	Avatar loading. This used to be a bare <img :src="pfpUrl">, which broke
	for some (mostly YouTube) users while the same avatar showed fine in chat:
	  - it sent the localhost widget page as the Referer, which YouTube's avatar
	    CDN sometimes rejects (every other remote image in the app already uses
	    referrerpolicy="no-referrer");
	  - it always hit the network, while chat usually shows a cached copy;
	  - the default avatar only covered an EMPTY url, not one that failed.
	Now: no referrer, reuse chat's cache, and fall back to the default on error.
*/
const avatarSrc = ref(props.pfpUrl || defaultPfp);
let avatarLoadId = 0;

async function loadAvatar() {
	const url = props.pfpUrl;
	const loadId = ++avatarLoadId;

	if (!url) {
		avatarSrc.value = defaultPfp;
		return;
	}

	// show the raw URL right away, then swap to the cached copy if there is one
	avatarSrc.value = url;
	try {
		const result = await getPfpSource(url, { cacheEnabled: true });
		if (loadId === avatarLoadId && result.src)
			avatarSrc.value = result.src;
	} catch (_) {
		/* keep the raw URL */
	}
}

function onAvatarError() {
	if (avatarSrc.value !== defaultPfp)
		avatarSrc.value = defaultPfp;
}

watch(() => props.pfpUrl, loadAvatar, { immediate: true });

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
