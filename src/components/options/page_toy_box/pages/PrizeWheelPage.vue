<!--
	PrizeWheelPage.vue
	------------------

	This is the settings page for the prize wheel system.
-->
<template>

	<PageBox
		title="Prize Wheel Settings"
		themeColor="#FFAAC5"
	>
		<p>
			The Prize Wheel is a fun way to reward your viewers with points, prizes, and more!
		</p>
		<p>
			On this page you can configure the settings for the Prize Wheel system.
		</p>
		<p>
			You can either keep the prize wheel always active, available to be spun at any time, 
			or you can toggle in on/off in the show time page.
		</p>
		
		<SectionHeader title="Command Triggers"/>
		<p>
			Below you can customize the commands that users can type to interact with the Prize Wheel system.
		</p>
		<CommandsConfigBox
			:optionsApp="optionsApp"
			:toyName="'Prize Wheel'"
			:toySlug="toySlug"
			:commands="commands"
		/>
			
		<SectionHeader title="Settings"/>

		<SettingsRow>
			<h3>Item Slots</h3>
			<p>Add Items to the wheel!</p>
			<p><strong>NOTE: if no items are added, the spin command will not work in chat.</strong></p>
			
			<ArrayEdit
				v-model="wheelItems"
				:component="ArrayTextInput"
				:schema="itemSchema"
				:createItem="() => ''"
			/>
		
		</SettingsRow>

		<SettingsRow>
			<h3>Wheel Colors</h3>
			<p>These will be repeated throughout the wheel based on the number of items you have above.</p>
			
			<ArrayEdit
				v-model="wheelColors"
				:component="ArrayColorInput"
				:schema="colorSchema"
				:createItem="() => '#00ABAE'"
			/>
		
		</SettingsRow>
		
		<SectionHeader title="Widget Preview"/>
		<CatsumIpsum :paragraphs="1" :sentences="10" :brOnly="true"/>
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
import CatsumIpsum from '../../../CatsumIpsum.vue';
import SettingsRow from '../../SettingsRow.vue';
import ArrayEdit from '../../ArrayEdit.vue';
import ArrayTextInput from '../../ArrayTextInput.vue';
import ArrayColorInput from '../../ArrayColorInput.vue';

// lib/misc
import * as yup from 'yup';

// props
const props = defineProps({
	
	// reference to the state of the options page
	optionsApp: {
		type: Object,
		default: null
	}
});

// generate slug for command
const toySlug = 'prize_wheel';
const slugify = (text) => (toySlug + '_' + text.toLowerCase());

// make a yup schema that disallows escape characters, as well as one to validate color strings
const itemSchema = yup.string().matches(/^[^\\]+$/, 'Escape characters are not allowed');
const colorSchema = yup.string().matches(/^#[0-9A-Fa-f]{6}$/, 'Color must be a valid hex color');

// we'll use a chrome ref to aggregate all our settings
const prizeWheelSettings = chromeShallowRef('prize-wheel-settings', {});

// our settings for this system
const wheelItems = ref([]);
const wheelColors = ref([]);

// aggregate all our refs
const settingsAggregator = new RefAggregator(prizeWheelSettings);
settingsAggregator.register('wheelItems', wheelItems);
settingsAggregator.register('wheelColors', wheelColors);


// we'll define our commands here
// NOTE: these are the DEFAULTS, the actual commands will be loaded from storage
// in the CommandsConfigBox component
const commands = [
	{
		slug: slugify('spin'),
		command: 'spin',
		params: [
			{ name: 'strength', type: 'number', optional: true, desc: 'How hard to spin' },
		],
		description: 'Lets the chatter spin the wheel!',
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
