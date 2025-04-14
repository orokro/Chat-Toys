<!--
	GambaBetWidget.vue
	------------------
	
	A little window that shows:
	 - if betting is open
	 - the current time left to bet (if open)
	 - the pot
	 - the options and their stats
-->
<template>

	<!-- the main box for the widget -->
	<div 
		v-if="ready"
		class="gambaBetWidget"
		:style="{
			'--header-color': socketSettingsRef.windowHeaderColor || 'black',
			'--header-text-color': socketSettingsRef.windowHeaderTextColor || 'white',
			'--body-color': socketSettingsRef.windowBodyColor || 'white',
			'--body-text-color': socketSettingsRef.windowBodyTextColor || 'black',
		}"
	>
		<div class="header">
			Gamba {{ (results!=null && socketSettingsRef.gambaStateMode=='OFF' ) ? 'Results' : 'Bets' }}:
		</div>

		<!-- results -->
		<div 
			v-if="(results!=null && socketSettingsRef.gambaStateMode=='OFF' )"
			class="body"
		>
			<div class="resultsBox">

				<div class="prompt">
					<div class="bg"></div>
					<div class="text">{{ results.prompt }}</div>
				</div>
				<div class="correct">
					<div class="bg"></div>
					<div class="text">{{ results.correct_option }}</div>
				</div>
				<div class="message">
					<div class="text">{{ results.message }}</div>
				</div>

				<!-- loop to generate rows for the payouts -->
				<div class="payoutList">

					<div
						v-for="(user, index) in results.userResults"
						:key="index"
						class="payoutRow"
					>
						<div class="user">
							{{ user.user.display_name }}
						</div>
						<div v-if="user.pointsWon>0" class="won winLoseBox">
							+₱ {{ user.pointsWon }}
						</div>
						<div v-if="user.pointsLost>0" class="lost winLoseBox">
							-₱ {{ user.pointsLost }}
						</div>
						<div v-if="user.pointsLost>0" class="losingBets winLoseBox">
							( {{ user.losingBets.join(',') }} )
						</div>
						
					</div>

				</div>
			</div>
		</div>

		<!-- during betting -->
		<div 
			v-else
			class="body"
		>
			<!-- status row -->
			<div class="statusRow">
				<div class="status">
					<span v-if="socketSettingsRef.gambaStateMode=='CLOSED'">Betting is closed!</span>
					<span v-else-if="socketSettingsRef.gambaStateMode=='OPEN'">Betting is open!</span>
					<span v-else-if="socketSettingsRef.gambaStateMode=='PAID'">Betting is over!</span>
					<span v-else>No active bet!</span>
				</div>
				<div 
					v-if="socketSettingsRef.gambaStateMode=='OPEN'"
					class="timeLeft"
				>
					<span v-if="timeToBet > 0">Time Left: {{ timeToBet }} seconds</span>
				</div>				
			</div>

			<!-- don't show the rest if there's no active bet -->
			<template v-if="socketSettingsRef.gambaStateMode!='OFF'">

				<!-- the options available and their stats -->
				<div class="optionsBox">

					<!-- the prompt -->
					<div class="prompt">
						<div class="bg"></div>
						<div class="text">{{ socketSettingsRef.gambaPrompt }}</div>
					</div>

					<template v-for="(option, index) in optionStats" :key="index">
						<div class="option">
							<div class="optionName"> 
								<strong>{{ String.fromCharCode(65+index) }}) </strong>{{ option.text }}
							</div>
							<div class="optionAmount">₱ {{ option.total }}</div>
							<div class="optionPercent">({{ Math.round(option.percentage) }}%)</div>
							<div 
								class="bottomBar"
								:style="{
									width: option.percentage + '%',
								}"
							></div>
						</div>
					</template>

				</div>

				<!-- betting loop amount -->
				<div class="pool">Total Pool: ₱ {{ bettingPool }}</div>
				
			</template>
		</div>
	</div>

</template>
<script setup>

// vue
import { ref, watch, computed, inject } from 'vue';
import { chromeRef, chromeShallowRef } from '../../scripts/chromeRef';
import { RefAggregator } from '../../scripts/RefAggregator';
import { socketShallowRefReadOnly } from 'socket-ref';

// our settings system
import { useToySettings } from '@toys/useToySettings';
import { keepAliveSocket } from '../keepAliveSocket.js';

const thisSlug = 'gamba';
const widgetSlug = 'bet';
const slugify = (text) => {
	return thisSlug + '__' + text.toLowerCase();
}

// set up our live-light code
keepAliveSocket(thisSlug, widgetSlug);

const emit = defineEmits([
	'boxChange'
]);

// define some props
const props = defineProps({

});

// gets our settings
const ready = ref(false);
const socketSettingsRef = useToySettings('gamba', 'widgetBox', emit, () => {
	console.log('settings updated');
	console.log(socketSettingsRef.value);
	ready.value = true;
});

// gets live sockets
const betsPlaced = socketShallowRefReadOnly(slugify('betsPlaced'), []);
const timeToBet = socketShallowRefReadOnly(slugify('timeToBet'), 0);
const bettingPool = socketShallowRefReadOnly(slugify('bettingPool'), 0);
const optionStats = socketShallowRefReadOnly(slugify('optionStats'), []);
const results = socketShallowRefReadOnly(slugify('results'), null);

watch(optionStats, (newVal) => {
	console.log('optionStats changed:', newVal);
});

