<!--
	BTTVPage.vue
	------------

	Page to show settings for BTTV integration.
	Allows enabling the service and adding extra Twitch channel IDs
	to pull custom emojis from.
-->
<template>

	<PageBox
		title="BTTV Integration Settings"
		themeColor="#CC4444"
		themeImage="assets/bg_tiles/bttv.png"
		bgSize="120px"
		bgThemePos="0px"
	>
		<div class="picBox" :style="{ height: '200px',}">
			<img src="/assets/icons/bttv.png" height="150px" style="float:right" v-if="hasBttvIcon"/>
		</div>

		<br><br>
		<p>
			BetterTTV (BTTV) adds extra emojis to the ChatToys system.
			Enable this integration to allow Chat-Toys to recognize and display BTTV global and channel-specific emojis.
		</p>
		<p>
			For more information, visit <span class="fakeLink" @click="openLink('https://betterttv.com/')">betterttv.com</span>.
		</p>

		<InfoBox icon="lightbulb">
			<strong>NOTE:</strong> BTTV Support in ChatToys is still experimental.
			<br><br>
			<p>BTTV Emotes currently don't work in the Tosser system.</p>
		</InfoBox>
		
		<SectionHeader title="Connection Status"/>

		<div class="settingsBlock">
			<SettingsRow>
				BTTV Integration Status:
				<div class="statusBox" :class="{ enabled: bttvEnabled }">
					{{ ctApp.bttvMgr.statusMessage.value }}
				</div>
			</SettingsRow>

			<SettingsInputRow
				type="boolean"
				v-model="bttvEnabled"
			>
				<template #title>Enable BTTV Integration</template>
				<p>When enabled, Chat-Toys will fetch global BTTV emojis and cache them locally.</p>
			</SettingsInputRow>

			<SettingsInputRow
				type="boolean"
				v-model="useGlobal"
			>
				<template #title>Use Global BTTV Emojis</template>
				<p>When enabled, Chat-Toys will fetch and use the standard global BTTV emojis.</p>
			</SettingsInputRow>
		</div>

		<SectionHeader title="Enabled BTTV Emojis"/>
		<p>
			The grid below shows all BTTV emojis currently active in the system.
		</p>
		<EnabledBTTVList />

		<SectionHeader title="Browse & Search Shared Emojis"/>
		<p>
			Browse or search for shared BTTV emojis. Check an emoji to enable it permanently in Chat-Toys.
		</p>
		<BTTVBrowser />

		<SectionHeader title="Channel Emojis"/>
		<p>
			Enter Twitch <strong>Numerical Channel IDs</strong> below to pull custom BTTV emojis for those specific channels.
			You can find a user's ID using tools like <span class="fakeLink" @click="openLink('https://www.streamweasels.com/tools/convert-twitch-username-%20to-user-id/')">StreamWeasels</span>.
		</p>

		<div class="settingsBlock">
			<SettingsRow>
				<h3>Extra Twitch Channels</h3>
				<p>Add Twitch IDs (e.g., "123456") to load their custom BTTV emotes.</p>
				
				<div class="refresh-container">
					<button class="refresh-btn" @click="ctApp.bttvMgr.refreshChannels()">
						<span class="material-icons">refresh</span>
						Refresh Channel Emojis
					</button>
					<p class="small">Forces a reload of all custom channel emotes (bypasses cache).</p>
				</div>
				<br>

				<ArrayEdit
					v-model="twitchChannels"
					:component="ArrayTextInput"
					:schema="channelIdSchema"
					:createItem="() => ''"
				/>
			</SettingsRow>
		</div>

		<SectionHeader title="Output Log"/>
		<p>
			Logs related to fetching and caching BTTV emoji data.
		</p>
		
		<RawLogPreview
			:messages="ctApp.bttvMgr.logs.value"
		/>
	</PageBox>

</template>
<script setup>

// vue
import { ref, computed, inject, onMounted } from 'vue';
import * as yup from 'yup';

// components
import PageBox from '../../PageBox.vue';
import SectionHeader from '../../SectionHeader.vue';
import SettingsInputRow from '@components/options/SettingsInputRow.vue';
import SettingsRow from '@components/options/SettingsRow.vue';
import ArrayEdit from '@components/options/ArrayEdit.vue';
import ArrayTextInput from '@components/options/ArrayTextInput.vue';
import RawLogPreview from '../RawLogPreview.vue';
import EnabledBTTVList from '../EnabledBTTVList.vue';
import BTTVBrowser from '../BTTVBrowser.vue';
import InfoBox from '@components/options/InfoBox.vue';

// fetch the main app state context
const ctApp = inject('ctApp');

// settings refs
const bttvEnabled = ctApp.bttvMgr.enabled;
const useGlobal = ctApp.bttvMgr.useGlobal;
const twitchChannels = ctApp.bttvMgr.twitchChannels;

// validation schema for twitch IDs (numeric strings)
const channelIdSchema = yup.string().matches(/^[0-9]+$/, 'Twitch ID must be numeric');

// check if we have a bttv icon to show
const hasBttvIcon = ref(false);
onMounted(async () => {
	// we could check if the file exists, but for now we'll just assume it might not
	// and gracefully handle it. Usually it would be in src/renderer/assets/icons/bttv.png
});

/**
 * Open a link in the default browser
 * 
 * @param url {string} - The URL to open
 */
const openLink = (url) => {
	window.electronAPI.openExternal(url);
};

</script>
<style lang="scss" scoped>	

	.fakeLink {
		display: inline;
		color: rgb(0, 170, 255);
		font-weight: bold;
		cursor: pointer;
		
		&:hover {
			text-decoration: underline;
		}    
	
	}// .fakeLink

	.statusBox {
		margin-top: 10px;
		padding: 10px;
		border: 1px solid #444;
		border-radius: 5px;
		background-color: #222;
		color: #eee;
		font-family: monospace;
		font-size: 14px;

		&.enabled {
			border-color: #00aa00;
			background-color: #002200;
		}
	}

	.settingsBlock {
		margin-bottom: 30px;
	}

	.refresh-container {
		margin-top: 20px;
		display: flex;
		flex-direction: column;
		gap: 5px;

		.refresh-btn {
			align-self: flex-start;
			display: flex;
			align-items: center;
			gap: 8px;
			background: #222;
			color: #eee;
			border: 2px solid #444;
			border-radius: 20px;
			padding: 8px 16px;
			cursor: pointer;
			font-weight: bold;
			
			.material-icons {
				font-size: 18px;
			}

			&:hover {
				background: #333;
				border-color: #eee;
			}
		}

		.small {
			font-size: 12px;
			color: #888;
			margin: 0;
		}
	}

</style>
