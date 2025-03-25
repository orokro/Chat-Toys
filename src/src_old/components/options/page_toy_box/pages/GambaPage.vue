<!--
	GambaPage.vue
	-------------

	This is the settings page for the Gamba system.
-->
<template>

	<PageBox
		title="Gamba Settings"
		themeColor="#458233"
	>
		<p>
			The Gamba system lets chatters gamble their points away!
			<br>
			Or, win big!
			<br>
			There can only be one active betting game at a time,
			the actual bet conditions are set in the show time page, and also resolved there.
			<br>
			The bet commands will be ignored if there no bet is set in show time.
		</p>

		<InfoBox icon="lightbulb">
			NOTE #1: Users specify the amount they want to bet, and the option they want to bet on.
			If you add a cost to the bet command, the user will have to pay that cost to place a bet.
		</InfoBox>
		<InfoBox icon="lightbulb">
			NOTE #2: If the user places multiple bets during the same game, their bets will be combined.
			Using the cancel command will revoke all bets placed by the user.
		</InfoBox>
		<InfoBox icon="lightbulb">
			NOTE #3: If there are multiple options, a user can hedge bets by betting on more than one.
			(Insert: always sunny "I'm playing both sides" meme)
		</InfoBox>
		
		<SectionHeader title="Command Triggers"/>
		<p>
			Below you can customize the commands that users can type to interact with the Gamba system.
		</p>
		<CommandsConfigBox
			:optionsApp="optionsApp"
			:toyName="'Gamba'"
			:toySlug="toySlug"
			:commands="commands"
		/>
		
	</PageBox>

</template>
<script setup>

// vue
import { ref, shallowRef } from 'vue';
import { chromeRef, chromeShallowRef } from '../../../../scripts/chromeRef';
import { RefAggregator } from '../../../../scripts/RefAggregator';

// components
import PageBox from '../../PageBox.vue';
import SectionHeader from '../../SectionHeader.vue';
import InfoBox from '../../InfoBox.vue';
import CommandsConfigBox from '../../CommandsConfigBox.vue';
import CatsumIpsum from '../../../CatsumIpsum.vue';

// generate slug for command
const toySlug = 'gamba';
const slugify = (text) => (toySlug + '_' + text.toLowerCase());

// props
const props = defineProps({
	
	// reference to the state of the options page
	optionsApp: {
		type: Object,
		default: null
	}
});


// gamba settings
const gambaStateMode = shallowRef('off');
const gambaPrompt = shallowRef('Streamer will beat the boss?');
const gambaOptions = shallowRef(['Yes', 'No']);
const resultsWidgetBox = shallowRef({
	x: (1280/2) - (500/2),
	y: (720/2) - (600/2),
	width: 500,
	height: 600
});
const widgetBox = shallowRef({
	x: (1280/2) - (400/2),
	y: 720-220,
	width: 400,
	height: 200
});
const gambaSettings = chromeShallowRef('gamba-settings', {});
const settingsAggregator = new RefAggregator(gambaSettings);
settingsAggregator.register('gambaStateMode', gambaStateMode);
settingsAggregator.register('gambaPrompt', gambaPrompt);
settingsAggregator.register('gambaOptions', gambaOptions);
settingsAggregator.register('resultsWidgetBox', resultsWidgetBox);
settingsAggregator.register('widgetBox', widgetBox);


// we'll define our commands here
// NOTE: these are the DEFAULTS, the actual commands will be loaded from storage
// in the CommandsConfigBox component
const commands = [
	{
		slug: slugify('bet'),
		command: 'bet',
		params: [
			{ name: 'amount', type: 'number', optional: false, desc: 'How many points to wage.' },
			{ name: 'option', type: 'string', optional: false, desc: 'Which option to gamble on' },
		],
		description: 'Gamble points on options set up by the Streamer',
		enabled: true,
		costEnabled: true,
		cost: 0,
		coolDown: 0,
		groupCoolDown: 0,
	},
	{
		slug: slugify('cancel_bet'),
		command: 'cancel_bet',
		description: 'Revokes bet before the game starts.',
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
