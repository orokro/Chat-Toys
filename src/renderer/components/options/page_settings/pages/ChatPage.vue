<!--
	ChatPage.vue
	------------

	Page to show chat reading configuration details
-->
<template>

	<PageBox
		title="YT Chat Settings"
		themeColor="darkred"
		themeImage="assets/bg_tiles/chatSettings.png"
		bgSize="120px"
		bgThemePos="-10px"
	>
		<br><br>
		<p>
			Use this page to configure the chat sources you want to read commands from.
		</p>
		<SectionHeader title="YT Chat Sources"/>
		<p>
			Below you can add or remove chat sources for the app to read.
			<br>
			<strong>NOTE:</strong> a chat source must be enabled for commands to work!
			<br><br>
			If a live stream ends or chat is disabled, the source will be "unavailable."
			<br>
			You cannot enable an unavailable source.
			<br><br>
			If you wish to use private streams / member only streams, you will need to
			<button type="button" @click="showYouTube">Log Into YouTube</button>
		</p>
		<ChatSourceManager/>

		<SectionHeader title="YT Auto Chat"/>
		<p>
			The following feature is experimental and may not work as expected.
			<br>
			Below you can paste in a link to your YouTube channel page.
			<br>
			If present, the app will attempt to detect when you're live in OBS, and if live,<br>
			attempt to find the latest live stream on your channel and automatically add it as a source.
			<br><br>
			In order to use this feature, you must have already connected ChatToys to OBS via WebSockets in the
			<strong>OBS Connection</strong> tab on the left.
			<br><br>
			<strong>Consider this feature a potential <em>convenience</em> and <u>not</u> a guarantee.
			<br/>If chat isn't working, you may need to manually add your chat source anyway.
			</strong>
		</p>
		<div class="autoChatRow">
				
			<div class="settingsBlock">
				<template v-if="ctApp.obsConnMgr.enabled.value">
					<SettingsRow>
						{{ ctApp.obsConnMgr.isConnected.value ? '✅ Connected to OBS' : '❌ Not Connected to OBS' }}
					</SettingsRow>
					<SettingsRow>
						{{ ctApp.obsConnMgr.isStreaming.value ? '✅ OBS is Streaming' : '❌ OBS is Not Streaming' }}
					</SettingsRow>
					<SettingsRow>
						{{ ctApp.ytConnMgr.isScanning.value ?  '🔄 Scanning for YouTube Stream Info...' : '⏸️ Not Scanning for YouTube chats' }}
					</SettingsRow>
				</template>
				<template v-else>
					<SettingsRow>
						OBS Connection is Disabled, so Auto Chat cannot function.
					</SettingsRow>
				</template>
				<SettingsInputRow
					type="boolean"
					v-model="ctApp.ytConnMgr.enabled.value"
				>
					<template #title>Enable Auto Chat Mode</template>
					<p>
						Enable if you want ChatToys to automatically find your YouTube live chat when it detects OBS is live.
					</p>
				</SettingsInputRow>
				<SettingsRow
				>
					<h3>Channel URL</h3>
					<p>
						Paste your Channel's page URL here.
					</p>
					<input
						type="text"
						id="autoChat"
						v-model="ctApp.ytConnMgr.channelUrl.value"
						placeholder="https://www.youtube.com/@YourChannelName"
					/>
				</SettingsRow>
				<SettingsInputRow
					type="boolean"
					v-model="ctApp.ytConnMgr.deleteOnOffline.value"
				>
					<template #title>Delete Chat Sources when Offline</template>
					<p>
						If enabled, ChatToys will remove any chat sources it added automatically when you go offline in OBS.
					</p>
				</SettingsInputRow>
				<SettingsRow>
					Click Below to search for a live stream on your channel NOW:
					<div class="buttonBox">
						<button				
							@click="ctApp.ytConnMgr.checkNow()"
						><!-- :disabled="!ctApp.ytConnMgr.canManualScan.value" -->
							Scan for Live Stream
						</button>
					</div>
				</SettingsRow>				
				<SettingsRow>
					Connecting Status:
					<div class="ytStatusBox">
						{{ ctApp.ytConnMgr.statusMessage.value }}
					</div>
				</SettingsRow>
			</div>

		</div>

		<SectionHeader title="Live Raw Chat (All Sources)"/>
		<p>
			Below you can see the live data that comes in from chatters.
			<br>
			You don't need to know how to read this, and you don't need to do anything with it.
			<br>
			You can just peruse the data as it flows in, or check if anything is coming it at all.
			<br>
			If nobody is in your chat, you can post a message in your own chat and see if it shows up here to make sure all systems are working.
			<br>
		</p>
		
		<RawLogPreview
			:messages="ctApp.chatProcessor.screenMessages.value"
		/>
		
		<SectionHeader title="Video Help"/>
		<YTVideoBox 
			url="https://youtu.be/hd7dndoe8X4"
			width="100%"
		/>
	</PageBox>

</template>
<script setup>

// vue
import { ref, computed,	inject } from 'vue';
import { chromeShallowRef } from '@scripts/chromeRef';

// components
import PageBox from '../../PageBox.vue';
import SectionHeader from '../../SectionHeader.vue';
import InfoBox from '../../InfoBox.vue';
import CatsumIpsum from '../../../CatsumIpsum.vue';
import RawLogPreview from '../RawLogPreview.vue';
import ChatSourceManager from '../ChatSourceManager.vue';
import SettingsInputRow from '@components/options/SettingsInputRow.vue';
import SettingsRow from '@components/options/SettingsRow.vue';
import YTVideoBox from '@components/YTVideoBox.vue';

// fetch the main app state context
const ctApp = inject('ctApp');

function showYouTube(){
	window.open("https://youtube.com");
}

</script>
<style lang="scss" scoped>	

	// row for setting up the auto chat
	.autoChatRow {

		// input box for channel
		#autoChat {
			width: 100%;
			max-width: 600px;
			height: 35px;

			padding: 5px 20px;
			border: 2px solid black;
			border-radius: 5px;
			box-shadow: inset 1px 1px 3px rgba(0, 0, 0, 0.5);

			// text settings
			font-family: 'Courier New', Courier, monospace;
		
		}// #autoChat

		.obsStatus {
			margin-top: 20px;
			font-size: 18px;
			font-weight: bold;

			// default status
			.status {
				color: #FF0000;
				background-color: #000000;
				padding: 5px 10px;
				border-radius: 5px;
				font-weight: bold;
			}

			// live status
			.status.live {
				color: #00FF00;
				background-color: #000000;
			}

		}// .obsStatus

	}// .autoChatRow

	// make buttons look pretty
	button {

		// nice padding, rounded corners, and pointer cursor
		padding: 5px 10px;
		border-radius: 5px;
		cursor: pointer;

		// nice vertical gradient
		background: linear-gradient(180deg, #e96c6c, #ff0000);
		text-transform: uppercase;
		color: white;
		font-weight: bolder;

		&:disabled {
			pointer-events: none;
			opacity: 0.5;
			cursor: not-allowed;
		}

		// mm that primary tho
		&.primary {
			background: linear-gradient(180deg, #05dee2, #00ABAE);
			font-weight: bolder;
			color: white;
		}

		&:hover {
			background: linear-gradient(180deg, #05dee2, #00ABAE);
		}

	}// button


	// shows status message as obs tries to connect
	.ytStatusBox {

		margin-top: 10px;
		padding: 10px;
		border: 1px solid #4444aa;
		border-radius: 5px;
		background-color: #222244;
		color: white;
		font-family: monospace;
		font-size: 14px;

	}// .ytStatusBox {

</style>
