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
			:optionsApp="optionsApp"
			:toyName="'Fishing'"
			:toySlug="toySlug"
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
					assetManager: props.optionsApp.assetsMgr,
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
import { ref, shallowRef } from 'vue';
import { chromeRef, chromeShallowRef } from '../../../../scripts/chromeRef';
import { RefAggregator } from '../../../../scripts/RefAggregator';

// components
import PageBox from '../../PageBox.vue';
import SectionHeader from '../../SectionHeader.vue';
import InfoBox from '../../InfoBox.vue';
import CommandsConfigBox from '../../CommandsConfigBox.vue';
import SettingsRow from '../../SettingsRow.vue';
import SettingsInputRow from '../../SettingsInputRow.vue';
import ArrayEdit from '../../ArrayEdit.vue';
import ArrayFishEdit from '../../ArrayFishEdit.vue';

// props
const props = defineProps({
	
	// reference to the state of the options page
	optionsApp: {
		type: Object,
		default: null
	}
});

// generate slug for command
const toySlug = 'fishing';
const slugify = (text) => (toySlug + '_' + text.toLowerCase());

// built in fish list
const defaultFishList = [
	{
		name: 'runt',
		image: '10',
		scale: 1,
		points: 10,
		rarity: 10
	},
	{
		name: 'common',
		image: '9',
		scale: 1,
		points: 30,
		rarity: 5
	},
	{
		name: 'lunker',
		image: '8',
		scale: 1,
		points: 100,
		rarity: 1
	},
	{
		name: 'boot',
		image: '21',
		scale: 1,
		points: 0,
		rarity: 1
	},
];

// our local settings
const fishSpawnInterval = ref(120);
const fishList = shallowRef(defaultFishList); 
const widgetBox = shallowRef({
	x: 0,
	y: 720-300,
	width: 300,
	height: 300
});
const fishingSettings = chromeShallowRef('fishing-settings', {});
const settingsAggregator = new RefAggregator(fishingSettings);
settingsAggregator.register('fishSpawnInterval', fishSpawnInterval);
settingsAggregator.register('fishList', fishList);
settingsAggregator.register('widgetBox', widgetBox);

// we'll define our commands here
// NOTE: these are the DEFAULTS, the actual commands will be loaded from storage
// in the CommandsConfigBox component
const commands = [
	{
		slug: slugify('cast'),
		command: 'cast',
		params: [
			{ name: 'x', type: 'number', optional: true, desc: 'where on x axis to cast line' },
			{ name: 'y', type: 'number', optional: true, desc: 'where on y axis to cast line' }
		],
		description: 'Cast your fishing line, optionally specify x and y coordinates',
		enabled: true,
		costEnabled: true,
		cost: 0,
		coolDown: 0,
		groupCoolDown: 0,
	},
	{
		slug: slugify('reel'),
		command: 'reel',
		description: 'Attempt to reel in your fishing line',
		enabled: true,
		costEnabled: true,
		cost: 0,
		coolDown: 0,
		groupCoolDown: 0,
	}
];

</script>
<style lang="scss" scoped>	


</style>
