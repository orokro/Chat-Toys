<!--
	ChannelPointsPage.vue
	---------------------

	This is the settings page for the channel points system.
-->
<template>

	<PageBox
		title="Channel Points"
		themeColor="#EED43A"
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
			So instead, we can periodically show a graphic on the browser-capture window that indicates it's time for users to collect points. When it's visible users can type a command such as <span class="cmd">!get</span> to have points added to their profile. Again, because we cannot store stuff in the cloud and display points on each chatters screen, instead we can show the current points via a ticker in the browser-capture window. Depending on the settings below, you can control the behavior of this system to make it more or less competitive.
			<br/><br/>
			For example, you can control:
		</p>
		<ul>
			<li>How often the opportunity to gain points is shown</li>
			<li>How long it stays on screen (regardless of users attempt to get them)</li>
			<li>How many points are given per "!points"</li>
			<li>How many users can claim the points before it disappears</li>
		</ul>
		
		<SectionHeader title="Command Triggers"/>
		<p>
			Below you can customize the commands that users can type to interact with the Channel Points system.
		</p>
		<CommandsConfigBox
			:optionsApp="optionsApp"
			:toyName="'Channel Points'"
			:toySlug="toySlug"
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

		<SectionHeader title="CatsumIpsum"/>
		<CatsumIpsum :paragraphs="5" :sentences="10"/>
	</PageBox>

</template>
<script setup>

// vue
import { ref, watch } from 'vue';

// components
import PageBox from '../../PageBox.vue';
import SectionHeader from '../../SectionHeader.vue';
import InfoBox from '../../InfoBox.vue';
import CommandsConfigBox from '../../CommandsConfigBox.vue';
import CatsumIpsum from '../../../CatsumIpsum.vue';
import SettingsInputRow from '../../SettingsInputRow.vue';

// generate slug for command
const toySlug = 'channel_points';
const slugify = (text) => (toySlug + '_' + text.toLowerCase());

// our settings for this system
const claimInterval = ref(5);
const claimDuration = ref(60);
const pointsPerClaim = ref(100);
const maxClaims = ref(5);

watch(claimInterval, (val) => {
	console.log('claimInterval', val);
});

const props = defineProps({
	
	// reference to the state of the options page
	optionsApp: {
		type: Object,
		default: null
	}
});

// we'll define our commands here
// NOTE: these are the DEFAULTS, the actual commands will be loaded from storage
// in the CommandsConfigBox component
const commands = [
	{
		slug: slugify('get'),
		command: 'get',
		params: null,
		description: 'Claim points',
		enabled: true,
		costEnabled: false,
		cost: 0,
		coolDown: 0,
		groupCoolDown: 0,
	},	
	{
		slug: slugify('show'),
		command: 'me',
		params: null,
		description: 'Have on screen text show your points',
		enabled: true,
		costEnabled: false,
		cost: 0,
		coolDown: 0,
		groupCoolDown: 0,
	},
	{
		slug: slugify('give'),
		command: 'give',
		params: [
			{ name: 'user', type: 'username', optional: false, desc: 'The user to give points to' },
			{ name: 'amount', type: 'number', optional: false, desc: 'The amount of points to give' }
		],
		description: 'One user can give points to another user',
		enabled: true,
		costEnabled: true,
		cost: 0,
		coolDown: 0,
		groupCoolDown: 0,
	},
	
];

</script>
<style lang="scss" scoped>	


</style>
