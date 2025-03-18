<!--
	Chat BoxPage.vue
	----------------

	This is the settings page for the Chat Box system.
-->
<template>

	<PageBox
		title="Chat Box Settings"
		themeColor="#60C5F1"
	>
		<p>
			Stuff
		</p>
		
		<SectionHeader title="Command Triggers"/>
		<p>
			Below you can customize the commands that users can type to interact with the Chat Box system.
		</p>
		<CommandsConfigBox
			:optionsApp="optionsApp"
			:toyName="'Chat Box'"
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
const toySlug = 'chat_box';
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
	}];

</script>
<style lang="scss" scoped>	


</style>
