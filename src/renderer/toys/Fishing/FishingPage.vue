<!--
	FishingPage.vue
	---------------

	This is the settings page for the Fishing system.
-->
<template>

	<PageBox
		title="Fishing Settings"
		themeColor="#A4704C"
	>
		<p>The Fishing Toy is a mini game your viewers can play in chat.</p>
		<p>You can customize the list of fish, including:</p>
		<ul>
			<li>Fish Names</li>
			<li>Images</li>
			<li>Rarity</li>
			<li>Channel Point Reward Value</li>
		</ul>
		<p>This way, you can customize the fishing experience to your channels theme.</p>

		<SectionHeader title="Command Triggers"/>
		<p>
			Below you can customize the commands that users can type to interact with the Fishing system.
		</p>
		<CommandsConfigBox
			:toyName="'Fishing'"
			:toySlug="Fishing.slug"
			:commands="commands"
		/>
			
		<SectionHeader title="Settings"/>
		<SettingsInputRow
			type="number"
			:min="1"
			v-model="fishSpawnInterval"
		>
			<h3>Fish Spawn Interval</h3>
			<p>The Maximum time in seconds to wait before another fish should spawn after one was caught.</p>
			<p>A random number will be picked, this is the maximum wait time.</p>
		</SettingsInputRow>

		<SettingsRow>
			<h1>Fish List</h1>
			<p>Customize the list of fish that can be caught.</p>
			<ArrayEdit
				v-model="fishList"
				:component="ArrayFishEdit"
				:rowProps="{ 
					assetManager: ctApp.assetsMgr,
					allFish: fishList.value,
				}"
				:allow-new-items="true"
				:createItem="() => {
					return {
						name: 'boot',
						image: '21',
						scale: 1,
						points: 0,
						rarity: 1
					};
				}"				
			/>
		</SettingsRow>

	</PageBox>

</template>
<script setup>

// vue
import { ref, shallowRef, inject } from 'vue';
import { chromeRef, chromeShallowRef } from '../../scripts/chromeRef';

// components
import PageBox from '@components/options/PageBox.vue';
import SectionHeader from '@components/options/SectionHeader.vue';
import InfoBox from '@components/options/InfoBox.vue';
import CommandsConfigBox from '@components/options/CommandsConfigBox.vue';
import SettingsRow from '@components/options/SettingsRow.vue';
import SettingsInputRow from '@components/options/SettingsInputRow.vue';
import ArrayEdit from '@components/options/ArrayEdit.vue';
import ArrayFishEdit from './ArrayFishEdit.vue';

// our app
import Fishing from './Fishing';

// fetch the main app state context & our toy
const ctApp = inject('ctApp');
const toy = ctApp.toyManager.toys[Fishing.slug];

// our local ref settings
const {
	fishSpawnInterval,
	fishList,
	widgetBox
} = ctApp.toyManager.toys[toy.slug].settings;

// we'll define our commands here
// NOTE: these are the DEFAULTS, the actual commands will be loaded from storage
// in the CommandsConfigBox component
const commands = toy.commands;

</script>
<style lang="scss" scoped>	


</style>
