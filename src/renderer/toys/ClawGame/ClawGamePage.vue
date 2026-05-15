<!--
	ClawGamePage.vue
	----------------

	Settings page for the Claw Game toy. Mirrors the tilde menu of the demo
	(prize scale, slip mechanics, push mechanics, prize list) plus standard
	chat-toys affordances (command config, widget layout, reset/respawn
	actions). The "show status HUD" toggle is intentionally omitted - the
	OBS overlay has no need for the demo's diagnostic header.
-->
<template>

	<PageBox
		title="Claw Game Settings"
		:themeColor="toy.static.themeColor"
		themeImage="assets/bg_tiles/clawGame.png"
		bgThemePos="35px"
	>
		<div class="picBox" :style="{ height: '350px' }">
			<img src="/assets/icons/clawGame.png" height="300px" style="float:right" onerror="this.style.display='none'"/>
		</div>

		<br>
		<p>
			The Claw Game is a chat-driven claw machine. Viewers type
			<code>!drop &lt;0-100&gt;</code> to send the claw down at that
			horizontal position. Whoever calls the drop has their name
			displayed on the claw housing as it descends. Drops are queued so
			multiple chatters can line up - each drop plays through before the
			next begins.
			<br><br>
			Configure prize images, prize scale, and the slip / push mechanics
			below. Use "Reset" to clear the current queue and active drop.
		</p>

		<SectionHeader title="Command Triggers"/>
		<p>
			Below you can customize the command users type to drop the claw.
		</p>
		<CommandsConfigBox :toy="toy" />

		<WidgetSection :toy="toy" />

		<SectionHeader title="Settings"/>
		<div class="settingsBlock">

			<SettingsInputRow
				type="float"
				:min="0.2"
				:max="1.0"
				:step="0.05"
				v-model="prizeScale"
			>
				<template #title>Prize Scale</template>
				<p>
					Visual size of prizes (and by extension the claw arm length).
					Larger prizes are easier to push around and harder to fit
					through the chute. Range 0.2 - 1.0.
				</p>
			</SettingsInputRow>

			<SettingsInputRow
				type="float"
				:min="0.5"
				:max="3.0"
				:step="0.1"
				v-model="uiScale"
			>
				<template #title>UI Scale</template>
				<p>
					Global multiplier on top of Prize Scale. The machine is
					tuned to look right at 1080p with UI Scale = 1.0 - bump
					this up (e.g. 2.0) if you're running the widget at 4K and
					the claw / prizes look too small relative to the scene.
				</p>
			</SettingsInputRow>

			<SettingsInputRow
				type="number"
				:min="6"
				:max="40"
				v-model="spawnCount"
			>
				<template #title>Prize Count</template>
				<p>How many prizes to drop into the machine when it (re)spawns.</p>
			</SettingsInputRow>

			<SettingsInputRow
				type="number"
				:min="0"
				:max="100"
				v-model="slipChance"
			>
				<template #title>Slip Chance (%)</template>
				<p>
					Percent chance, after a successful grab, that the prize will
					slip out of the claw before reaching the chute. 0 = never,
					100 = always.
				</p>
			</SettingsInputRow>

			<SettingsInputRow
				type="float"
				:min="0.5"
				:max="10"
				:step="0.5"
				v-model="slipMinTime"
			>
				<template #title>Slip Min Time (seconds)</template>
				<p>Minimum time the claw can hold a prize before it slips.</p>
			</SettingsInputRow>

			<SettingsInputRow
				type="float"
				:min="0.5"
				:max="15"
				:step="0.5"
				v-model="slipMaxTime"
			>
				<template #title>Slip Max Time (seconds)</template>
				<p>Maximum time the claw can hold a prize before it slips.</p>
			</SettingsInputRow>

			<SettingsInputRow
				type="number"
				:min="1"
				:max="100"
				v-model="pushStrength"
			>
				<template #title>Push Strength</template>
				<p>
					How hard the claw shoves nearby prizes when it grabs or
					misses (simulates the claw disturbing the pile).
				</p>
			</SettingsInputRow>

			<SettingsInputRow
				type="boolean"
				v-model="pushOnGrab"
			>
				<template #title>Push Prizes on Grab</template>
				<p>Apply the push nudge when the claw successfully grabs a prize.</p>
			</SettingsInputRow>

			<SettingsInputRow
				type="boolean"
				v-model="pushOnMiss"
			>
				<template #title>Push Prizes on Miss</template>
				<p>Apply the push nudge when the claw closes on empty space.</p>
			</SettingsInputRow>

			<SettingsRow>
				<h3>Prize Pool</h3>
				<p>
					Prizes that can appear in the machine. Each entry has an
					image, a display name, and a scale multiplier. Prizes are
					sampled in a round-robin from this list when the machine
					spawns.
				</p>
				<ArrayEdit
					v-model="prizes"
					:component="ArrayPrizeItemEdit"
					:rowProps="{ assetManager: ctApp.assetsMgr }"
					:allow-new-items="true"
					:createItem="() => ({ name: 'prize', image: '', scale: 1 })"
				/>
			</SettingsRow>
		</div>

		<SectionHeader title="Actions"/>
		<div class="status">
			<div v-if="!currentDrop">
				<h1>Current status: Idle.</h1>
				<p v-if="pendingQueue.length > 0">
					{{ pendingQueue.length }} drop{{ pendingQueue.length === 1 ? '' : 's' }} queued.
				</p>
				<p v-else>Waiting for someone to type the drop command.</p>
			</div>
			<div v-else>
				<h1>Current status: {{ currentDrop.username }} is dropping!</h1>
				<p v-if="pendingQueue.length > 0">
					{{ pendingQueue.length }} more drop{{ pendingQueue.length === 1 ? '' : 's' }} queued.
				</p>
			</div>
		</div>

		<div class="actionButtons">
			<button class="respawn-btn" @click="handleRespawn">Re-spawn Prizes</button>
			<button class="reset-btn" @click="handleReset">Reset Queue</button>
		</div>

	</PageBox>

