<!--
	KaraokeQueuePage.vue
	--------------------

	This is the settings page for the Karaoke Queue system.
-->
<template>
	<PageBox
		title="Karaoke Queue Settings"
		:themeColor="toy.static.themeColor"
		themeImage="assets/bg_tiles/videos.png"
		bgThemePos="-20px"
	>
		<div class="picBox" :style="{ height: '350px',}">
			<!-- Icon will be auto-resolved by slug if matching file exists in assets -->
			<img src="/assets/icons/karaokeQueue.png" height="300px" style="float:right"/>
		</div>
		
		<br>

		<p>
			The Karaoke Queue system allows viewers to request songs via YouTube IDs.
			<br>
			Streamers can then manage, approve, and play these songs through a dedicated control panel.
		</p>

		<SectionHeader title="Queue Management"/>
		<p>
			Open the control panel to manage pending and approved requests, reorder the queue, and control playback.
		</p>
		<div class="controlAction">
			<button class="openControlsBtn" @click="openQueueManager">
				<span class="material-icons">open_in_new</span> Open Queue Controls
			</button>
		</div>

		<SectionHeader title="Command Triggers"/>
		<p>
			Configure the command that viewers use to request songs.
		</p>
		<CommandsConfigBox :toy="toy" />

		<WidgetSection :toy="toy" />
		
		<SectionHeader title="Settings"/>
		<div class="settingsBlock">
			<SettingsInputRow type="number" v-model="fontSize" :min="8" :max="72">
				<template #title>Font Size</template>
				<p>Size of the text in the List Widget.</p>
			</SettingsInputRow>

			<SettingsInputRow type="color" v-model="fontColor">
				<template #title>Font Color</template>
				<p>Color of the upcoming songs in the list.</p>
			</SettingsInputRow>

			<SettingsInputRow type="color" v-model="playedSongsColor">
				<template #title>Played Songs Color</template>
				<p>Color of the songs that have already been played.</p>
			</SettingsInputRow>

			<SettingsInputRow type="boolean" v-model="fontShadow">
				<template #title>Font Shadow</template>
				<p>Enable a drop shadow for better visibility on overlays.</p>
			</SettingsInputRow>

			<SettingsInputRow type="boolean" v-model="showPendingCount">
				<template #title>Show Pending Count</template>
				<p>Show a summary (e.g., "5 Songs Pending") when the full list is hidden.</p>
			</SettingsInputRow>

			<SettingsInputRow type="boolean" v-model="showPendingList">
				<template #title>Show Pending List</template>
				<p>Show the full list of pending requests below approved ones.</p>
			</SettingsInputRow>

			<SettingsInputRow type="boolean" v-model="showRequesterName">
				<template #title>Show Requester Name</template>
				<p>Show the name of the chatter who requested each song in the list.</p>
			</SettingsInputRow>

			<SettingsInputRow type="boolean" v-model="hidePlayedSongs">
				<template #title>Hide Played Songs</template>
				<p>Remove played songs from the List Widget entirely.</p>
			</SettingsInputRow>
		</div>

	</PageBox>
</template>

<script setup>
import { inject } from 'vue';
import PageBox from '@components/options/PageBox.vue';
import SectionHeader from '@components/options/SectionHeader.vue';
import CommandsConfigBox from '@components/options/CommandsConfigBox.vue';
import SettingsInputRow from '@components/options/SettingsInputRow.vue';
import WidgetSection from '@components/options/WidgetSection.vue';
import KaraokeQueue from './KaraokeQueue';

const ctApp = inject('ctApp');
const toy = ctApp.toyManager.toys[KaraokeQueue.slug];

const { 
	fontSize,
	fontColor,
	fontShadow,
	playedSongsColor,
	showPendingCount,
	showPendingList,
	showRequesterName,
	hidePlayedSongs
} = toy.settings;

async function openQueueManager() {
	// Fetch port from main process
	const port = await window.electronAPI.invoke('get-server-port');
	
	// Opens the manager in a new window
	const isDev = window.location.port === '8080';
	const url = isDev ? '/queue-manager.html' : `http://localhost:${port}/live/queue-manager.html`;
	window.open(url, 'KaraokeQueueManager', 'width=1000,height=900');
}
</script>

<style lang="scss" scoped>
.controlAction {
	padding: 20px 0;
	
	.openControlsBtn {
		display: flex;
		align-items: center;
		gap: 10px;
		background: #9B59B6;
		color: white;
		border: none;
		padding: 12px 24px;
		border-radius: 8px;
		font-weight: bold;
		cursor: pointer;
		font-size: 16px;
		transition: background 0.2s;

		&:hover {
			background: #8E44AD;
		}

		.material-icons {
			font-size: 20px;
		}
	}
}
</style>
