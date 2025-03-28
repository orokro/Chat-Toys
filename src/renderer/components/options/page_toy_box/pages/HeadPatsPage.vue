<!--
	HeadPatsPage.vue
	----------------

	This is the settings page for the Head Pats system.
-->
<template>

	<PageBox
		title="Head Pats Settings"
		themeColor="#C6C37A"
	>
		<p>
			The Head Pats system lets chatters give you head pats!
			<br>
			Or, each other!
		</p>
		
		<SectionHeader title="Command Triggers"/>
		<p>
			Below you can customize the commands that users can type to interact with the Head Pats system.
		</p>
		<CommandsConfigBox
			:toyName="'Head Pats'"
			:toySlug="toySlug"
			:commands="commands"
		/>

		<SectionHeader title="Settings"/>
		<SettingsInputRow
			type="boolean"
			v-model="allowUserPats"
		>
			<h3>Allow User Pats</h3>
			<p>Allow a chatter to specify another user to head-pat with the command
				<span class="cmd">!{{ pat_command }} &lt;user&gt;</span> </p>
		</SettingsInputRow>

		<SettingsAssetRow
			v-model="headPatChatterImage"
			:kind-filter="'image'"
		>
			<h3>Chatter Image</h3>
			<p>Image to use for the head patting chatter</p>
		</SettingsAssetRow>
	</PageBox>

</template>
<script setup>

// vue
import { ref, shallowRef, computed, inject } from 'vue';
import { chromeShallowRef } from '../../../../scripts/chromeRef';

// components
import PageBox from '../../PageBox.vue';
import SectionHeader from '../../SectionHeader.vue';
import InfoBox from '../../InfoBox.vue';
import CommandsConfigBox from '../../CommandsConfigBox.vue';
import SettingsInputRow from '../../SettingsInputRow.vue';
import SettingsAssetRow from '../../SettingsAssetRow.vue';

// fetch the main app state context
const ctApp = inject('ctApp');

// generate slug for command
const toySlug = 'head_pats';
const slugify = (text) => (toySlug + '_' + text.toLowerCase());

// local settings refs
const { 
	allowUserPats,
	headPatChatterImage,
	streamerWidgetBox,
	chatterWidgetBox
} = ctApp.toySettings.headPatSettings;


// we'll define our commands here
// NOTE: these are the DEFAULTS, the actual commands will be loaded from storage
// in the CommandsConfigBox component
const commands = [
	{
		slug: slugify('pat'),
		command: 'pat',
		params: [
			{ name: 'user', type: 'username', optional: true, desc: 'Which chatter to head pat' },
		],
		description: 'Show head pat graphic on streamer, or optionally a chatter.!',
		enabled: true,
		costEnabled: true,
		cost: 0,
		coolDown: 0,
		groupCoolDown: 0,
	},	
];


// all of the commands system wide are stored in this chrome shallow ref
const commandsRef = chromeShallowRef('commands', {});

// get the command used for head patting
const pat_command = computed(() => {
	return commandsRef.value.head_pats_pat?.command || '';
});


</script>
<style lang="scss" scoped>	


</style>
