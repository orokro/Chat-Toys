<!--
	GambaPage.vue
	-------------

	This is the settings page for the Gamba system.
-->
<template>

	<PageBox
		title="Gamba Settings"
		:themeColor="toy.static.themeColor"
		:style="{ '--color-primary': toy.static.themeColor, }"
		themeImage="assets/bg_tiles/gamba.png"
	>
		<div class="picBox" :style="{ height: '450px',}">
			<img src="/assets/chat_solid/gamba.png" height="300px" style="float:right"/>
		</div>
		
		<br>

		<p>
			The Gamba system lets chatters gamble their points away!
			<br>
			Or, win big!
			<br>
			There can only be one active betting game at a time.
			The options & state is handled on the bottom of this page.
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

		<WidgetSection :toy="toy" />
		
		<SectionHeader title="Theme Colors"/>

		<SettingsInputRow
			type="color"
			v-model="windowHeaderColor"
		>
			<h3>Widget Header Color</h3>
			<p>What color header of the widgets be?</p>
		</SettingsInputRow>
		<SettingsInputRow
			type="color"
			v-model="windowBodyColor"
		>
			<h3>Widget Body Color</h3>
			<p>What color body of the widgets be?</p>
		</SettingsInputRow>
		<SettingsInputRow
			type="color"
			v-model="windowHeaderTextColor"
		>
			<h3>Widget Header Text Color</h3>
			<p>What color header text of the widgets be?</p>	
		</SettingsInputRow>
		<SettingsInputRow
			type="color"
			v-model="windowBodyTextColor"
		>
			<h3>Widget Body Text Color</h3>
			<p>What color body text of the widgets be?</p>
		</SettingsInputRow>

		<SectionHeader title="Settings"/>

		<div
			class="gambaSettings"
			:class="{
				disabled: gambaStateMode !== 'OFF',
			}"
		>
			<div class="blur">
				<SettingsInputRow
					type="text"
					v-model="gambaPrompt"
				>
					<h3>Gamba Prompt</h3>
					<p>
						The topic for the options to bet on.
					</p>
					<p>The number of users can be customized above...</p>
				</SettingsInputRow>

				<SettingsRow>
					<h3>Options</h3>
					<p>Add at least 2 options</p>
					<ArrayEdit
						v-model="gambaOptions"
						:component="ArrayTextInput"
						:schema="itemSchema"
						:createItem="() => ''"
					/>
				
				</SettingsRow>

				<SettingsInputRow
					type="number"
					:min="30"
					v-model="gambaBetTime"
				>
					<h3>Betting Time</h3>
					<p>
						When you press "Begin Betting" below, how long should the timer on screen
						allow users to place bets?
					</p>
					<p>Time below is in seconds:</p>
					<ul>
						<li>60 = 1 min</li>
						<li>120 = 2 min</li>
						<li>180 = 3 min</li>
						<li>240 = 4 min</li>
						<li>300 = 5 min</li>
					</ul>
				</SettingsInputRow>
			</div>

			<div class="disabledMessage">You cannot edit the settings during an active bet!</div>
		</div>

		<SectionHeader title="Actions"/>

		<div class="status">

			<div v-if="gambaStateMode === 'OFF'">
				<h1>Current status: Idle.</h1>
				<p>
					Press the button below to start a new round!
				</p>
			</div>
			<div v-else-if="gambaStateMode === 'OPEN'">
				<h1>Current status: Betting in progress.</h1>
				<p>
					{{ toy.timeToBet.value }} seconds left to place bets!
					<br>
					Press the button below to cancel the round and refund all bets.
				</p>
			</div>	
			<div v-else-if="gambaStateMode === 'CLOSED'">
				<h1>Current status: Betting closed.</h1>
				<p>
					Press the button below to resolve the round and pay out the winners.
					<br>
					Or, press the button below to cancel the round and refund all bets.
				</p>
			</div>
		</div>
		<div class="actionButtons">

			<button
				class="gambaButton"
				:class="{
					disabled: gambaStateMode !== 'OFF',
				}"
				:disabled="gambaStateMode !== 'OFF'"
				@click="handleStartRound()"
			>
				Start Round!
			</button>

			<button
				class="gambaButton"
				:class="{
					disabled: gambaStateMode == 'OFF',
				}"
				:disabled="gambaStateMode == 'OFF'"
				@click="toy.cancelRound()"
			>
				Cancel & Refund
			</button>

			<button
				class="gambaButton"
				:class="{
					disabled: gambaStateMode !== 'CLOSED',
				}"
				:disabled="gambaStateMode !== 'CLOSED'"
				@click="handleResolveRound()"
			>
				Resolve Round!
			</button>

		</div>

		<CatsumIpsum :paragraphs="1" :sentences="10" :brOnly="true"/>
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
import SettingsRow from '../../components/options/SettingsRow.vue';
import SettingsInputRow from '../../components/options/SettingsInputRow.vue';
import ArrayEdit from '../../components/options/ArrayEdit.vue';
import ArrayTextInput from '../../components/options/ArrayTextInput.vue';
import CatsumIpsum from '@components/options/../CatsumIpsum.vue';
import ConfirmModal from '@components/options/ConfirmModal.vue';
import ResolveGambaModal from './ResolveGambaModal.vue';
import WidgetSection from '@components/options/WidgetSection.vue';

