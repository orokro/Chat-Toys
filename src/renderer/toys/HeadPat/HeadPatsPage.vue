<!--
	HeadPatsPage.vue
	----------------

	This is the settings page for the Head Pats system.
-->
<template>

	<PageBox
		title="Head Pat/Bonk/Slap Settings"
		:themeColor="toy.static.themeColor"
		themeImage="assets/bg_tiles/headpat.png"
		bgThemePos="32px"
	>
		<div class="picBox" :style="{ height: '350px',}">
			<img src="/assets/chat_solid/headPat.png" height="300px" style="float:right"/>
		</div>
		
		<br>

		<p>
			The Head Pats system lets chatters give you head pats, bonks, or slaps!
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
			NOTE: this system provides two widgets! One for placing on the streams head, one to place anywhere for patting/bonking/slapping other chatters.
			<InfoBox icon="lightbulb">
				NEW FEATURES:<br>
				Two new commands:
				<span class="cmd">!{{ bonk_command }} &lt;slug&gt;</span> and 
				<span class="cmd">!{{ slap_command }} &lt;slug&gt;</span>
				have been added to play a bonk and slap gif respectively.<br>
				These also have assignable sounds!
			</InfoBox>

		</p>
		
		<SectionHeader title="Command Triggers"/>
		<p>
			Below you can customize the commands that users can type to interact with the Head Pats system.
		</p>
		<CommandsConfigBox :toy="toy" />

		<WidgetSection :toy="toy" />
		
		<SectionHeader title="Settings"/>

		</br></br>
		<h2>Head Pats Settings</h2>
		<div class="settingsBlock">
			<SettingsInputRow
				type="number"
				v-model="timeToShow"
				:min="1"
				:max="30"
				:step="1"
			>
				<template #title>Time to Show (seconds)</template>
				<p>How long to show the head pat on screen</p>
			</SettingsInputRow>
			<SettingsInputRow
				type="boolean"
				v-model="showPatterName"
			>
				<template #title>Show Patter Name</template>
				<p>Show the name of the chatter who triggered the head pat</p>
			</SettingsInputRow>
			<SettingsInputRow
				type="number"
				v-model="chatterNameFontSize"
				:min="8"
				:max="72"
				:step="1"
			>
				<template #title>Chatter Name Font Size</template>
				<p>Font size to use for the patter's name</p>
			</SettingsInputRow>
			<SettingsInputRow
				type="color"
				v-model="chatterNameColor"
			>
				<template #title>Chatter Name Color</template>
				<p>Color to use for the patter's name</p>
			</SettingsInputRow>
			<SettingsInputRow
				type="color"
				v-model="chatterTextColor"
			>
				<template #title>Chatter Text Color</template>
				<p>Color to use for any text shown for the patter</p>
			</SettingsInputRow>
			<SettingsInputRow
				type="boolean"
				v-model="chatterNameShadow"
			>
				<template #title>Chatter Name Shadow</template>
				<p>Add a shadow to the patter's name for better visibility</p>
			</SettingsInputRow>

			<SettingsInputRow
				type="boolean"
				v-model="enableWidgetSound"
			>
				<template #title>Enable Widget Sound</template>
				<p>Allow bonk & slap to play sounds?</p>
			</SettingsInputRow>
			<SettingsAssetRow
				v-model="bonkSoundId"
				:kind-filter="'sound'"
				v-if="enableWidgetSound"
			>
				<h3>Bonk Sound Effect</h3>
				<p>Choose a sound effect to play for bonk commands.</p>
			</SettingsAssetRow>
			<SettingsAssetRow
				v-model="slapSoundId"
				:kind-filter="'sound'"
				v-if="enableWidgetSound"
			>
				<h3>Slap Sound Effect</h3>
				<p>Choose a sound effect to play for slap commands.</p>
			</SettingsAssetRow>

		</div>

		<br/>
		<h2>User Head Pats</h2>
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
		
		<SectionHeader title="Video Help"/>
		<YTVideoBox 
			url="https://youtu.be/wDCzZFhiU-s"
			width="100%"
		/>

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
import YTVideoBox from '@components/YTVideoBox.vue';

// our app
import HeadPat from './HeadPat';

// fetch the main app state context & our toy
const ctApp = inject('ctApp');
const toy = ctApp.toyManager.toys[HeadPat.slug];

// local settings refs
const { 
	timeToShow,
	showPatterName,
	chatterNameFontSize,
	chatterNameColor,
	chatterTextColor,
	chatterNameShadow,
	allowUserPats,
	headPatChatterImage,
	enableWidgetSound,
	bonkSoundId,
	slapSoundId
} = toy.settings;


// all of the commands system wide are stored in this chrome shallow ref
const commandsRef = chromeShallowRef('commands', {});

// get the commands used as strings
const pat_command = computed(() => {
	return commandsRef.value.headPat__pat?.command || '';
});
const bonk_command = computed(() => {
	return commandsRef.value.headPat__bonk?.command || '';
});
const slap_command = computed(() => {
	return commandsRef.value.headPat__slap?.command || '';
});


</script>
<style lang="scss" scoped>	


</style>
