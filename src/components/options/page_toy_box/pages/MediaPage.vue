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
			The Media system lets chatters trigger things such as images, gifs, or sounds, or both at the same time!
			<br>
			On this page you can configure the settings for the Media system.
		</p>
		
		<SectionHeader title="Command Triggers"/>
		<p>
			By default, there are no commands to configure for the Media system.
			<br>
			Click the "Add Command" button below to create a new command, and it can be used to trigger media, 
			in the settings below
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
