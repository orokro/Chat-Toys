<!--
	StreamBuddiesPage.vue
	---------------------

	This is the settings page for the StreamBuddies system.
-->
<template>

	<PageBox
		title="Stream Buddies Settings"
		:themeColor="toy.static.themeColor"
		themeImage="assets/bg_tiles/streamBuddies.png"

		bgThemePos="25px"
	>
		<div class="picBox" :style="{ height: '350px',}">
			<img src="/assets/chat_solid/buddies.png" height="300px" style="float:right"/>
		</div>
		
		<br>
		<p>
			The Stream Buddies system lets chatters appear on screen as a character.
		</p>
		<InfoBox icon="warning">
			This is the most advanced system, and has the most commands to configure.
			However, at the time of writing, this system is considered "experimental" and may have bugs.
		</InfoBox>

		<SectionHeader title="Command Triggers"/>
		<p>
			Below you can customize the commands that users can type to interact with the Stream Buddies system.
		</p>
		<CommandsConfigBox :toy="toy" />
		
		<WidgetSection :toy="toy" />
		
		<SectionHeader title="Settings"/>
		<div class="settingsBlock">
			<SettingsInputRow
				type="number"
				:min="1"
				v-model="maxBuddyCount"
			>
				<template #title>Max Buddy Count</template>
				<p>The maximum number of buddies allowed on screen.</p>
				<p>Adjust this based either on your performance needs, or clutter tolerance.</p>
			</SettingsInputRow>
			<SettingsInputRow
				type="float"
				:min="0.01"
				:max="10"
				:step="0.01"
				v-model="buddySize"
			>
				<template #title>Buddy Scale</template>
				<p>Just this to adjust the size of the characters on screen. Default is 1.</p>
			</SettingsInputRow>

			<SettingsInputRow
				type="color"
				v-model="ambientLightColor"
			>
				<template #title>Ambient Light Color</template>
				<p>The renderer uses both an Ambient light as well as a Directional light.</p>
				<p>Use this to set the color of the ambient light.</p>
			</SettingsInputRow>
			<SettingsInputRow
				type="float"
				:min="0.01"
				:max="10"
				:step="0.01"
				v-model="ambientLightIntensity"
			>
				<template #title>Ambient Light Intensity</template>
				<p>Set the ambient light Intensity.</p>
			</SettingsInputRow>

			<SettingsInputRow
				type="color"
				v-model="lightColor"
			>
				<template #title>Directional Light Color</template>
				<p>The renderer uses both an Ambient light as well as a Directional light.</p>
				<p>Use this to set the color of the directional light.</p>
			</SettingsInputRow>
			<SettingsInputRow
				type="float"
				:min="0.01"
				:max="10"
				:step="0.01"
				v-model="lightIntensity"
			>
				<template #title>Light Intensity</template>
				<p>Set the directional light Intensity.</p>
			</SettingsInputRow>

			<SettingsAssetRow
				v-model="modelId"
				:kind-filter="'3d'"
			>
				<h3>Avatar For Characters</h3>
				<p>Must be an FBX with a Mixamo skeleton.</p>
			</SettingsAssetRow>
		</div>		
		
		<SectionHeader title="Video Help"/>
		<YTVideoBox 
			url="https://youtu.be/7cNTiqa_Kq8"
			width="100%"
		/>

	</PageBox>

</template>
<script setup>

// vue
import { ref, inject } from 'vue';

// components
import PageBox from '@components/options/PageBox.vue';
import SectionHeader from '@components/options/SectionHeader.vue';
import InfoBox from '@components/options/InfoBox.vue';
import CommandsConfigBox from '@components/options/CommandsConfigBox.vue';
import SettingsInputRow from '@components/options/SettingsInputRow.vue';
import SettingsAssetRow from '../../components/options/SettingsAssetRow.vue';
import CatsumIpsum from '@components/options/../CatsumIpsum.vue';
import WidgetSection from '@components/options/WidgetSection.vue';
import YTVideoBox from '@components/YTVideoBox.vue';

// our app
import StreamBuddies from './StreamBuddies';

// fetch the main app state context & our toy
const ctApp = inject('ctApp');
const toy = ctApp.toyManager.toys[StreamBuddies.slug];

// our local ref settings for this system
const { 
	maxBuddyCount,
	buddySize,
	modelId,
	ambientLightColor,
	lightColor,
	ambientLightIntensity,
	lightIntensity,
} = toy.settings;

</script>
<style lang="scss" scoped>	


</style>
