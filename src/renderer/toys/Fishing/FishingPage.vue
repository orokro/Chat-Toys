<!--
	FishingPage.vue
	---------------

	This is the settings page for the Fishing system.
-->
<template>

	<PageBox
		title="Fishing Settings"
		:themeColor="toy.static.themeColor"
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
		<CommandsConfigBox :toy="toy" />
			
		<WidgetSection :toy="toy" />
		
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

		<SettingsInputRow
			type="number"
			:min="1"
			v-model="maxFish"
		>
			<h3>Max Fish</h3>
			<p>The Maximum number of fish that should be spawned on screen at once.</p>
		</SettingsInputRow>

		<SettingsInputRow
			type="number"
			:min="1"
			v-model="castTimeout"
		>
			<h3>Cast Timeout</h3>
			<p>
				The came will automatically reel in a users reel after this number of seconds.
				(consider if the user leaves the stream or goes off line... their cast will
				eventually timeout and auto-reel back in.)
			</p>
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
						rarity: 1,
						percentage: -1,
					};
				}"				
			/>
		</SettingsRow>

	</PageBox>

</template>
<script setup>

// vue
import { ref, shallowRef, watch, inject, nextTick } from 'vue';
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
import WidgetSection from '@components/options/WidgetSection.vue';

// our app
import Fishing from './Fishing';

// fetch the main app state context & our toy
const ctApp = inject('ctApp');
const toy = ctApp.toyManager.toys[Fishing.slug];

// our local ref settings
const {
	fishSpawnInterval,
	maxFish,
	castTimeout,
	fishList,
} = toy.settings;

let skipCompute = false;
watch(
	() => fishList,
	(newVal) => {

		if(skipCompute)
			return;
		
		skipCompute = true;
		
		let updated = [...fishList.value];

		// calculate the total rarity
		let totalRarity = 0;
		for (const fish of fishList.value)
			totalRarity += parseInt(fish.rarity, 10);
		
		// update the percentage for each fish
		for(const fish of fishList.value)
			if (totalRarity > 0)
				fish.percentage = parseInt(Math.round((parseInt(fish.rarity, 10) / totalRarity) * 100), 10);
			else
				fish.percentage = 0;
		
		
		// re-assign the value
		fishList.value = [...fishList.value.map(fish => {
			return {...fish}
		})];

		// allow the watcher to run again
		nextTick(() => {
			skipCompute = false;
		});
	}
, { deep: true });

</script>
<style lang="scss" scoped>	


</style>
