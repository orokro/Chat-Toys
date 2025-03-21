<!--
	ChanelPointsWidget.vue
	----------------------
	
	The icon that will periodically appear to allow chatters to claim points.
-->
<template>

	<!-- the main box for the widget -->
	<div 
		class="channelPointsWidget"
		
		:style="{
			'--widget-color': widgetColorTheme || 'red'
		}"
	>
		
		<!-- inner wrapper to reset CSS stacking context -->
		<div class="innerWrapper">
			
			<div class="spinnerBox glowSpinner_1">
				<div class="gradient-overlay"></div>
			</div>
			<div class="spinnerBox glowSpinner_2">
				<div class="gradient-overlay"></div>
			</div>
			<div class="spinnerBox glowSpinner_3"></div>
			
			<div class="icon">
				<img
					:src="'/builtin/point_icon_1.png'"
					alt="channel points icon"
					width="60"
					height="60"
				/>
			</div>

			<div class="colorOverlay"></div>
			
			<div v-if="showClaimsRemaining" class="claimsRemaining">
				{{ claimsLeft }} left!
			</div>
			<div v-if="showTextPrompt" class="command">
				Type <span class="cmd">!{{ claimCommand }}</span> to get {{ pointsPerClaim }} now!
			</div>
		</div>
	</div>

</template>
<script setup>

// vue
import { ref, watch, computed } from 'vue';
import { chromeRef, chromeShallowRef } from '../../../scripts/chromeRef';
import { RefAggregator } from '../../../scripts/RefAggregator';

// we'll use a chrome ref to aggregate all our settings
const channelPointsSettings = chromeRef('channel-points-settings', {});

// our settings for this system
const claimInterval = ref(300);
const claimRandomness = ref(0);
const claimDuration = ref(60);
const pointsPerClaim = ref(100);
const maxClaims = ref(0);
const showTimerBar = ref(true);
const showClaimsRemaining = ref(true);
const showUserClaims = ref(true);
const showTextPrompt = ref(true);
const widgetColorTheme = ref('#00ABAE');

// aggregate all our refs
const settingsAggregator = new RefAggregator(channelPointsSettings);
settingsAggregator.register('claimInterval', claimInterval);
settingsAggregator.register('claimRandomness', claimRandomness);
settingsAggregator.register('claimDuration', claimDuration);
settingsAggregator.register('pointsPerClaim', pointsPerClaim);
settingsAggregator.register('maxClaims', maxClaims);
settingsAggregator.register('showTimerBar', showTimerBar);
settingsAggregator.register('showClaimsRemaining', showClaimsRemaining);
settingsAggregator.register('showUserClaims', showUserClaims);
settingsAggregator.register('showTextPrompt', showTextPrompt);
settingsAggregator.register('widgetColorTheme', widgetColorTheme);

// all of the commands system wide are stored in this chrome shallow ref
const commandsRef = chromeShallowRef('commands', {});

// get the command used for claiming points
const claimCommand = computed(() => {
	return commandsRef.value.channel_points_get?.command || '';
});

const claimsLeft = computed(() => {
	return props.demoMode ? 3 : maxClaims.value;
});

// define some props
const props = defineProps({
	
	// true if the widget is in demo mode
	demoMode: {
		type: Boolean,
		default: false
	},

	// time left in the current claim
	timeLeft: Number,

	// the number of claims remaining
	claimsRemaining: Number,

});

</script>
<style lang="scss" scoped>

	// the main box for the widget
	.channelPointsWidget {

		// fixed size (if the user wants to adjust size we'll use transforms)
		width: 200px;
		height: 200px;

		// for debug
		/* border: 1px solid red; */

		// while the .channelPointsWidget is able to be positioned abso-lutely,
		// this inner wrapper will reset CSS stacking context
		.innerWrapper {

			// fill the box
			width: 100%;
			height: 100%;

			// reset stacking context
			position: relative;

			// for debug
			/* border: 1px solid blue; */

			// put icon in the center
			.icon {
				position: absolute;
				left: 50%;
				top: 53%;
				transform: translate(-50%, -50%);
				animation: throb 2s ease-in-out infinite;
			}

			// spinner boxes
			.spinnerBox {
				width: 200px;
				height: 200px;
				position: absolute;
				mask-image: 
					radial-gradient(
						circle, rgb(255, 255, 255) 40%, 
						rgba(0, 0, 0, 0.2) 70%, 
						rgba(0, 0, 0, 0) 100%);
			}

			// the first spinner box, clockwise glow
			.glowSpinner_1 {
				
				background: url('/assets/channel_points/starburst_glow.png') no-repeat;
				background-size: cover;
				animation: rotate_cw 45s linear infinite;		
				opacity: 0.15;
			}

			// the second spinner box, counter-clockwise glow
			.glowSpinner_2 {
				
				background: url('/assets/channel_points/starburst_glow.png') no-repeat;
				background-size: cover;
				animation: rotate_ccw 45s linear infinite;		
				opacity: 0.15;
			}
			

			// for coloring the widget
			.colorOverlay {

				// load from CSS var
				background-color: var(--widget-color);
				width: 100%;
				height: 100%;
				position: absolute;
				top: 0;
				left: 0;

				mix-blend-mode: overlay;

				mask-image: 
					radial-gradient(
						circle, rgb(255, 255, 255) 40%, 
						rgba(0, 0, 0, 0.2) 70%, 
						rgba(0, 0, 0, 0) 100%);
			}// .colorOverlay

			// remaining count
			.claimsRemaining {

				position: absolute;
				top: 10px;
				left: 50%;
				transform: translateX(-50%);
				font-size: 1.5em;
				color: white;
				text-shadow: 2px 2px 2px black;
			
			}// .claimsRemaining

			// text prompt for the user
			.command {
				
				// for debug
				/* border: 1px solid red; */

				// place on bottom
				position: absolute;
				bottom: 0px;
				left: 50%;
				transform: translateX(-50%);

				// text style
				font-size: 1.2em;
				color: white;
				text-shadow: 2px 2px 2px black;
				white-space: nowrap;
				.cmd {
					font-weight: bold;
					color: yellow;
				}
			}// .command

		}// .innerWrapper

	}// .channelPointsWidget

	@keyframes rotate_cw {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}

	@keyframes rotate_ccw {
		from {
			transform: rotate(360deg);
		}
		to {
			transform: rotate(0deg);
		}
	}

	@keyframes throb {
		0% { transform: translate(-50%, -50%) scale(1); }
		50% { transform: translate(-50%, -50%) scale(1.5); }
		100% { transform: translate(-50%, -50%) scale(1); }
	}

</style>
