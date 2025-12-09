<!--
	FrequencyFinderPage.vue
	-----------------------

	This is the settings page for the Frequency Finder system
-->
<template>

	<PageBox
		title="Frequency Finder Settings"
		:themeColor="toy.static.themeColor"
		themeImage="assets/bg_tiles/chat.png"
		bgThemePos="32px"
	>
		<div class="picBox" :style="{ height: '350px',}">
			<img src="/assets/chat_solid/chat.png" height="300px" style="float:right"/>
		</div>
		
		<br>

		<p>
			The Frequency Finder system is unique in that it doesn't have any commands at all.

			Instead, it passively monitors chat for frequently used words and phrases, and displays them
			in a widget that you can place on your stream.

			It will list the matches it finds with an XN next to them.
		</p>
		
		<WidgetSection :toy="toy" />
		
		<SectionHeader title="Settings"/>

		</br></br>
		<h2>Frequency Finder Settings</h2>
		<div class="settingsBlock">
			<SettingsInputRow
				type="number"
				v-model="watchWindow"
				:min="1"
				:max="30"
				:step="1"
			>
				<template #title>Watch Time Window</template>
				<p>How many seconds back in chat should be scanned for matches?</p>
			</SettingsInputRow>
			<SettingsInputRow
				type="number"
				v-model="minCount"
				:min="2"
				:max="30"
				:step="1"
			>
				<template #title>Minimum Count Trigger</template>
				<p>How many matches must be found to show on screen?
				Minimum is 2, but could set a higher match count for active chat.</p>
			</SettingsInputRow>
			<SettingsInputRow
				type="number"
				v-model="matchThreshold"
				:min="50"
				:max="100"
				:step="1"
			>
				<template #title>Match Threshold</template>
				<p>To allow typos, you can reduce the match threshold. 
					100 means perfect match "yes"=="yes", where as a lower Threshold
					would allow "yes" and "yea" to match.
					The second would increase the count, but only the first would display.
				</p>
			</SettingsInputRow>

			
			<SettingsInputRow
				type="number"
				v-model="fontSize"
				:min="8"
				:max="200"
				:step="1"
			>
				<template #title>Font Size</template>
				<p>Font size to show for counts</p>
			</SettingsInputRow>
			<SettingsInputRow
				type="color"
				v-model="fontColor"
			>
				<template #title>Font Color</template>
				<p>Color to use for the counts</p>
			</SettingsInputRow>
			<SettingsInputRow
				type="color"
				v-model="multiplierColor"
			>
				<template #title>Multiplier Color</template>
				<p>Color to use for the 'X' multiplier</p>
			</SettingsInputRow>
			<SettingsInputRow
				type="boolean"
				v-model="showShadow"
			>
				<template #title>Font Shadow</template>
				<p>Add a shadow to the text for better visibility</p>
			</SettingsInputRow>

			<SettingsInputRow
				type="options"
				:options="[
					{ name: 'Top', value: 'top' },
					{ name: 'Bottom', value: 'bottom' },
				]"
				v-model="stackAlign"
			>
				<template #title>Text Alignment</template>
				<p>Stack text form top or bottom? Select to match your layout.</p>
			</SettingsInputRow>			
		</div>
		
		<!-- <SectionHeader title="Video Help"/>
		<YTVideoBox 
			url="https://youtu.be/wDCzZFhiU-s"
			width="100%"
		/> -->

	</PageBox>
</template>
<script setup>

// vue
import { ref, shallowRef, computed, inject } from 'vue';
import { chromeShallowRef } from '../../scripts/chromeRef';

// components
import PageBox from '@components/options/PageBox.vue';
import SectionHeader from '@components/options/SectionHeader.vue';
import InfoBox from '@components/options/InfoBox.vue';
import CommandsConfigBox from '@components/options/CommandsConfigBox.vue';
import SettingsInputRow from '@components/options/SettingsInputRow.vue';
import SettingsAssetRow from '@components/options/SettingsAssetRow.vue';
import WidgetSection from '@components/options/WidgetSection.vue';
import CatsumIpsum from '@components/CatsumIpsum.vue';
import YTVideoBox from '@components/YTVideoBox.vue';

// our app
import FrequencyFinder from './FrequencyFinder.js';

// fetch the main app state context & our toy
const ctApp = inject('ctApp');
const toy = ctApp.toyManager.toys[FrequencyFinder.slug];

// local settings refs
const { 
	fontColor,
	multiplierColor,
	fontSize,
	showShadow,
	stackAlign,
	watchWindow,
	minCount,
	matchThreshold,
} = toy.settings;


</script>
<style lang="scss" scoped>	


</style>
