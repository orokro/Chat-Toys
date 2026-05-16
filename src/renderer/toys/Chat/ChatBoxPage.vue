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
		<p>The Chat Box widget lets you display live chat on your stream.</p>
		<p>This will mix together chat from all enabled chat sources (YouTube, Twitch, etc.)</p>
		<p>The advantage of this widget is that it can also display messages about users commands,
			giving real time feed back. It also shows how many points users have by their names.
		</p>
		<p>While you don't _have_ to use this chat widget, it's built in system features make the
			overall channel points experience better for your viewers.
		</p>
		<!-- <SectionHeader title="Command Triggers"/>
		<p>
			Below you can customize the commands that users can type to interact with the Swarm system.
		</p>
		<CommandsConfigBox :toy="toy" /> -->
		
		<WidgetSection :toy="toy" />
		
		<SectionHeader title="Settings"/>

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
				type="boolean"
				v-model="groupUserMessages"
			>
				<template #title>Group Recent Messages</template>
				<p>If the last set of messages are from the same user, they'll be grouped into one message.</p>
			</SettingsInputRow>
			<SettingsInputRow
				type="boolean"
				v-model="showChatterPoints"
			>
				<template #title>Show Chatter Points</template>
				<p>Users channel points will be displayed next to their name in the chat box.</p>
			</SettingsInputRow>

			<!-- Consolidated text-style settings (username color / text color
				 / font size / shadow). All four used to be inline rows; now
				 they live behind the "..." in the SettingsTextRow. -->
			<SettingsTextRow
				v-for="group in toy.static.textSettings"
				:key="group.groupKey"
				:toy="toy"
				:groupKey="group.groupKey"
			/>
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
			<SettingsInputRow
				type="boolean"
				v-model="cachePFPImages"
			>
				<template #title>Cache Profile Pictures</template>
				<p>
					Enable to cache profile pictures locally for faster loading and less bandwidth.
					<br/>
					<br/>
					Recommended to keep this on unless you have a specific reason not to.
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
					style="resize: vertical; width: 100%; font-family: monospace;"
					placeholder=""
					@keydown.tab.prevent="insertTabInTheme"
				/>
			
			</SettingsRow>

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
import SettingsTextRow from '@components/options/SettingsTextRow.vue';
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
	cachePFPImages,
	groupUserMessages,
	showChatterPoints,
} = toy.settings;


// all of the commands system wide are stored in this chrome shallow ref
const commandsRef = chromeShallowRef('commands', {});

function insertTabInTheme(event) {
	const textarea = event.target
	if (!textarea) return

	const start = textarea.selectionStart
	const end = textarea.selectionEnd
	const value = textarea.value

	// insert tab at current selection
	textarea.value =
		value.slice(0, start) + "\t" + value.slice(end)

	// move caret after the tab
	textarea.selectionStart = textarea.selectionEnd = start + 1

	// keep v-model in sync without Vue re-rendering the DOM value
	textarea.dispatchEvent(new Event("input"))
}

</script>
<style lang="scss" scoped>	


</style>
