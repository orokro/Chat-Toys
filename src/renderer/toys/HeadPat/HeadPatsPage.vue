<!--
	HeadPatsPage.vue
	----------------

	This is the settings page for the Head Pats system.
-->
<template>

	<PageBox
		title="Head Pats Settings"
		:themeColor="toy.static.themeColor"
		themeImage="assets/bg_tiles/headpat.png"
		bgThemePos="32px"
	>
		<div class="picBox" :style="{ height: '350px',}">
			<img src="/assets/chat_solid/headPat.png" height="300px" style="float:right"/>
		</div>
		
		<br>

		<p>
			The Head Pats system lets chatters give you head pats!
			<br><br>
			If the user type <span class="cmd">!{{ pat_command }}</span> command by itself, the head-pat media GIF will play
			along with the users name who triggered it.
			<br><br>
			However, if the user types <span class="cmd">!{{ pat_command }} &lt;user&gt;</span>, then the head-pat media GIF will play
			along with the name of the user they specified and it will show a generic user profile.
			<br><br>
			In the future, the user-pat system might support loading the user profile image of the user specified,
			but for now just a generic user profile will be shown.
			<br><br>
			NOTE: this system provides two widgets! One for each mode.
		</p>
		
		<SectionHeader title="Command Triggers"/>
		<p>
			Below you can customize the commands that users can type to interact with the Head Pats system.
		</p>
		<CommandsConfigBox :toy="toy" />

		<WidgetSection :toy="toy" />
		
		<SectionHeader title="Settings"/>
		<div class="settingsBlock">
			<SettingsInputRow
				type="boolean"
				v-model="allowUserPats"
			>
				<template #title>Allow User Pats</template>
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
		</div>
		<CatsumIpsum :paragraphs="1" :sentences="10" :brOnly="true"/>
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
import WidgetSection from '@components/options/WidgetSection.vue';
import CatsumIpsum from '@components/CatsumIpsum.vue';

// our app
import HeadPat from './HeadPat';

// fetch the main app state context & our toy
const ctApp = inject('ctApp');
const toy = ctApp.toyManager.toys[HeadPat.slug];

// local settings refs
const { 
	allowUserPats,
	headPatChatterImage,
} = toy.settings;


// all of the commands system wide are stored in this chrome shallow ref
const commandsRef = chromeShallowRef('commands', {});

// get the command used for head patting
const pat_command = computed(() => {
	return commandsRef.value.headPat__pat?.command || '';
});


</script>
<style lang="scss" scoped>	


</style>
