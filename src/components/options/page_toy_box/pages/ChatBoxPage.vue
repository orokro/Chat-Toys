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
			The Chat Box system allows you to show a customized chat capture on screen.
			However, it also has two special chat commands:
		</p>
		<ul>
			<li>
				<span class="cmd">!{{ 'shout' }}</span> - similar to SuperChat but spends channel points.
				Allows a chat message to be played on screen with a sound.
			</li>
			<li>
				<span class="cmd">!{{ 'swarm' }} &lt;message&gt;</span> - By itself, does nothing.
				But if a critical number of chatters all start typing 
				<span class="cmd">!{{ 'swarm' }} &lt;message&gt;</span> at the same time,
				then the messages will appear randomly on screen, like a swarm of chat.
			</li>
		</ul>
		<SectionHeader title="Command Triggers"/>
		<p>
			Below you can customize the commands that users can type to interact with the Chat system.
		</p>
		<CommandsConfigBox
			:optionsApp="optionsApp"
			:toyName="'Chat'"
			:toySlug="toySlug"
			:commands="commands"
		/>
			
		<SectionHeader title="Settings"/>
		
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
import SettingsRow from '../../SettingsRow.vue';
import SettingsInputRow from '../../SettingsInputRow.vue';
import SettingsAssetRow from '../../SettingsAssetRow.vue';


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
const commands = [
	{
		slug: slugify('shout'),
		command: 'shout',
		params: [
			{ name: 'message', type: 'string', optional: false, desc: 'The message a chatter will "shout"' },
		],
		description: 'A chatter can shout a message in exchange for channel points',
		enabled: true,
		costEnabled: true,
		cost: 0,
		coolDown: 0,
		groupCoolDown: 0,
	},
	{
		slug: slugify('swarm'),
		command: 'swarm',
		params: [
			{ name: 'message', type: 'string', optional: false, desc: 'The message a chatter will "swarm"' },
		],
		description: 'If enough chatters swarm at once, their messages will appear on screen',
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
