<!--
	ChannelPointsPage.vue
	---------------------

	This is the settings page for the channel points system.
-->
<template>

	<PageBox
		title="Channel Points"
		themeColor="#EED43A"
		class="channelPointsPage"
	>
		<p>
			While optional, the Channel Points system is the best way to leverage the various other toys in this system.

			<InfoBox icon="warning">
				NOTE: if you don't have Channel Points enabled, the "Cost" field in the commands will be ignored for all other toys.
			</InfoBox>

			However, unlike other popular streaming sites, this plugin system works a bit differently. We cannot show individual redemptions on each chatters screen. (That would require every chatter to install a corresponding plugin as well as server infrastructure to handle the data.)
			<br/><br/>
			This plugin works entirely on the streamer's <i>(i.e. your)</i> computer.
			<br/><br/>
			So instead, we can periodically show a graphic on the browser-capture window that indicates it's time for users to collect points. When it's visible users can type a command such as <span class="cmd">!{{ claimCommand }}</span> to have points added to their profile. Again, because we cannot store stuff in the cloud and display points on each chatters screen, instead we can show the current points via a ticker in the browser-capture window. Depending on the settings below, you can control the behavior of this system to make it more or less competitive.
			<br/><br/>
			For example, you can control:
		</p>
		<ul>
			<li>How often the opportunity to gain points is shown</li>
			<li>How long it stays on screen (regardless of users attempt to get them)</li>
			<li>How many points are given per <span class="cmd">!{{ claimCommand }}</span></li>
			<li>How many users can claim the points before it disappears</li>
		</ul>
		
		<SectionHeader title="Command Triggers"/>
		<p>
			Below you can customize the commands that users can type to interact with the Channel Points system.
		</p>
		<CommandsConfigBox
			:toyName="'Channel Points'"
			:toySlug="ChannelPoints.slug"
			:commands="commands"
		/>
		
		<SectionHeader title="Settings"/>

		<SettingsInputRow
			type="number"
			:min="1"
			v-model="claimInterval"
		>
			<h3>Claim Interval</h3>
			<p>How often should the option to appear to collect channel points? This setting is in seconds.</p>
			<p>(60 = 1 minute, 300 = 5 minutes, 600 = 10 minutes, etc.)</p>
			<p>If this value is set to 0, the optional is basically always available, not recommended.</p>
		</SettingsInputRow>

		<SettingsInputRow
			type="number"
			:min="0"
			v-model="claimRandomness"
		>
			<h3>Claim Randomness</h3>
			<p>Add random time to prevent users attempting to set a timer and snipe the points opportunity.</p>
			<p>Default is 0 (no randomness)</p>
			<p>A random amount of seconds will be ADDED to the above Claim Interval setting.</p>
		</SettingsInputRow>

		<SettingsInputRow
			type="number"
			:min="10"
			v-model="claimDuration"
		>
			<h3>Claim Duration</h3>
			<p>How long should the claim-offer appear on screen for?</p>
			<p>(60 = 1 minute, 300 = 5 minutes, 600 = 10 minutes, etc.)</p>
			<p>The default is 1 minute. The minimum is 10 seconds but keep in mind stream latency.</p>
			<p><strong>NOTE: users can technically claim more than once, to prevent this make the user cool down longer than claim duration!</strong></p>		
		</SettingsInputRow>

		<SettingsInputRow
			type="number"
			:min="1"
			v-model="pointsPerClaim"
		>
			<h3>Pay Out</h3>
			<p>How many points should a chatter receive for a successful claim?</p>
			<p>The default is 100, but you can make your your economy however you like.</p>		
		</SettingsInputRow>

		<SettingsInputRow
			type="number"
			:min="0"
			v-model="maxClaims"
		>
			<h3>Max Claims</h3>
			<p>When the claim opportunity appears, how many users can claim successfully before it goes away?</p>
			<p>The default is set to '0' which means unlimited claims during the claim duration.</p>
			<p><strong>NOTE: if claims run out, the graphic will disappear even if more time was available!</strong></p>
		</SettingsInputRow>

		<SettingsInputRow
			type="boolean"
			v-model="showTimerBar"
		>
			<h3>Show Timer Bar</h3>
			<p>Should a timer bar be shown on the screen to indicate how much time is left to claim?</p>
		</SettingsInputRow>

		<SettingsInputRow
			type="boolean"
			v-model="showClaimsRemaining"
		>
			<h3>Show Claims Remaining</h3>
			<p>Should a counter be shown on the screen to indicate how many claims are left?</p>
		</SettingsInputRow>

		<SettingsInputRow
			type="boolean"
			v-model="showUserClaims"
		>
			<h3>Show User Claims</h3>
			<p>Show the user names of successful claims near the graphic.</p>
		</SettingsInputRow>


		<SettingsInputRow
			type="boolean"
			v-model="showTextPrompt"
		>
			<h3>Show Text Prompt</h3>
			<p>Should a prompt be shown on the screen to indicate how to claim?</p>
		</SettingsInputRow>

		<SettingsInputRow
			type="color"
			v-model="widgetColorTheme"
		>
			<h3>Widget Color Theme</h3>
			<p>What color should the widget be?</p>
		</SettingsInputRow>

		<SettingsAssetRow
			v-model="widgetIconId"
			:kind-filter="'image'"
		>
			<h3>Channel Points Icon Image</h3>
			<p>Choose an icon to show on the widget.</p>
		</SettingsAssetRow>

		<SectionHeader title="Widget Preview"/>
		<p>Below is an example of the points widget as it will appear on the stage.</p>
		<div class="previewBox">

			<ChannelPointsWidget
				:demoMode="true"
			/>
			
		</div>
		<CatsumIpsum :paragraphs="1" :sentences="10" :brOnly="true"/>
	</PageBox>

