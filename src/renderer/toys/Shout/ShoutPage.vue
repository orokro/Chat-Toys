<!--
	ShoutPage.vue
	-------------

	This is the settings page for the Shout system.
-->
<template>

	<PageBox
		title="Shout Settings"
		:themeColor="toy.static.themeColor"
		themeImage="assets/bg_tiles/chat.png"
		bgSize="140px"
		bgThemePos="40px"
	>
		<div class="picBox" :style="{ height: '350px',}">
			<img src="/assets/chat_solid/chat.png" height="300px" style="float:right"/>
		</div>
		<br><br>
		<p>The <span class="cmd">!{{ shout_command }}</span> command is similar to SuperChat but spends channel points.</p>
       	<p>This allows a chat message to be played on screen with a sound.</p>

		<SectionHeader title="Command Triggers"/>
		<p>
			Below you can customize the commands that users can type to interact with the Shout system.
		</p>
		<CommandsConfigBox :toy="toy" />
		
		<WidgetSection :toy="toy" />
		
		<SectionHeader title="Settings"/>

		<div class="settingsBlock">

			<SettingsInputRow
				type="boolean"
				v-model="enableSound"
			>
				<template #title>Enable Sound</template>
				<p>When message is shown, play a sound.</p>
			</SettingsInputRow>
			<SettingsAssetRow
				v-if="enableSound"
				v-model="shoutSoundId" 
				:kind-filter="'sound'"
			>
				<h3>Shout Sound</h3>
				<p>What sound effect should play when <span class="cmd">!{{ shout_command }}</span> command is used.</p>
			</SettingsAssetRow>

			<SettingsInputRow
				type="number"
				:min="1"
				:max="100"
				:step="1"
				v-model="displayDuration"
			>
				<template #title>Display Duration</template>
				<p>How Long to display message for, in seconds</p>
			</SettingsInputRow>

			<SettingsInputRow
				type="boolean"
				v-model="showChatterNames"
			>
				<template #title>Show Chatter Names</template>
				<p>Disable to show messages only.</p>
			</SettingsInputRow>
			<SettingsInputRow
				type="color"
				v-model="chatNameColor"
			>
				<template #title>User Name Chat Color</template>
				<p>What color to use for chat's user names?</p>
			</SettingsInputRow>
			<SettingsInputRow
				type="color"
				v-model="chatTextColor"
			>
				<template #title>Chat Text Color</template>
				<p>What color to use for message text?</p>
			</SettingsInputRow>
			<SettingsInputRow
				type="number"
				:min="1"
				:max="100"
				:step="1"
				v-model="chatTextSize"
			>
				<template #title>Chat Text Size.</template>
				<p>Font size for the chat box text.</p>
			</SettingsInputRow>
			<SettingsInputRow
				type="boolean"
				v-model="chatTextShadow"
			>
				<template #title>Chat Text Shadow</template>
				<p>Enable to add a shadow to chat text for better visibility.</p>
			</SettingsInputRow>
			
		</div>

		<SectionHeader title="Video Help"/>
		<YTVideoBox 
			url="https://youtu.be/kc-181dg2M8"
			width="100%"
		/>
	</PageBox>

</template>
<script setup>

// vue
import { ref, shallowRef, computed, inject } from 'vue';
import { chromeRef, chromeShallowRef } from '../../scripts/chromeRef';

// components
import PageBox from '@components/options/PageBox.vue';
import SectionHeader from '@components/options/SectionHeader.vue';
import InfoBox from '@components/options/InfoBox.vue';
import CommandsConfigBox from '@components/options/CommandsConfigBox.vue';
import SettingsRow from '@components/options/SettingsRow.vue';
import SettingsInputRow from '@components/options/SettingsInputRow.vue';
import SettingsAssetRow from '@components/options/SettingsAssetRow.vue';
import WidgetSection from '@components/options/WidgetSection.vue';
import CatsumIpsum from '@components/CatsumIpsum.vue';
import YTVideoBox from '@components/YTVideoBox.vue';

// our app
import Shout from './Shout';

// fetch the main app state context & our toy
const ctApp = inject('ctApp');
const toy = ctApp.toyManager.toys[Shout.slug];

// our local refs state
const {
	enableSound,
	shoutSoundId,
	displayDuration,
	showChatterNames,
	chatNameColor,
	chatTextColor,
	chatTextShadow,
	chatTextSize,

} = toy.settings;


// all of the commands system wide are stored in this chrome shallow ref
const commandsRef = chromeShallowRef('commands', {});

// get the command used for tossing items
const shout_command = computed(() => {
       return commandsRef.value.shout__shout?.command || '';
});

</script>
<style lang="scss" scoped>	


</style>
