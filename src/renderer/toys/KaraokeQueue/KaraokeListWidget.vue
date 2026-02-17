<template>
	<div 
		v-if="ready" 
		class="karaokeListWidget"
		:style="{
			'--fontSize': (socketSettingsRef?.fontSize || 24) + 'px',
			'--fontColor': socketSettingsRef?.fontColor || '#FFFFFF',
			'--playedColor': socketSettingsRef?.playedSongsColor || '#888888',
		}"
		:class="{ 'hasShadow': socketSettingsRef?.fontShadow }"
	>
		<!-- Approved/Active List -->
		<div class="listSection approved">
			<div 
				v-for="song in filteredApproved" 
				:key="song.id" 
				class="songEntry"
				:class="{ 'isPlayed': isPlayed(song) }"
			>
				<span class="requester" v-if="socketSettingsRef?.showRequesterName && song.requestedBy !== 'Streamer'">[{{ song.requestedBy }}] </span>
				<span class="title">{{ song.title }}</span>
			</div>
		</div>

		<!-- Pending Summary or List -->
		<div class="listSection pending" v-if="pendingRequests.length > 0">
			<!-- Full List -->
			<template v-if="socketSettingsRef?.showPendingList">
				<div v-for="song in pendingRequests" :key="song.id" class="songEntry pendingEntry">
					<span class="status">[PENDING]</span>
					<span class="title">{{ song.title }}</span>
				</div>
			</template>
			<!-- Summary Count -->
			<template v-else-if="socketSettingsRef?.showPendingCount">
				<div class="pendingSummary">
					{{ pendingRequests.length }} Songs Pending...
				</div>
			</template>
		</div>
	</div>
</template>

<script setup>
import { ref, computed, inject } from 'vue';
import { socketShallowRefReadOnly } from 'socket-ref';
import { useToySettings } from '@toys/useToySettings';
import { keepAliveSocket } from '../keepAliveSocket.js';

const thisSlug = 'karaokeQueue';
const widgetSlug = 'list';
const slugify = (text) => thisSlug + '__' + text.toLowerCase();

keepAliveSocket(thisSlug, widgetSlug);

const emit = defineEmits(['boxChange']);
const ready = ref(false);
const socketSettingsRef = useToySettings(thisSlug, 'listWidgetBox', emit, () => {
	ready.value = true;
});

// Live state
const pendingRequests = socketShallowRefReadOnly(slugify('pendingRequests'), []);
const approvedRequests = socketShallowRefReadOnly(slugify('approvedRequests'), []);
const playedSongs = socketShallowRefReadOnly(slugify('playedSongs'), []);

const filteredApproved = computed(() => {
	if (socketSettingsRef.value?.hidePlayedSongs) {
		return approvedRequests.value.filter(s => !isPlayed(s));
	}
	return approvedRequests.value;
});

function isPlayed(song) {
	return playedSongs.value.some(s => s.videoId === song.videoId);
}
</script>

<style lang="scss" scoped>
.karaokeListWidget {
	width: 100%;
	height: 100%;
	font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
	color: var(--fontColor);
	font-size: var(--fontSize);
	line-height: 1.2;
	overflow: hidden;

	&.hasShadow {
		text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8);
	}

	.listSection {
		display: flex;
		flex-direction: column;
		gap: 4px;
		margin-bottom: 10px;
	}

	.songEntry {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;

		&.isPlayed {
			color: var(--playedColor);
		}

		.requester {
			opacity: 0.8;
			font-size: 0.8em;
		}
	}

	.pendingEntry {
		opacity: 0.6;
		.status { font-weight: bold; margin-right: 5px; }
	}

	.pendingSummary {
		font-style: italic;
		opacity: 0.7;
		font-size: 0.9em;
	}
}
</style>