</template>
<script setup>

// vue
import { ref, watch, computed, shallowRef, inject } from 'vue';
import { chromeRef, chromeShallowRef } from '../../scripts/chromeRef';

// components
import PageBox from '@components/options/PageBox.vue';
import SectionHeader from '@components/options/SectionHeader.vue';
import InfoBox from '@components/options/InfoBox.vue';
import CommandsConfigBox from '@components/options/CommandsConfigBox.vue';
import CatsumIpsum from '@components/options/../CatsumIpsum.vue';
import SettingsInputRow from '@components/options/SettingsInputRow.vue';
import SettingsAssetRow from '@components/options/SettingsAssetRow.vue';
import ChannelPointsWidget from './ChannelPointsWidget.vue';

// our app
import ChannelPoints from './ChannelPoints';

// fetch the main app state context & our toy
const ctApp = inject('ctApp');
const toy = ctApp.toyManager.toys[ChannelPoints.slug];

// our local ref settings for this system
const {
	claimInterval,
	claimRandomness,
	claimDuration,
	pointsPerClaim,
	maxClaims,
	showTimerBar,
	showClaimsRemaining,
	showUserClaims,
	showTextPrompt,
	widgetColorTheme,
	widgetIconId,
	widgetIconPath,
	widgetBox
} = ctApp.toyManager.toys[toy.slug].settings;


// we'll define our commands here
// NOTE: these are the DEFAULTS, the actual commands will be loaded from storage
// in the CommandsConfigBox component
const commands = toy.commands;


// update the icon path dynamically when the asset ID changes
watch (widgetIconId, (newVal) => {
	const fileData = ctApp.assetsMgr.getFileData(newVal);
	setTimeout(()=>{
		widgetIconPath.value = `builtin/${fileData.name}`;
	});
});


// all of the commands system wide are stored in this chrome shallow ref
const commandsRef = chromeShallowRef('commands', {});

// get the command used for claiming points
const claimCommand = computed(() => {
	return commandsRef.value.channelPoints_get?.command || '';
});

</script>
<style lang="scss" scoped>	

	// main page scoping
	.channelPointsPage {

		// random area where we'll show the widget over a bg image
		.previewBox {

			width: 600px;
			height: 400px;
			border: 2px solid black;
			border-radius: 10px;

			background-image: url('../assets/channel_points/demo_bg.png');

			// flex center
			display: flex;
			justify-content: center;
			align-items: center;

		}// .previewBox

	}// .chanelPointsPage

</style>
