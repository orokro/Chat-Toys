<!--
	OutputLogPage.vue
	-----------------

	This is the settings page for the Output Log system.
-->
<template>

	<PageBox
		title="Output Log Settings"
		:themeColor="toy.static.themeColor"
		themeImage="assets/bg_tiles/log.png"
		bgSize="140px"
		bgThemePos="40px"
	>
		<div class="picBox" :style="{ height: '350px',}">
			<img src="/assets/chat_solid/log.png" height="300px" style="float:right"/>
		</div>
		<br><br>
		<p>
			This "toy" is really just a widget to show output from the Chat Toys system.
			<br>
			<br>
			For example:
		</p>
		<ul>
			<li>
				The <span class="cmd">!{{ me_command }}</span> command from the Channel Points
				will show the chatters total points on screen in the log.
			</li>
			<li>
				If a user types a command incorrectly, an error will be display on screen in the log.
			</li>
			<li>
				If a user doesn't have enough points, or a command is on cool-down, a message will be logged.
			</li>
			<li>
				If a user spins the prize wheel, the result it landed on will be added to the log.
			</li>
		</ul>
		<p>
			In short, the log box is an essential widget to show users feed back from the system - BUT it
			is technically optional.
		</p>
		<p>
			Below is a command, <span class="cmd">!{{ echo_command }} &lt;message&gt;</span> that allows chat to print
			a message to the log box. Realistically, this is pretty pointless and mostly just for testing.
			<br><br>
			There's no real reason to tell your viewers that this command exists, and probably makes sense
			just to leave it disabled.
		</p>

		<SectionHeader title="Command Triggers"/>
		<p>
			Below you can customize the commands that users can type to interact with the Log system.
		</p>
		<CommandsConfigBox :toy="toy" />
		
		<WidgetSection :toy="toy" />
		
		<SectionHeader title="Settings"/>
		<div class="settingsBlock">
			<SettingsInputRow
				type="color"
				v-model="logTextColor"
			>
				<template #title>Text Color</template #title>
				<p>The color to render the log text on the log widget.</p>
			</SettingsInputRow>

			<SettingsInputRow
				type="boolean"
				v-model="showLogBG"
			>
				<template #title>Show Log Background</template #title>
				<p>Should there be a background box rendered behind the log text, or just the log text?</p>
			</SettingsInputRow>
			<SettingsInputRow
				type="color"
				v-model="logBGColor"
			>
				<template #title>Background Color</template #title>
				<p>If the log box background is enabled, what color should it be?</p>
			</SettingsInputRow>
			<SettingsInputRow
				type="float"
				:min="0.1"
				:max="1.0"
				:step="0.1"
				v-model="logBGOpacity"
			>
				<template #title>Background Opacity</template #title>
				<p>
					Again, if the log box background is enabled, what opacity should it be?
				</p>
			</SettingsInputRow>
		</div>
		<CatsumIpsum :paragraphs="1" :sentences="10" :brOnly="true"/>
	</PageBox>

</template>
<script setup>

// vue
import { ref, shallowRef, computed, inject, watch } from 'vue';
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

// our app
import OutputLog from './OutputLog';

// fetch the main app state context & our toy
const ctApp = inject('ctApp');
const toy = ctApp.toyManager.toys[OutputLog.slug];

// our local refs state
const {
	showLogBG,
	logBGColor,
	logBGOpacity,
	logTextColor,
	logWidgetBox,
} = toy.settings;


// all of the commands system wide are stored in this chrome shallow ref
const commandsRef = chromeShallowRef('commands', {});

// get the command used for tossing items
const echo_command = computed(() => {
	return commandsRef.value.log__echo?.command || '';
});
const me_command = computed(() => {
	return commandsRef.value.channelPoints__me?.command || '';
});

</script>
<style lang="scss" scoped>	

</style>
