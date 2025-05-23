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
		<div class="settingsBlock">
			<SettingsRow>
				<h3>Media</h3>
				<p>
					Each command can show
				</p>
				<ul>
					<li>an image</li>
					<li>a sound</li>
					<li>or both</li>
				</ul>
				<p>
					You can also set the duration that the image will be shown for.
				</p>
				
				<ArrayEdit
					v-model="mediaAssets"
					:component="ArrayMediaEdit"
					:rowProps="{ assetManager: ctApp.assetsMgr }"
					:allow-new-items="false"
				/>
			
			</SettingsRow>
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
import { ref, computed, watch, onMounted, shallowRef, inject } from 'vue';
import { chromeRef, chromeShallowRef } from '../../scripts/chromeRef';

// components
import PageBox from '@components/options/PageBox.vue';
import SectionHeader from '@components/options/SectionHeader.vue';
import InfoBox from '@components/options/InfoBox.vue';
import CommandsConfigBox from '@components/options/CommandsConfigBox.vue';
import SettingsRow from '@components/options/SettingsRow.vue';
import CatsumIpsum from '@components/options/../CatsumIpsum.vue';
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
} = toy.settings;


// all of the commands system wide are stored in this chrome shallow ref
const commandsRef = chromeShallowRef('commands', {});


// compute array of the custom commands
const customCommands = computed(() => {

	// get all keys of the commandsRef.value as an array
	const commandKeys = Object.keys(commandsRef.value);
	return commandKeys.filter(cmd => cmd.startsWith(Media.slug));
});


// make sure the commands we have in state are in sync with the commandsRef
function reconcileMediaAssets(currentCommands){

	// keep list of new media assets to add to our settings state
	const newMediaAssets = [];

	// loop over our new command slugs & make new media assets objects if they don't exist
	currentCommands.forEach((slug) => {

		// get the command object
		const command = commandsRef.value[slug];

		// check if we already have a media asset for this command
		const existingAsset = mediaAssets.value.find(asset => asset.commandSlug === slug);
		if(!existingAsset){

			// create a new media asset object
			newMediaAssets.push({
				commandSlug: slug,
				commandName: command.command,
				hasImage: true,
				imageId: "6",
				hasSound: true,
				soundId: "13",
				duration: 10,
			});
		}
	});

	// now loop over the existing media assets and remove any that don't have a corresponding command
	const filteredMediaAssets = mediaAssets.value.filter(asset => {
		return currentCommands.includes(asset.commandSlug);
	});

	// mix into new array
	const newMediaAssetsArray = [...filteredMediaAssets, ...newMediaAssets];

	// make sure the commands are up-to-date even if the slugs diddnt change
	// this is because the commands themselves could have changed
	newMediaAssetsArray.forEach((asset) => {
		const command = commandsRef.value[asset.commandSlug];
		asset.commandName = command.command;
	});

	// add the new media assets to the existing, remaining ones
	mediaAssets.value = newMediaAssetsArray;	
}


// reconcile the media assets on load
onMounted(() => {
	reconcileMediaAssets(customCommands.value);
});


// when our custom commands list change, we need to reconcile the media assets
// because unlike other systems, the media system doesn't have any built in commands
// for deleting the assets directly. They are paired with the custom commands
watch(customCommands, (currentCommands) => {
	reconcileMediaAssets(currentCommands);
});


</script>
<style lang="scss" scoped>	


</style>
