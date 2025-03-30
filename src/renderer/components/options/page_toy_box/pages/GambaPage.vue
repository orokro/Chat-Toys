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
			:toyName="'Gamba'"
			:toySlug="toySlug"
			:commands="commands"
		/>
		
	</PageBox>

</template>
<script setup>

// vue
import { ref, shallowRef, inject } from 'vue';
import { chromeRef, chromeShallowRef } from '../../../../scripts/chromeRef';

// components
import PageBox from '@components/options/PageBox.vue';
import SectionHeader from '@components/options/SectionHeader.vue';
import InfoBox from '@components/options/InfoBox.vue';
import CommandsConfigBox from '@components/options/CommandsConfigBox.vue';

// fetch the main app state context
const ctApp = inject('ctApp');

// generate slug for command
const toySlug = 'gamba';
const slugify = (text) => (toySlug + '__' + text.toLowerCase());

// our local ref settings for this system
const {
	gambaStateMode,
	gambaPrompt,
	gambaOptions,
	resultsWidgetBox,
	widgetBox
} = ctApp.toySettings.gambaSettings;

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
