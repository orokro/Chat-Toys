<!--
	VTubeStudioPage.vue
	-------------------

	Page to show chat reading configuration details for VTubeStudio
-->
<template>

	<PageBox
		title="VTubeStudio Chat Settings"
		themeColor="#F9A0B0"
		themeImage="assets/bg_tiles/vts.png"
		bgSize="120px"
		bgThemePos="-25px"
	>
		<br><br>
		<p>
			Use this page to configure the optional VTubeStudio integration.
		</p>
		<p>
			Specifically, the tosser-system can work in pure OBS mode, where it's a browser source, or you can use the VTSTosser toy, 
			which tosses items inside VTubeStudio directly & can follow your model around for collision.
		</p>
		<p>
			In the future, other toys & widgets may also integrate with VTubeStudio for enhanced functionality.
		</p>
		
		<SectionHeader title="VTubeStudio Websockets Connection"/>

		<div class="settingsBlock">
			<template v-if="ctApp.vtsConnMgr.enabled.value">
				<SettingsRow>
					{{ ctApp.vtsConnMgr.isConnected.value ? '✅ Connected to VTubeStudio!' : '❌ Not Connected to VTubeStudio' }}
				</SettingsRow>
				<SettingsRow>
					{{ ctApp.vtsConnMgr.isAuthenticated.value ? '✅ Plugin Authenticated in VTS' : '❌ Plugin Not Authenticated' }}
				</SettingsRow>
			</template>
			<template v-else>
				<SettingsRow>
					VTubeStudio Connection is Disabled.
				</SettingsRow>
			</template>

			<SettingsInputRow
				type="boolean"
				v-model="ctApp.vtsConnMgr.enabled.value"
			>
				<template #title>Enable VTubeStudio Connection</template>
				<p>Set this on if you wish to try to connect to VTubeStudio,
					so ChatToys can find your live YouTube chat when you go live.</p>
			</SettingsInputRow>
			<SettingsInputRow
				type="number"
				v-model="ctApp.vtsConnMgr.port.value"
			>
				<template #title>VTS WS Port Number</template>
				<p>The port number from your VTubeStudio Websockets plugin setup.</p>
			</SettingsInputRow>
			<SettingsRow>
				Connecting Status:
				<div class="vtsStatusBox">
					{{ ctApp.vtsConnMgr.statusMessage.value }}
				</div>
			</SettingsRow>
		</div>

		<SectionHeader title="Errors Log"/>
		<p>
			In order to interact with VTubeStudio, often times files need to be moved into it's	StreamAssets folder.
			If something doesn't appear, or the connection fails, you can see the errors logged below.
		</p>
		
		<RawLogPreview
			:messages="ctApp.vtsConnMgr.logs.value"
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

		// shows status message as obs tries to connect
		.vtsStatusBox {

			margin-top: 10px;
			padding: 10px;
			border: 1px solid #4444aa;
			border-radius: 5px;
			background-color: #222244;
			color: white;
			font-family: monospace;
			font-size: 14px;

		}// .vtsStatusBox

</style>