</script>
<style lang="scss" scoped>

	// main outer container for the widget
	.gambaBetWidget {

		// fill parent container
		width: 100%;
		/* height: 100%; */

		// reset stacking context
		position: relative;

		// allow margin on top for fixed header
		padding-top: 30px;

		// set the background color
		background-color: var(--body-color);
		color: var(--body-text-color);

		// round corners, allow nothing to escape
		border-radius: 10px;
		overflow: hidden;

		// nice drop shadow
		box-shadow: 0px 0px 10px rgba(0, 0, 0, 0.5);

		// force the header along the top
		.header {

			// fill top
			position: absolute;
			inset: 0px 0px auto 0px;
			height: 30px;

			background-color: var(--header-color);
			color: var(--header-text-color);

			padding: 6px 0px;

			// font settings
			font-weight: bold;
			text-align: center;
			line-height: 20px;

		}// .header

		// content area
		.body {

			// font settings
			font-size: 16px;
			text-align: center;
			line-height: 20px;

			// row with current status & time left (if open)
			.statusRow {

				position: relative;
				height: 40px;
				/* border-bottom: 1px solid black; */

				margin-bottom: 10px;

				.status {
					position: absolute;
					inset: 0px 50% 0px 0px;
					padding: 16px;
				}

				.timeLeft {
					position: absolute;
					inset: 0px 0px 0px 50%;
					padding: 16px;
				}

			}// .statusRow

		}// .body

		// the box with the bet options
		.optionsBox {

			// the area where the prompt for the options is written
			.prompt {

				// fill width & reset stacking context
				width: 100%;
				min-height: 40px;
				position: relative;

				// text settings
				font-style: italic;
				font-weight: bold;

				.bg {
					position: absolute;
					inset: 0px 0px 0px 0px;
					background-color: var(--header-color);
					opacity: 0.33;
				}// .bg

				.text {
					/* position: absolute; */
					position: relative;
					inset: 0px 0px 0px 0px;
					min-height: 40px;
					padding: 10px 0px;

					// for debug
					/* border: 1px solid red; */
				}// .text

			}// .prompt

			// flex settings
			display: flex;
			flex-direction: column;
			justify-content: center;
			align-items: center;

			// font settings
			font-size: 16px;
			text-align: center;
			line-height: 20px;
			
			// space it in and give it a border to offset the header
			margin: 10px 10px;

			// the option rows
			.option {

				// layout
				width: 100%;
				display: flex;
				justify-content: space-between;
				align-items: center;
				padding: 5px 10px 10px;

				// reset stacking context
				position: relative;

				// alternate row bgs
				&:nth-child(odd) {
					background-color: rgba(0, 0, 0, 0.1);
				}
				&:nth-child(even) {
					background-color: rgba(0, 0, 0, 0.05);
				}

				.optionName {
					text-align: left;
					flex-grow: 1;
					font-weight: bold;
				}

				.optionAmount {
					flex-grow: 0;
					margin-right: 20px;
				}

				.optionPercent {
					flex-grow: 0;
					margin-left: 10px;
					font-style: italic;
				}

				// progress bar to show the percentage of the pot
				.bottomBar {
					background-color: var(--header-color);
					position: absolute;
					left: 0px;
					bottom: 0px;
					height: 5px;
				}

			}// .option

		}// .optionsBox


		// bar w/ the total pool
		.pool {
			padding: 10px;
			margin-bottom: 10px;

		}// .pool

		// main box where results generate
		.resultsBox {

			padding: 10px;

			// the area where the prompt for the options is written
			.prompt, .correct {

				// fill width & reset stacking context
				width: 100%;
				min-height: 40px;
				position: relative;

				// text settings
				font-style: italic;
				font-weight: bold;

				.bg {
					position: absolute;
					inset: 0px 0px 0px 0px;
					background-color: var(--header-color);
					opacity: 0.33;
				}// .bg

				&.correct {
					.bg {
						background-color: rgb(145, 255, 27);
					}
				}

				.text {
					/* position: absolute; */
					position: relative;
					inset: 0px 0px 0px 0px;
					min-height: 40px;
					padding: 10px 0px;

					// for debug
					/* border: 1px solid red; */
				}// .text

			}// .prompt, .correct

			// the results status message
			.message {
				padding: 30px 10px;
			}

			// the list box of results rows
			.payoutList {

				// max height
				max-height: 600px;
				overflow-y: auto;
				overflow-x: hidden;

				// the row styles
				.payoutRow {

					// fixed size & reset stacking context
					width: 100%;
					min-height: 40px;
					position: relative;

					// alternate bg colors
					&:nth-child(odd) {
						background-color: rgba(0, 0, 0, 0.025);
					}
					&:nth-child(even) {
						background-color: rgba(0, 0, 0, 0.05);
					}

					// fixed user name on the left
					.user, .won, .lost, .losingBets {
						padding-top: 2px;
						position: absolute;
						top: 0px;
						height: 20px;
						font-weight: bolder;
						white-space: nowrap;
						overflow: hidden;

					}// user, .won, .lost, .losingBets


					// the user name for their results row
					.user {
						left: 0px;
						width: 40%;	
					}

					// the optional column for points they may have won
					.won {
						left: 40%;
						width: 30%;
						text-align: center;
						color: green;
					}

					// the optional column for points they may have lost
					.lost {
						left: 70%;
						width: 30%;
						text-align: center;
						color: red;
					}

					// the list of options they chose that lost, if any
					// (goes under the regular .lost box)
					.losingBets {
						padding-top: 0px;
						top: 20px;
						left: 70%;
						width: 30%;

						// text settings
						text-align: center;
						color: red;
						font-weight: 100;
						font-size: 12px;
						font-style: italic;

					}// .losingBets

				}// .payoutRow

			}// .payoutList

		}// .resultsBox

	}// .gambaBetWidget
	
</style>
