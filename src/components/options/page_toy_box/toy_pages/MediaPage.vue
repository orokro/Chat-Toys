<!--
	MediaPage.vue
	-------------

	This is the settings page for the Media system.
-->
<template>

	<PageBox
		title="Media Settings"
		themeColor="#51547D"
	>
		<p>
			Stuff
		</p>
		
		<SectionHeader title="Command Triggers"/>
		<p>
			Below you can customize the commands that users can type to interact with the Media system.
		</p>
		<CommandsConfigBox
			:optionsApp="optionsApp"
			:toyName="'Media'"
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
const toySlug = 'media';
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
