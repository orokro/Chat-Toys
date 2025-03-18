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
const toySlug = 'tosser';
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
