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
		<CommandsConfigBox :toy="toy" />

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
import { chromeShallowRef } from '../../scripts/chromeRef';

// components
import PageBox from '@components/options/PageBox.vue';
import SectionHeader from '@components/options/SectionHeader.vue';
import InfoBox from '@components/options/InfoBox.vue';
import CommandsConfigBox from '@components/options/CommandsConfigBox.vue';
import SettingsInputRow from '@components/options/SettingsInputRow.vue';
import SettingsAssetRow from '@components/options/SettingsAssetRow.vue';

// our app
import HeadPat from './HeadPat';

// fetch the main app state context & our toy
const ctApp = inject('ctApp');
const toy = ctApp.toyManager.toys[HeadPat.slug];

// local settings refs
const { 
	allowUserPats,
	headPatChatterImage,
	streamerWidgetBox,
	chatterWidgetBox
} = ctApp.toyManager.toys[toy.slug].settings;


// all of the commands system wide are stored in this chrome shallow ref
const commandsRef = chromeShallowRef('commands', {});

// get the command used for head patting
const pat_command = computed(() => {
	return commandsRef.value.headPat__pat?.command || '';
});


</script>
<style lang="scss" scoped>	


</style>