</template>
<script setup>

// vue
import { inject } from 'vue';
import { socketShallowRefReadOnly } from 'socket-ref';

// components
import PageBox from '@components/options/PageBox.vue';
import SectionHeader from '@components/options/SectionHeader.vue';
import CommandsConfigBox from '@components/options/CommandsConfigBox.vue';
import SettingsRow from '@components/options/SettingsRow.vue';
import SettingsInputRow from '@components/options/SettingsInputRow.vue';
import WidgetSection from '@components/options/WidgetSection.vue';
import ArrayEdit from '@components/options/ArrayEdit.vue';
import ConfirmModal from '@components/options/ConfirmModal.vue';
import ArrayPrizeItemEdit from './ArrayPrizeItemEdit.vue';

// lib/misc
import { promptModal } from 'jenesius-vue-modal';

// our app
import ClawGame from './ClawGame';

// fetch the main app state context & our toy
const ctApp = inject('ctApp');
const toy = ctApp.toyManager.toys[ClawGame.slug];

// destructured setting refs - tabs/auto-unwrapping in templates
const {
	prizeScale,
	uiScale,
	spawnCount,
	slipChance,
	slipMinTime,
	slipMaxTime,
	pushStrength,
	pushOnGrab,
	pushOnMiss,
	prizes,
} = toy.settings;

// live state for the action panel
const currentDrop = socketShallowRefReadOnly(toy.static.slugify('currentDrop'), null);
const pendingQueue = socketShallowRefReadOnly(toy.static.slugify('pendingQueue'), []);


/**
 * Tell the widget to throw out the current prize pile and respawn a fresh
 * one. Useful after editing the prize list.
 */
async function handleRespawn() {

	const response = await promptModal(ConfirmModal, {
		title: 'Re-spawn prizes?',
		prompt: `Clear the current prize pile and drop a fresh set in? Any prizes already in the chute or being grabbed will be removed.`,
		buttons: ['yes', 'nevermind'],
		icon: 'warning',
	});
	if (response && response.index === 0) toy.respawnPrizes();
}


/**
 * Clear the queue and abort any active drop.
 */
async function handleReset() {

	const response = await promptModal(ConfirmModal, {
		title: 'Reset claw game?',
		prompt: `Clear the queue and stop the current drop?`,
		buttons: ['yes', 'nevermind'],
		icon: 'warning',
	});
	if (response && response.index === 0) toy.resetGame();
}

</script>
<style lang="scss" scoped>

	.actionButtons {
		display: flex;
		justify-content: center;
		gap: 16px;
		padding: 20px;

		button {
			padding: 10px 20px;
			font-size: 18px;
			font-weight: bold;
			border-radius: 10px;
			cursor: pointer;
			color: white;
			border: 2px solid black;
			text-shadow: 1px 1px 0px black;
		}

		.reset-btn {
			background: #d32f2f;
			&:hover { background: #b71c1c; }
		}

		.respawn-btn {
			background: #0891b2;
			&:hover { background: #0e7490; }
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
