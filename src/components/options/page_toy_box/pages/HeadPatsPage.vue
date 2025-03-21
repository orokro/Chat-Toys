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
			:optionsApp="optionsApp"
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

	</PageBox>

</template>
<script setup>

// vue
import { ref, computed } from 'vue';
import { chromeShallowRef } from '../../../../scripts/chromeRef';
import { RefAggregator } from '../../../../scripts/RefAggregator';

// components
import PageBox from '../../PageBox.vue';
import SectionHeader from '../../SectionHeader.vue';
import InfoBox from '../../InfoBox.vue';
import CommandsConfigBox from '../../CommandsConfigBox.vue';
import CatsumIpsum from '../../../CatsumIpsum.vue';
import SettingsInputRow from '../../SettingsInputRow.vue';

// generate slug for command
const toySlug = 'head_pats';
const slugify = (text) => (toySlug + '_' + text.toLowerCase());

// we'll use a chrome ref to aggregate all our settings
const headPatsSettings = chromeShallowRef('head-pat-settings', {});
const allowUserPats = chromeShallowRef(true);
const settingsAggregator = new RefAggregator(headPatsSettings);
settingsAggregator.register('allowUserPats', allowUserPats);


// props
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
