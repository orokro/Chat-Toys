<!--
	HelpPage.vue
	------------

	Settings for the Help toy: how often to show tips, how long each one
	stays, where it slides in from, panel + border styling, plus the
	standard text-settings group.
-->
<template>

	<PageBox
		title="Help Tips Settings"
		:themeColor="toy.static.themeColor"
		themeImage="assets/bg_tiles/help.png"
		bgThemePos="35px"
	>
		<div class="picBox" :style="{ height: '350px' }">
			<img src="/assets/icons/help.png" height="300px" style="float:right" onerror="this.style.display='none'"/>
		</div>

		<br>
		<p>
			The Help toy periodically surfaces a small tip card on stream
			showing chatters how to use one of your active toys. It picks
			from commands that have a <code>tipText</code> set and that
			belong to a toy currently live in OBS.
			<br><br>
			Contextual commands (like <code>!eat</code> during a horse race,
			or <code>!reel</code> after casting a line) are skipped - their
			descriptors deliberately have no <code>tipText</code>.
		</p>

		<WidgetSection :toy="toy" />

		<SectionHeader title="Timing"/>
		<div class="settingsBlock">

			<SettingsInputRow
				type="number"
				:min="10"
				:max="3600"
				v-model="intervalSeconds"
			>
				<template #title>Tip Interval (seconds)</template>
				<p>How often a new tip is picked and shown. Default 120 (every 2 minutes).</p>
			</SettingsInputRow>

			<SettingsInputRow
				type="number"
				:min="2"
				:max="60"
				v-model="displaySeconds"
			>
				<template #title>Display Duration (seconds)</template>
				<p>How long each tip remains on screen before sliding away. Default 10.</p>
			</SettingsInputRow>

			<SettingsInputRow
				type="options"
				:options="[
					{ name: 'Slide in from top',    value: 'top' },
					{ name: 'Slide in from bottom', value: 'bottom' },
					{ name: 'Slide in from left',   value: 'left' },
					{ name: 'Slide in from right',  value: 'right' },
				]"
				v-model="slideDirection"
			>
				<template #title>Slide Direction</template>
				<p>Edge of the OBS browser source the tip card slides in from.</p>
			</SettingsInputRow>

		</div>

		<SectionHeader title="Appearance"/>
		<div class="settingsBlock">

			<SettingsInputRow type="color" v-model="bgColor">
				<template #title>Background Color</template>
				<p>Panel background color behind the tip text.</p>
			</SettingsInputRow>

			<SettingsInputRow
				type="float"
				:min="0"
				:max="1"
				:step="0.05"
				v-model="bgOpacity"
			>
				<template #title>Background Opacity</template>
				<p>0 is fully transparent, 1 is fully opaque.</p>
			</SettingsInputRow>

			<SettingsInputRow type="color" v-model="borderColor">
				<template #title>Border Color</template>
				<p>Card border color (the accent edge around the tip).</p>
			</SettingsInputRow>

			<SettingsInputRow
				type="float"
				:min="0"
				:max="1"
				:step="0.05"
				v-model="borderOpacity"
			>
				<template #title>Border Opacity</template>
			</SettingsInputRow>

			<SettingsInputRow
				type="number"
				:min="0"
				:max="20"
				v-model="borderWidth"
			>
				<template #title>Border Width (px)</template>
				<p>Set to 0 to hide the border entirely.</p>
			</SettingsInputRow>

			<SettingsTextRow
				v-for="group in toy.static.textSettings"
				:key="group.groupKey"
				:toy="toy"
				:groupKey="group.groupKey"
			/>

		</div>

		<SectionHeader title="Actions"/>
		<div class="actionButtons">
			<button class="preview-btn" @click="handlePreview">Show a Tip Now</button>
		</div>

	</PageBox>

</template>
<script setup>

// vue
import { inject } from 'vue';

// components
import PageBox from '@components/options/PageBox.vue';
import SectionHeader from '@components/options/SectionHeader.vue';
import SettingsInputRow from '@components/options/SettingsInputRow.vue';
import SettingsTextRow from '@components/options/SettingsTextRow.vue';
import WidgetSection from '@components/options/WidgetSection.vue';

// our app
import Help from './Help';

// fetch the main app state context & our toy
const ctApp = inject('ctApp');
const toy = ctApp.toyManager.toys[Help.slug];

// destructure the setting refs we use directly on this page
const {
	intervalSeconds,
	displaySeconds,
	slideDirection,
	bgColor,
	bgOpacity,
	borderColor,
	borderOpacity,
	borderWidth,
} = toy.settings;


/**
 * Force-show one tip right now (skips the interval timer). Useful for
 * previewing colors / position / text style without waiting.
 */
function handlePreview() {
	toy.showTipNow();
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
			background: #f57c00;

			&:hover {
				background: #e65100;
			}
		}
	}

</style>
