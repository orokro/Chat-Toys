<!--
	EmojiFountainPage.vue
	---------------------

	This is the settings page for the Emoji Fountain system
-->
<template>

	<PageBox
		title="Emoji Fountain Settings"
		:themeColor="toy.static.themeColor"
		themeImage="assets/bg_tiles/chat.png"
		bgThemePos="32px"
	>
		<!-- <div class="picBox" :style="{ height: '350px',}">
			<img src="/assets/chat_solid/chat.png" height="300px" style="float:right"/>
		</div> -->
		<div class="picBox" :style="{ height: '350px',}">
			<!-- Icon will be auto-resolved by slug if matching file exists in assets -->
			<img src="/assets/icons/emojiFountain.png" height="300px" style="float:right"/>
		</div>

		<br>

		<p>
			The Eomoji Fountain system spawns emojis on screen in a variety of fun ways.
		</p>
		<ul>
			<li>If the "Wild Emoji" mode is enabled, then any chat message containing emojis will spawn them on screen.
				They can either rain in from the top, or get tossed up from the bottom.</li>
			<li>The !rain command let's user deliberately spawn a downpour of their chosen emojis from the top of the screen</li>
			<li>The !fountain command let's user spawn a fountain of their chosen emojis from the bottom of the screen</li>
			<li>The !firework command launches a chosen emoji as a rocket that bursts into a giant version of itself,
				rebuilt out of colored sparks sampled from the emoji's own pixels</li>
		</ul>
		
		<SectionHeader title="Command Triggers"/>
		<p>
			Below you can customize the commands that users can type to interact with the Head Pats system.
		</p>
		<CommandsConfigBox :toy="toy" />

		<WidgetSection :toy="toy" />
		
		<SectionHeader title="Settings"/>

		</br></br>
		<h2>Emoji Fountain Settings</h2>
		<div class="settingsBlock">

			<SettingsInputRow
				type="boolean"
				v-model="enableWildEmojis"
			>
				<template #title>Enable Wild Emojis</template>
				<p>This setting will parse the live chat looking for emojis too spawn.</p>
				<p>No command is required to spawn these, hence finding them "in the wild.</p>
			</SettingsInputRow>
			<SettingsInputRow
				type="options"
				:options="[
					{ name: 'Rain', value: 'rain' },
					{ name: 'Toss', value: 'toss' },
				]"
				v-model="mode"
			>
				<template #title>Wild Spawning Mode</template>
				<p>When one or more emoji is found in the wild, should they spawn in as rain from the top,
					or get tossed up from the bottom?
				</p>
			</SettingsInputRow>		
			<SettingsInputRow
				type="boolean"
				v-model="cacheEmojiImages"
			>
				<template #title>Cache Emoji Images</template>
				<p>This setting should probably stay on, unless you have a reason to disable.</p>
				<p>It will cache emoji images to prevent unnecessary network traffic.</p>
			</SettingsInputRow>

			<SettingsInputRow
				type="float"
				v-model="emojiSize"
				:min="0.1"
				:max="5"
				:step=".1"
			>
				<template #title>Emoji Size</template>
				<p>You can adjust the size of the spawned emojis here</p>
			</SettingsInputRow>
			<SettingsInputRow
				type="float"
				v-model="speed"
				:min="0.1"
				:max="5"
				:step=".1"
			>
				<template #title>Emoji Speed</template>
				<p>You can adjust the animation timing of the spawned emojis here</p>
			</SettingsInputRow>

			<SettingsInputRow
				type="number"
				v-model="maxCount"
				:min="2"
				:max="200"
				:step="1"
			>
				<template #title>Max Particle Count</template>
				<p>How many total emojis particle are allowed on screen at once?</p>
			</SettingsInputRow>

			<SettingsInputRow
				type="number"
				v-model="rainCount"
				:min="5"
				:max="100"
				:step="1"
			>
				<template #title>Rain Size</template>
				<p>When the !rain command is used, how many emojis should spawn?</p>
			</SettingsInputRow>

			<SettingsInputRow
				type="number"
				v-model="fountainCount"
				:min="5"
				:max="100"
				:step="1"
			>
				<template #title>Fountain Size</template>
				<p>When the !fountain command is used, how many emojis should spawn?</p>
			</SettingsInputRow>

			<SettingsInputRow
				type="number"
				v-model="fireworkCount"
				:min="1"
				:max="20"
				:step="1"
			>
				<template #title>Firework Volley Size</template>
				<p>When the !firework command is used, how many rockets should launch?</p>
			</SettingsInputRow>

			<SettingsInputRow
				type="number"
				v-model="fireworkDetail"
				:min="8"
				:max="32"
				:step="1"
			>
				<template #title>Firework Detail</template>
				<p>How finely each firework samples the emoji when it bursts.</p>
				<p>Higher means more sparks and a sharper rebuilt emoji, but is heavier to render.</p>
			</SettingsInputRow>

			<SettingsInputRow
				type="float"
				v-model="fireworkParticleScale"
				:min="0.2"
				:max="3"
				:step=".1"
			>
				<template #title>Firework Particle Size</template>
				<p>Scales each spark on top of the detail-based sizing.</p>
				<p>Lower (e.g. 0.5) makes the sparks smaller for an airier burst; higher packs them denser.</p>
			</SettingsInputRow>

			<SettingsInputRow
				type="float"
				v-model="fireworkFallSpeed"
				:min="0.1"
				:max="4"
				:step=".1"
			>
				<template #title>Firework Fall Speed</template>
				<p>How quickly the sparks fall after the burst peaks (gravity strength).</p>
			</SettingsInputRow>

			<SettingsInputRow
				type="float"
				v-model="fireworkFallDuration"
				:min="0.3"
				:max="5"
				:step=".1"
			>
				<template #title>Firework Fall Duration</template>
				<p>How long, from the peak of the explosion, before each spark shrinks out of existence.</p>
			</SettingsInputRow>

			<SettingsInputRow
				type="float"
				v-model="fireworkJitter"
				:min="0"
				:max="1.5"
				:step=".05"
			>
				<template #title>Firework Jitter</template>
				<p>How far each spark strays from its exact grid spot in the rebuilt emoji.</p>
				<p>0 is a crisp pixel grid; higher loosens it into a more scattered, organic burst.</p>
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
import EmojiFountain from './EmojiFountain.js';

// fetch the main app state context & our toy
const ctApp = inject('ctApp');
const toy = ctApp.toyManager.toys[EmojiFountain.slug];

// local settings refs
const { 
	emojiSize,
	cacheEmojiImages,
	rainCount,
	fountainCount,
	fireworkCount,
	fireworkDetail,
	fireworkParticleScale,
	fireworkFallSpeed,
	fireworkFallDuration,
	fireworkJitter,
	maxCount,
	enableWildEmojis,
	speed,
	mode,
} = toy.settings;


</script>
<style lang="scss" scoped>	


</style>
