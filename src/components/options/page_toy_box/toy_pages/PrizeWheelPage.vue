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
			Stuff
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
const commands = [];
const commandsOld = [
	{
		slug: slugify('get'),
		command: 'get',
		params: null,
		description: 'Claim points',
		enabled: true,
		costEnabled: false,
		cost: 0,
		coolDown: 0,
		groupCoolDown: 0,
	},	
	{
		slug: slugify('show'),
		command: 'me',
		params: null,
		description: 'Have on screen text show your points',
		enabled: true,
		costEnabled: false,
		cost: 0,
		coolDown: 0,
		groupCoolDown: 0,
	},
	{
		slug: slugify('give'),
		command: 'give',
		params: [
			{ name: 'user', type: 'username', optional: false, desc: 'The user to give points to' },
			{ name: 'amount', type: 'number', optional: false, desc: 'The amount of points to give' }
		],
		description: 'One user can give points to another user',
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
