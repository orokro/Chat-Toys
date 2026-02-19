<!--
	HorseRacingPage.vue
	-------------------

	This is the settings page for the Horse Racing system.
-->
<template>

	<PageBox
		title="Horse Racing Settings"
		:themeColor="toy.static.themeColor"
		themeImage="assets/bg_tiles/main.png"
		bgSize="120px"
		bgThemePos="35px"
	>
		<div class="picBox" :style="{ height: '350px',}">
			<!-- Note: Using a placeholder image or a relevant one if available -->
			<img src="/assets/chat_solid/users_db.png" height="300px" style="float:right; filter: hue-rotate(150deg);"/>
		</div>
		
		<br>
		<p>
			Horse Racing is a competitive mini-game where your viewers can join a race and compete for the top spot.
			<br><br>
			Users can join the race using the join command. Once enough players have joined, a betting phase begins 
			(if enabled), followed by the race itself. During the race, apples with numbers will appear on the track. 
			The first racer to type the matching eat command will gain speed!
			<br><br>
			You can customize the race length, join time, and betting options below.
		</p>

		<SectionHeader title="Command Triggers"/>
		<p>
			Below you can customize the commands that users can type to interact with the Horse Racing system.
		</p>
		<CommandsConfigBox :toy="toy" />
			
		<WidgetSection :toy="toy" />
		
		<SectionHeader title="Settings"/>
		<div class="settingsBlock">
			<SettingsInputRow
				type="number"
				:min="5"
				v-model="timeToJoin"
			>
				<template #title>Join Time</template>
				<p>How many seconds to allow users to join the race after the first person types the join command.</p>
			</SettingsInputRow>

			<SettingsInputRow
				type="number"
				:min="1"
				v-model="appleFrequency"
			>
				<template #title>Apple Spawn Frequency</template>
				<p>How often (in seconds) new apples appear during the race.</p>
			</SettingsInputRow>

			<SettingsInputRow
				type="number"
				:min="100"
				v-model="raceLength"
			>
				<template #title>Race Length</template>
				<p>How many points are needed to finish the race (default is 1000).</p>
			</SettingsInputRow>

			<SettingsRow>
				<template #title>Allow Betting</template>
				<p>If enabled, non-players can bet points on racers during the BET phase.</p>
				<ToggleCheck v-model="allowBetting" />
			</SettingsRow>

			<SettingsInputRow
				v-if="allowBetting"
				type="number"
				:min="10"
				v-model="betTime"
			>
				<template #title>Betting Time</template>
				<p>How many seconds to allow bets to be placed before the race begins.</p>
			</SettingsInputRow>
		</div>

		<SectionHeader title="Actions"/>
		<div class="status">
			<div v-if="gameState === 'IDLE'">
				<h1>Current status: Idle.</h1>
				<p>Wait for someone to type the join command to start!</p>
			</div>
			<div v-else>
				<h1>Current status: {{ gameState }}</h1>
				<p v-if="gameState === 'LOBBY'">Waiting for racers... {{ timer }}s left.</p>
				<p v-else-if="gameState === 'BET'">Betting in progress... {{ timer }}s left.</p>
				<p v-else>Race is currently active or resolving.</p>
			</div>
		</div>

		<div class="actionButtons">
			<button
				class="reset-btn"
				@click="handleReset"
			>
				Reset Game
			</button>
		</div>
<!-- 
		<SectionHeader title="Video Help"/>
		<YTVideoBox 
			url="https://youtu.be/dQw4w9WgXcQ"
			width="100%"
		/> -->

	</PageBox>

</template>
<script setup>

// vue
import { ref, watch, inject, computed } from 'vue';
import { socketShallowRefReadOnly } from 'socket-ref';

// components
import PageBox from '@components/options/PageBox.vue';
import SectionHeader from '@components/options/SectionHeader.vue';
import InfoBox from '@components/options/InfoBox.vue';
import CommandsConfigBox from '@components/options/CommandsConfigBox.vue';
import SettingsRow from '@components/options/SettingsRow.vue';
import SettingsInputRow from '@components/options/SettingsInputRow.vue';
import WidgetSection from '@components/options/WidgetSection.vue';
import ToggleCheck from '@components/ToggleCheck.vue';
import YTVideoBox from '@components/YTVideoBox.vue';
import ConfirmModal from '@components/options/ConfirmModal.vue';

// lib/ misc
import { promptModal } from "jenesius-vue-modal"

// our app
import HorseRacing from './HorseRacing';

// fetch the main app state context & our toy
const ctApp = inject('ctApp');
const toy = ctApp.toyManager.toys[HorseRacing.slug];

// our local ref settings for this system
const {
	timeToJoin,
	appleFrequency,
	raceLength,
	allowBetting,
	betTime,
} = toy.settings;

// reactive state from the toy for the UI
const gameState = socketShallowRefReadOnly(toy.static.slugify('gameState'), 'IDLE');
const timer = socketShallowRefReadOnly(toy.static.slugify('timer'), 0);

/**
 * Force reset the game
 */
async function handleReset() {
	const response = await promptModal(ConfirmModal, {
		title: 'Are you sure?',
		prompt: `Are you sure you want to reset the current horse race? This will refund all active bets.`,
		buttons: ['yes', 'nevermind'],
		icon: 'warning'
	});

	if (response && response.index === 0) {
		toy.resetGame();
	}
}

</script>
<style lang="scss" scoped>

	.actionButtons {
		display: flex;
		justify-content: center;
		padding: 20px;

		button {
			padding: 10px 20px;
			font-size: 18px;
			font-weight: bold;
			border-radius: 10px;
			cursor: pointer;
			color: white;
			border: 2px solid black;
			background: #d32f2f;
			text-shadow: 1px 1px 0px black;

			&:hover {
				background: #b71c1c;
			}
		}
	}

	.status {
		text-align: center;
		padding: 10px;
		background: rgba(0, 0, 0, 0.05);
		border-radius: 10px;
		margin-bottom: 20px;

		h1 {
			margin: 0;
			font-size: 24px;
		}
	}

</style>
