<!--
	Chat BoxPage.vue
	----------------

	This is the settings page for the Chat Box system.
-->
<template>

	<PageBox
		title="Chat Box Settings"
		:themeColor="toy.static.themeColor"
	>
		<p>
			The Chat Box system allows you to show a customized chat capture on screen.
			However, it also has two special chat commands:
		</p>
		<ul>
			<li>
				<span class="cmd">!{{ shout_command }}</span> - similar to SuperChat but spends channel points.
				Allows a chat message to be played on screen with a sound.
			</li>
			<li>
				<span class="cmd">!{{ swarm_command }} &lt;message&gt;</span> - By itself, does nothing.
				But if a critical number of chatters all start typing 
				<span class="cmd">!{{ swarm_command }} &lt;message&gt;</span> at the same time,
				then the messages will appear randomly on screen, like a swarm of chat.
			</li>
		</ul>
		<SectionHeader title="Command Triggers"/>
		<p>
			Below you can customize the commands that users can type to interact with the Chat system.
		</p>
		<CommandsConfigBox :toy="toy" />
			
		<SectionHeader title="Settings"/>
		<SettingsInputRow
			type="boolean"
			v-model="enableChatBox"
		>
			<h3>Enable Onscreen Chat Box</h3>
			<p>Show chat box on screen mirroring live chat (as opposed to other streaming services)</p>
		</SettingsInputRow>
		<SettingsInputRow
			type="boolean"
			v-model="enableChatBox"
		>
			<h3>Enable Onscreen Chat Box</h3>
			<p>Show chat box on screen mirroring live chat (as opposed to other streaming services)</p>
		</SettingsInputRow>
		<SettingsAssetRow
			v-model="chatBoxImage"
			:kind-filter="'image'"
		>
			<h3>Image Frame</h3>
			<p>Choose Image frame (sliceable in 3x3) for chat box.</p>
		</SettingsAssetRow>
		<SettingsInputRow
			type="boolean"
			v-model="filterCommands"
		>
			<h3>Filter !commands from Chat</h3>
			<p>If using the custom streaming box, filter out the <span class="cmd">!Commands</span>.</p>
		</SettingsInputRow>
		<SettingsInputRow
			type="boolean"
			v-model="showChatterNames"
		>
			<h3>Show Chatter Names</h3>
			<p>Disable to show messages only.</p>
		</SettingsInputRow>
		<SettingsInputRow
			type="color"
			v-model="chatNameColor"
		>
			<h3>User Name Chat Color</h3>
			<p>What color to use for chat's user names?</p>
		</SettingsInputRow>
		<SettingsInputRow
			type="color"
			v-model="chatTextColor"
		>
			<h3>Chat Text Color.</h3>
			<p>What color to use for message text?</p>
		</SettingsInputRow>
		<SettingsAssetRow
			v-model="shoutSoundId"
			:kind-filter="'sound'"
		>
			<h3>Shout Sound</h3>
			<p>What sound effect should play when <span class="cmd">!{{ shout_command }}</span> command is used.</p>
		</SettingsAssetRow>
		<SettingsInputRow
			type="number"
			:min="1"
			v-model="swarmSize"
		>
			<h3>Swarm Size</h3>
			<p>
				If the <span class="cmd">!{{ swarm_command }}</span> command is enabled, how many users need to use it
				in a short period of time for a swarm to start?
			</p>
			<p>The time period can be customized below...</p>
		</SettingsInputRow>
		<SettingsInputRow
			type="number"
			:min="1"
			v-model="swarmDuration"
		>
			<h3>Swarm Time Window</h3>
			<p>
				Used with the above setting, how long of window should be used to
				count the number of users using the <span class="cmd">!{{ swarm_command }}</span> command?
			</p>
			<p>The number of users can be customized above...</p>
		</SettingsInputRow>

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

// our app
import Chat from './Chat';

// fetch the main app state context & our toy
const ctApp = inject('ctApp');
const toy = ctApp.toyManager.toys[Chat.slug];

// our local refs state
const {
	enableChatBox,
	chatBoxImage,
	filterCommands,
	showChatterNames,
	chatNameColor,
	chatTextColor,
	shoutSoundId,
	swarmSize,
	swarmDuration,
} = toy.settings;


// all of the commands system wide are stored in this chrome shallow ref
const commandsRef = chromeShallowRef('commands', {});

// get the command used for tossing items
const shout_command = computed(() => {
	return commandsRef.value.chat__shout?.command || '';
});
const swarm_command = computed(() => {
	return commandsRef.value.chat__swarm?.command || '';
});


</script>
<style lang="scss" scoped>	


</style>
