<!--
	TosserPage.vue
	--------------

	This is the settings page for the Tosser system.
-->
<template>

	<PageBox
		title="Tosser Settings"
		themeColor="#E65A5A"
	>
		<p>
			The Tosser system lets chatters throw things at you, like tomatoes, pies, and more!
		</p>
		
		<SectionHeader title="Command Triggers"/>
		<p>
			Below you can customize the commands that users can type to interact with the Tosser system.
		</p>
		<CommandsConfigBox
			:optionsApp="optionsApp"
			:toyName="'Tosser'"
			:toySlug="toySlug"
			:commands="commands"
		/>
		
		<SectionHeader title="Settings"/>
		<SettingsRow>
			<h3>Tossable Objects</h3>
			<p>Add/Edit 3d Models to Toss!</p>
			<p><strong>NOTE: if no items are added, the toss command will not work in chat.</strong></p>
			
			<ArrayEdit
				v-model="tosserAssets"
				:component="ArrayTosserEdit"
				:rowProps="{ assetManager: props.optionsApp.assetsMgr }"
				:createItem="() => ''"
			/>
		
		</SettingsRow>

		<SectionHeader title="CatsumIpsum"/>
		<CatsumIpsum :paragraphs="1" :sentences="10" :brOnly="true"/>
	</PageBox>

</template>
<script setup>

// vue
import { ref } from 'vue';
import { chromeRef, chromeShallowRef } from '../../../../scripts/chromeRef';
import { RefAggregator } from '../../../../scripts/RefAggregator';

// components
import PageBox from '../../PageBox.vue';
import SectionHeader from '../../SectionHeader.vue';
import InfoBox from '../../InfoBox.vue';
import CommandsConfigBox from '../../CommandsConfigBox.vue';
import CatsumIpsum from '../../../CatsumIpsum.vue';
import SettingsRow from '../../SettingsRow.vue';
import ArrayEdit from '../../ArrayEdit.vue';
import ArrayTextInput from '../../ArrayTextInput.vue';
import ArrayColorInput from '../../ArrayColorInput.vue';
import ArrayTosserEdit from '../../ArrayTosserEdit.vue';

// props
const props = defineProps({
	
	// reference to the state of the options page
	optionsApp: {
		type: Object,
		default: null
	}
});

// generate slug for command
const toySlug = 'tosser';
const slugify = (text) => (toySlug + '_' + text.toLowerCase());

// we'll use a chrome ref to aggregate all our settings
const tosserSettings = chromeShallowRef('tosser-settings', {});

// list of items that can be tossed
const tosserAssets = ref([
	{
		model: "16",
		sound: "15",
		scale: 1,
		slug: "tomato",
		cmd: "tomato",
	},
	{
		model: "18",
		sound: "15",
		scale: 1,
		slug: "wad",
		cmd: "paper",
	}
]);
const randomTossMode = ref(false);

// aggregate all our refs
const settingsAggregator = new RefAggregator(tosserSettings);
settingsAggregator.register('tosserAssets', tosserAssets);
settingsAggregator.register('randomTossMode', randomTossMode);

// we'll define our commands here
// NOTE: these are the DEFAULTS, the actual commands will be loaded from storage
// in the CommandsConfigBox component
const commands = [
	{
		slug: slugify('toss'),
		command: 'toss',
		params: [
			{ name: 'item', type: 'string', optional: true, desc: 'Which item to toss' },
		],
		description: 'Lets the toss an item!',
		enabled: true,
		costEnabled: true,
		cost: 0,
		coolDown: 0,
		groupCoolDown: 0,
	},	
];

</script>
<style lang="scss" scoped>	


</style>
