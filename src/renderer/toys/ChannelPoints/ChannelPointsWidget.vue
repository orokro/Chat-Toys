<!--
	ChanelPointsWidget.vue
	----------------------
	
	The icon that will periodically appear to allow chatters to claim points.
-->
<template>

	<!-- the main box for the widget -->
	<div 
		v-if="ready"
		class="channelPointsWidget"
		:class="{ idle: mode === 'IDLE' }"
		:style="{
			'--widget-color': socketSettingsRef.widgetColorTheme || 'red'
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
				<img :src="socketSettingsRef.widgetIconPath" alt="channel points icon" width="60" height="60" />
			</div>

			<svg 
				v-if="socketSettingsRef.showTimerBar"
				class="timerCircle"
				:width="svgSize"
				:height="svgSize"
				:viewBox="`0 0 ${svgSize} ${svgSize}`"
			>
				<circle 
					v-if="timeLeftNormalised > 0"
					:cx="center"
					:cy="center"
					:r="radius"
					fill="none"
					:stroke="socketSettingsRef.widgetColorTheme"
					:stroke-width="thiccness"
					:stroke-dasharray="dashArray"
					:stroke-dashoffset="dashOffset"
					stroke-linecap="round"
					:transform="`rotate(-90, ${center}, ${center})`"
				/>
			</svg>

			<div class="colorOverlay"></div>

			<div v-if="socketSettingsRef.showClaimsRemaining" class="claimsRemaining">
				{{ claimsLeft }} left!
			</div>
			<div v-if="socketSettingsRef.showTextPrompt" class="command" align="center">
				Type <span class="cmd">!{{ claimCommand }}</span><br>to get {{ socketSettingsRef.pointsPerClaim }} now!
			</div>
		</div>
	</div>

</template>
<script setup>

// vue
import { ref, watch, computed } from 'vue';
import { chromeRef, chromeShallowRef } from '../../scripts/chromeRef';
import { RefAggregator } from '../../scripts/RefAggregator';
import { socketShallowRefReadOnly } from 'socket-ref';

// our settings system
import { useToySettings } from '@toys/useToySettings';

const thisSlug = 'channelPoints';
const slugify = (text) => {
	return thisSlug + '__' + text.toLowerCase();
}

const emit = defineEmits([
	'boxChange'
]);


// timer circle settings
const thiccness = ref(10);
const diameter = ref(100);
const radius = computed(() => diameter.value / 2);
const center = computed(() => radius.value + 5);
const circumference = computed(() => 2 * Math.PI * radius.value);
const dashArray = computed(() => circumference.value);
const dashOffset = computed(() => {
  const pct = Math.min(Math.max(timeLeftNormalised.value, 0), 1);
  return circumference.value * (1 - pct);
});
const svgSize = computed(() => diameter.value + 10); // 5px padding around

// gets our settings
const ready = ref(false);
const socketSettingsRef = useToySettings('channel-points', 'widgetBox', emit, () => {
	ready.value = true;
	console.log('channel-points settings updated');
	console.log(socketSettingsRef.value);
});

watch(socketSettingsRef, (newVal) => {
	// console.log('channel-points settings updated');
	// console.log(newVal);
});


// gets live sockets
const claimCommand = socketShallowRefReadOnly(slugify('claimCommand'), '');
const claimsLeft = socketShallowRefReadOnly(slugify('claimsLeft'), 0);
const mode = socketShallowRefReadOnly(slugify('mode'), 'idle');
const timeLeftNormalised = socketShallowRefReadOnly(slugify('timeLeftNormalised'), 0);
const userClaims = socketShallowRefReadOnly(slugify('userClaims'), []);

// define some props
const props = defineProps({

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

		transition: transform 0.25s ease-in-out;
		transform: scale(1);
		&.idle {
			transform: scale(0);
		}

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

			.timerCircle {
				position: absolute;
				left: 50%;
				top: 53%;
				transform: translate(-50%, -50%);
			}	

			// spinner boxes
			.spinnerBox {
				width: 200px;
				height: 200px;
				position: absolute;
				mask-image:
					radial-gradient(circle, rgb(255, 255, 255) 40%,
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
					radial-gradient(circle, rgb(255, 255, 255) 40%,
						rgba(0, 0, 0, 0.2) 70%,
						rgba(0, 0, 0, 0) 100%);
			}

			// .colorOverlay

			// remaining count
			.claimsRemaining {

				position: absolute;
				top: 10px;
				left: 50%;
				transform: translateX(-50%);
				font-size: 1.5em;
				color: white;
				text-shadow: 2px 2px 2px black;

			}

			// .claimsRemaining

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
				line-height: 22px;

				.cmd {
					font-weight: bold;
					color: yellow;
				}
			}

			// .command

		}

		// .innerWrapper

	}

	// .channelPointsWidget

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
		0% {
			transform: translate(-50%, -50%) scale(1);
		}

		50% {
			transform: translate(-50%, -50%) scale(1.5);
		}

		100% {
			transform: translate(-50%, -50%) scale(1);
		}
	}

</style>
