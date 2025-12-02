<!--
	TwitchPage.vue
	--------------

	Page to show chat reading configuration details for Twitch
-->
<template>

	<PageBox
		title="Twitch Chat Settings"
		themeColor="indigo"
		themeImage="assets/bg_tiles/chatSettings.png"
		bgSize="120px"
		bgThemePos="-10px"
	>
		<br><br>
		<p>
			Use this page to configure twitch chat connection!
		</p>
		<SectionHeader title="Connect Twitch"/>
		<p>
			Unlike YouTube, Twitch has chat read permissions that are tied to your account.
			<br>
			Simply Authenticate with Twitch below, and the app will be able to read chat from any
			of your channels.
		</p>
		<TwitchConnectionManager/>

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
import TwitchConnectionManager from '../TwitchConnectionManager.vue';
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

</style>
