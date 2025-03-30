<!--
	GambaPage.vue
	-------------

	This is the settings page for the Gamba system.
-->
<template>

	<PageBox
		title="Gamba Settings"
		:themeColor="toy.static.themeColor"
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
		<CommandsConfigBox :toy="toy" />
		
	</PageBox>

</template>
<script setup>

// vue
import { ref, shallowRef, inject } from 'vue';
import { chromeRef, chromeShallowRef } from '../../scripts/chromeRef';

// components
import PageBox from '@components/options/PageBox.vue';
import SectionHeader from '@components/options/SectionHeader.vue';
import InfoBox from '@components/options/InfoBox.vue';
import CommandsConfigBox from '@components/options/CommandsConfigBox.vue';

// our app
import Gamba from './Gamba';

// fetch the main app state context & our toy
const ctApp = inject('ctApp');
const toy = ctApp.toyManager.toys[Gamba.slug];

// our local ref settings for this system
const {
} = toy.settings;

</script>
<style lang="scss" scoped>	


</style>
