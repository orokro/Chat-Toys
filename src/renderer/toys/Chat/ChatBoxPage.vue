<!--
	ChatBoxPage.vue
	---------------

	This is the settings page for the Chat Box system.
-->
<template>

	<PageBox
		title="Chat Box Settings"
		:themeColor="toy.static.themeColor"
		themeImage="assets/bg_tiles/chat.png"
		bgSize="140px"
		bgThemePos="40px"
	>
		<div class="picBox" :style="{ height: '350px',}">
			<img src="/assets/chat_solid/chat.png" height="300px" style="float:right"/>
		</div>
		<br><br>
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
		
		<WidgetSection :toy="toy" />
		
		<SectionHeader title="Settings"/>

		<h2>Chat Box Settings</h2>
		<div class="settingsBlock">

			<!-- 
				This setting is now deprecated - it was part of the old Layout system. 
			 
				Since the old system showed all active widgets, it might have been desirable
				to turn off the chat widget. But the new system uses individual widget sources,
				so this setting is no longer needed.

				Leaving the code commented out for now in case we want to re-enable it later.

				<SettingsInputRow
					type="boolean"
					v-model="enableChatBox"
				>
					<template #title>Enable Onscreen Chat Box</template>
					<p>Show chat box on screen mirroring live chat (as opposed to other streaming services)</p>
				</SettingsInputRow>
			-->
			<SettingsInputRow
				type="boolean"
				v-model="enableChatBoxImage"
			>
				<template #title>Enable Chat Box BG Image</template>
				<p>Use the image below to frame the chat box.</p>
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
				<template #title>Filter !commands from Chat</template>
				<p>Filter out the <span class="cmd">!commands</span> from the Chat widget.</p>
			</SettingsInputRow>
			<SettingsInputRow
				type="boolean"
				v-model="showChatterNames"
			>
				<template #title>Show Chatter Names</template>
				<p>Disable to show messages only.</p>
			</SettingsInputRow>
			<SettingsInputRow
				type="boolean"
				v-model="showChatterPFP"
			>
				<template #title>Show Chatter Profile Pictures</template>
				<p>Enable to show user profile pictures next to their messages.</p>
			</SettingsInputRow>
			<SettingsInputRow
				type="number"
				:min="16"
				:max="256"
				:step="1"
				v-model="pfpSize"
			>
				<template #title>Profile Picture Size</template>
				<p>Size (in pixels) for user profile pictures in chat.</p>
			</SettingsInputRow>

			<SettingsInputRow
				type="boolean"
				v-model="messageOnNewLine"
			>
				<template #title>Message On New Line</template>
				<p>Enable to show message text on a new line under the name, rather than inline.</p>
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
				<template #title>Chat Text Color.</template>
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
			<SettingsInputRow
				type="boolean"
				v-model="showSystemMessages"
			>
				<template #title>Show System Messages</template>
				<p>
					Enable to show system messages (like when users list their points, or win prizes on the prize wheel, etc.) in chat.
					<br/>
					<br/>
					It is highly recommended to keep this on - these messages help provide context to chatters.
				</p>
			</SettingsInputRow>
			<SettingsRow>
				<h3>Custom Theme Code</h3>
				<p>
					If you have custom theme code (JSON+CSS) you can paste it below.
					<br/>
					NOTE: custom themes can potentially overwrite the other chat box settings above.
				</p>
				<textarea 
					v-model="customChatTheme" 
					rows="10" 
					style="resize: none; width:100%; font-family: monospace;"
					placeholder=''
				></textarea>
			
			</SettingsRow>

		</div>

		<br/>
		<h2>Shout Widget Settings</h2>
		<div class="settingsBlock">
			<SettingsAssetRow
				v-model="shoutSoundId" 
				:kind-filter="'sound'"
			>
				<h3>Shout Sound</h3>
				<p>What sound effect should play when <span class="cmd">!{{ shout_command }}</span> command is used.</p>
			</SettingsAssetRow>
		</div>

		<br/>
		<h2>Swarm Widget Settings</h2>
		<div class="settingsBlock">
			<SettingsInputRow
				type="number"
				:min="1"
				v-model="swarmSize"
			>
				<template #title>Swarm Size</template>
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
				<template #title>Swarm Time Window</template>
				<p>
					Used with the above setting, how long of window should be used to
					count the number of users using the <span class="cmd">!{{ swarm_command }}</span> command?
				</p>
				<p>The number of users can be customized above...</p>
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
import Chat from './Chat';

// fetch the main app state context & our toy
const ctApp = inject('ctApp');
const toy = ctApp.toyManager.toys[Chat.slug];

// our local refs state
const {
	enableChatBox,
	enableChatBoxImage,
	chatBoxImage,
	filterCommands,
	showChatterNames,
	showChatterPFP,
	pfpSize,
	messageOnNewLine,
	customChatTheme,
	chatNameColor,
	chatTextColor,
	chatTextShadow,
	chatTextSize,
	showSystemMessages,
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
