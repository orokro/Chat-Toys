<!--
	DanmakuPage.vue
	---------------

	This is the settings page for the Danmaku (NicoNico-style scrolling
	comment) system.
-->
<template>

	<PageBox
		title="Danmaku Comments Settings"
		:themeColor="toy.static.themeColor"
		themeImage="assets/bg_tiles/chat.png"
		bgThemePos="32px"
	>

		<p>
			The Danmaku system flies your chat across the screen as a NicoNico-style
			"bullet curtain". Comments stack across multiple invisible rows, and the
			engine keeps them from rear-ending each other: every comment stays on
			screen for the same amount of time, so longer comments simply move faster.
			<br><br>
			It reads your live chat automatically &mdash; no command needed. Command
			messages (anything starting with <span class="cmd">!</span>) are filtered
			out, exactly like the main Chat widget.
			<InfoBox icon="lightbulb">
				Place the widget over your <strong>whole scene</strong>. Use the
				<strong>Screen Coverage</strong> setting to keep comments out of the
				bottom half if you don't want them over your model or cam.
			</InfoBox>
		</p>

		<WidgetSection :toy="toy" />

		<SectionHeader title="Scroll Settings"/>

		<div class="settingsBlock">

			<SettingsInputRow
				type="number"
				v-model="displayDuration"
				:min="3"
				:max="8"
				:step="1"
			>
				<template #title>Display Duration (seconds)</template>
				<p>How long each comment stays on screen. Lower = faster and more chaotic.</p>
			</SettingsInputRow>

			<SettingsInputRow
				type="options"
				:options="[
					{ name: 'Right to Left', value: 'rtl' },
					{ name: 'Left to Right', value: 'ltr' },
				]"
				v-model="direction"
			>
				<template #title>Scroll Direction</template>
				<p>Which way comments travel. Classic Danmaku is right to left.</p>
			</SettingsInputRow>

			<SettingsInputRow
				type="options"
				:options="[
					{ name: 'Stack from Top', value: true },
					{ name: 'Stack from Bottom', value: false },
				]"
				v-model="stackFromTop"
			>
				<template #title>Row Filling</template>
				<p>Whether new rows fill in from the top edge down, or the bottom edge up.</p>
			</SettingsInputRow>

			<SettingsInputRow
				type="number"
				v-model="screenCoverage"
				:min="10"
				:max="100"
				:step="5"
			>
				<template #title>Screen Coverage (%)</template>
				<p>Maximum share of the screen height the comments may cover. This caps how many rows the engine creates.</p>
			</SettingsInputRow>

			<SettingsInputRow
				type="number"
				v-model="opacity"
				:min="10"
				:max="100"
				:step="5"
			>
				<template #title>Opacity (%)</template>
				<p>Overall transparency of the comment layer, so your model/cam underneath stays visible.</p>
			</SettingsInputRow>

			<SettingsInputRow
				type="options"
				:options="[
					{ name: 'Despawn (drop it)', value: 'despawn' },
					{ name: 'Force Overwrite (oldest row)', value: 'overwrite' },
				]"
				v-model="overflowMode"
			>
				<template #title>Overflow Behavior</template>
				<p>What happens when every row is busy: drop the comment, or print it over the oldest row anyway (NicoNico hype style).</p>
			</SettingsInputRow>

			<SettingsInputRow
				type="number"
				v-model="maxOnScreen"
				:min="10"
				:max="200"
				:step="10"
			>
				<template #title>Max Comments On Screen</template>
				<p>A performance safety cap. Comments beyond this are dropped until things calm down.</p>
			</SettingsInputRow>

			<SettingsInputRow
				type="boolean"
				v-model="filterCommands"
			>
				<template #title>Filter Commands</template>
				<p>Skip chat messages that start with <span class="cmd">!</span> so commands don't fly across the screen.</p>
			</SettingsInputRow>

		</div>

		<SectionHeader title="Text Style"/>
		<div class="settingsBlock">
			<!-- Consolidated text-style settings (font, size, color, outline). -->
			<SettingsTextRow
				v-for="group in toy.static.textSettings"
				:key="group.groupKey"
				:toy="toy"
				:groupKey="group.groupKey"
			/>
		</div>

	</PageBox>

</template>
<script setup>

// vue
import { inject } from 'vue';

// components
import PageBox from '@components/options/PageBox.vue';
import SectionHeader from '@components/options/SectionHeader.vue';
import InfoBox from '@components/options/InfoBox.vue';
import SettingsInputRow from '@components/options/SettingsInputRow.vue';
import SettingsTextRow from '@components/options/SettingsTextRow.vue';
import WidgetSection from '@components/options/WidgetSection.vue';

// our app
import Danmaku from './Danmaku';

// fetch the main app state context & our toy
const ctApp = inject('ctApp');
const toy = ctApp.toyManager.toys[Danmaku.slug];

// local settings refs
const {
	displayDuration,
	direction,
	stackFromTop,
	screenCoverage,
	opacity,
	overflowMode,
	maxOnScreen,
	filterCommands,
} = toy.settings;

</script>
<style lang="scss" scoped>


</style>
