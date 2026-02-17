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
		themeImage="assets/bg_tiles/main.png"
		bgSize="120px"
		bgThemePos="-25px"
	>
		<div class="picBox" :style="{ height: '200px',}">
			<img src="/assets/icons/bttv.png" height="150px" style="float:right" v-if="hasBttvIcon"/>
		</div>

		<br><br>
		<p>
			BetterTTV (BTTV) adds extra emojis to Twitch chat. 
			Enable this integration to allow Chat-Toys to recognize and display BTTV global and channel-specific emojis.
		</p>
		<p>
			For more information, visit <span class="fakeLink" @click="openLink('https://betterttv.com/')">betterttv.com</span>.
		</p>
		
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
		</div>

		<SectionHeader title="Channel Emojis"/>
		<p>
			Enter Twitch <strong>Numerical Channel IDs</strong> below to pull custom BTTV emojis for those specific channels.
			You can find a user's ID using tools like <span class="fakeLink" @click="openLink('https://www.streamweasels.com/tools/convert-twitch-username-to-id/')">StreamWeasels</span>.
		</p>

		<div class="settingsBlock">
			<SettingsRow>
				<h3>Extra Twitch Channels</h3>
				<p>Add Twitch IDs (e.g., "123456") to load their custom BTTV emotes.</p>
				
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

// fetch the main app state context
const ctApp = inject('ctApp');

// settings refs
const bttvEnabled = ctApp.bttvMgr.enabled;
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

</style>
