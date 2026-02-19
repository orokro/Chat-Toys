<!--
	MediaPage.vue
	-------------

	This is the settings page for the Media system.
-->
<template>

	<PageBox
		title="Media Settings"
		:themeColor="toy.static.themeColor"
		themeImage="assets/bg_tiles/media.png"
		bgThemePos="-20px"
	>
		<div class="picBox" :style="{ height: '350px',}">
			<img src="/assets/chat_solid/media.png" height="300px" style="float:right"/>
		</div>
		
		<br>

		<p>
			The Media system lets chatters trigger things such as images, gifs, or sounds, or both at the same time!
			<br>
			On this page you can configure the settings for the Media system.
		</p>
		<InfoBox icon="lightbulb">
			<strong>NOTE:</strong> The Media system is a bit different from other toys, in that it doesn't have a any built in commands at all.
			<br>
			Instead, you can create custom commands in the "Command Triggers" section below, and then assign them to specific media items.
		</InfoBox>

		<SectionHeader title="Command Triggers"/>
		<p>
			By default, there are no commands to configure for the Media system.
			<br>
			Click the "Add Command" button below to create a new command, and it can be used to trigger media, 
			in the settings below
		</p>
		<CommandsConfigBox
			:toy="toy"
			:enable-custom-commands="true"
		/>

		<WidgetSection :toy="toy" />
		
		<SectionHeader title="Settings"/>

		<h2>Media Item Settings</h2>

		<div class="settingsBlock">
			<SettingsRow>				
				<ArrayEdit
					v-model="mediaAssets"
					:component="ArrayMediaEdit"
					:rowProps="{ assetManager: ctApp.assetsMgr }"
					:allow-new-items="false"
				/>
			
			</SettingsRow>
		</div>

		<br/>
		<h2>Text Settings</h2>
		<div class="settingsBlock">
			<!-- <SettingsInputRow
				type="boolean"
				v-model="showPatterName"
			>
				<template #title>Show Patter Name</template>
				<p>Show the name of the chatter who triggered the media</p>
			</SettingsInputRow> -->
			<SettingsInputRow
				type="number"
				v-model="chatterNameFontSize"
				:min="8"
				:max="72"
				:step="1"
			>
				<template #title>Chatter Name Font Size</template>
				<p>Font size to use for the chatter's name</p>
			</SettingsInputRow>
			<SettingsInputRow
				type="color"
				v-model="chatterNameColor"
			>
				<template #title>Chatter Name Color</template>
				<p>Color to use for the chatter's name</p>
			</SettingsInputRow>
			<SettingsInputRow
				type="color"
				v-model="chatterTextColor"
			>
				<template #title>Chatter Text Color</template>
				<p>Color to use for any additional text shown</p>
			</SettingsInputRow>
			<SettingsInputRow
				type="boolean"
				v-model="chatterNameShadow"
			>
				<template #title>Chatter Name Shadow</template>
				<p>Add a shadow to the name for better visibility</p>
			</SettingsInputRow>
		</div>
		
		<SectionHeader title="Video Help"/>
		<YTVideoBox 
			url="https://youtu.be/35cJEtJNiq8"
			width="100%"
		/>

	</PageBox>

</template>
<script setup>

// vue
import { inject } from 'vue';

// components
import PageBox from '@components/options/PageBox.vue';
import SectionHeader from '@components/options/SectionHeader.vue';
import InfoBox from '@components/options/InfoBox.vue';
import CommandsConfigBox from '@components/options/CommandsConfigBox.vue';
import SettingsRow from '@components/options/SettingsRow.vue';
import SettingsInputRow from '@components/options/SettingsInputRow.vue';
import ArrayEdit from '@components/options/ArrayEdit.vue';
import ArrayMediaEdit from './ArrayMediaEdit.vue';
import WidgetSection from '@components/options/WidgetSection.vue';
import YTVideoBox from '@components/YTVideoBox.vue';

// our app
import Media from './Media';

// fetch the main app state context & our toy
const ctApp = inject('ctApp');
const toy = ctApp.toyManager.toys[Media.slug];

// local settings refs
const { 
	mediaAssets,
	chatterNameFontSize,
	chatterNameColor,
	chatterTextColor,
	chatterNameShadow,
} = toy.settings;

</script>
<style lang="scss" scoped>	


</style>
