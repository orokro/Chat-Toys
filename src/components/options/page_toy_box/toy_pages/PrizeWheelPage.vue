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
			<br>
			On this page you can configure the settings for the Prize Wheel system.
			<br>
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
			
		<SectionHeader title="CatsumIpsum"/>
		<CatsumIpsum :paragraphs="5" :sentences="10"/>
	</PageBox>

</template>
<script setup>

// vue
import { ref } from 'vue';

// components
import PageBox from '../../PageBox.vue';
import SectionHeader from '../../SectionHeader.vue';
import InfoBox from '../../InfoBox.vue';
import CommandsConfigBox from '../../CommandsConfigBox.vue';
import CatsumIpsum from '../../../CatsumIpsum.vue';

// generate slug for command
const toySlug = 'prize_wheel';
const slugify = (text) => (toySlug + '_' + text.toLowerCase());

const props = defineProps({
	
	// reference to the state of the options page
	optionsApp: {
		type: Object,
		default: null
	}
});

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