// our app
import Gamba from './Gamba';

// lib/misc
import * as yup from 'yup';
import { Modal } from 'jenesius-vue-modal';
import { openModal, promptModal } from "jenesius-vue-modal"

// fetch the main app state context & our toy
const ctApp = inject('ctApp');
const toy = ctApp.toyManager.toys[Gamba.slug];

// make a yup schema that disallows escape characters, as well as one to validate color strings
const itemSchema = yup.string().matches(/^[^\\]+$/, 'Escape characters are not allowed');

// our local ref settings for this system
const {
	gambaStateMode,
	gambaPrompt,
	gambaOptions,
	gambaBetTime,
	windowHeaderColor,
	windowBodyColor,
	windowHeaderTextColor,
	windowBodyTextColor,
} = toy.settings;


/**
 * Starts the round!
 */
async function handleStartRound(){

	// show the modal to start the round
	const response = await promptModal(ConfirmModal, {
		title: 'Gamba Round started!',
		prompt: `			
			Make sure the betting options widget is currently visible on screen!
			Your viewers have ${gambaBetTime.value} seconds to place bets!`,
		buttons: ['mkay'],
		icon: 'casino'
	});

	// tell gamba system to start the round!
	toy.startRound();
}


/**
 * Handle when the user clicks the "Resolve Round" button
 */
async function handleResolveRound() {
	
	// show the modal to resolve the round
	const response = await promptModal(ResolveGambaModal, {});

	// if the response was null, return
	if(response==null)
		return;

	// otherwise, if the response was not {button: 'yes', index:0}, return
	if(response.index!==0)
		return;

	// tell gamba system to resolve the round!
	toy.resolveRound(response.value);
}


</script>
<style lang="scss" scoped>	

	// we want to selectively disable the settings box if a bet is actve
	.gambaSettings {

		// reset stacking context
		position: relative;

		// the main box for the widget
		&.disabled {
			
			pointer-events: none;

			/* background: rgba(0, 0, 0, 0.1); */
			.blur {
				opacity: 0.5;
				filter: blur(5px);
			}

			.disabledMessage {
				display: block;
			}
		}

		// measure to show when we're disabled for betting
		.disabledMessage {

			// hidden by default
			display: none;

			// center
			position: absolute;
			top: 50%;
			left: 50%;
			transform: translate(-50%, -50%);

			font-size: 32px;
			font-weight: bold;
			font-style: italic;
			white-space: nowrap;
			color: black;

		}// .disabledMessage

	}// .gambaSettings

	// buttons
	.actionButtons {

		// flex center
		display: flex;
		justify-content: center;
		align-items: center;

		
		button {

			// box settings
			width: 200px;
			height: 50px;
			margin: 10px auto;
			border-radius: 10px;

			// text settings
			font-size: 20px;
			color: white;
			text-shadow: 2px 2px 0px black;

			// background color
			background-color: var(--color-primary);
			cursor: pointer;

			&:hover {
				background: linear-gradient(
					-0deg,
					var(--color-primary) 0%,
					white 100%
				);
			}

			&.disabled {
				background-color: var(--color-primary);
				opacity: 0.5;
				cursor: not-allowed;
				pointer-events: none;
			}

		}// button

	}// .actionButtons

</style>
