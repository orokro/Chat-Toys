<!--
	ChanelPointsWidget.vue
	----------------------
	
	The icon that will periodically appear to allow chatters to claim points.
-->
<template>

	<!-- auto sizer so we can lazily scale the widget lol -->
	<FixedAutoSizer :targetWidth="200" :targetHeight="250" v-model="scale">

		<!-- box to scale -->
		<div
			class="scaleBox"
			:style="{
				transform: `translate(-50%, -50%) scale(${scale})`
			}"
		>
			<!-- the main box for the widget -->
			<div 
				v-if="ready"
				class="channelPointsWidget"
				:class="{ 
					idle: mode === 'IDLE',
					demoMode: demoMode
				}"
				:style="{
					'--widget-color': socketSettingsRef.widgetColorTheme || 'red'
				}"
			>

				<!-- the graphical elements -->
				<div class="innerWrapper">

					<div class="spinnerBox glowSpinner_1">
						<div class="gradient-overlay"></div>
					</div>
					<div class="spinnerBox glowSpinner_2">
						<div class="gradient-overlay"></div>
					</div>
					<div class="spinnerBox glowSpinner_3"></div>

					<div class="icon">
						<img :src="widgetIconPath" alt="channel points icon" width="60" height="60" />
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

					
				</div>

				<!-- the text elements -->
				<div class="textOverlay">

					<div v-if="socketSettingsRef.showClaimsRemaining && socketSettingsRef.maxClaims>0" class="claimsRemaining">
						{{ claimsLeft }} left!
					</div>

					<div v-if="socketSettingsRef.showTextPrompt" class="command" align="center">
						Type <span class="cmd">!{{ claimCommand }}</span><br>to get {{ socketSettingsRef.pointsPerClaim }} now!
					</div>

					<div class="userClaims">
						<div
							v-if="socketSettingsRef.showUserClaims"
							v-for="claim in claimsVisible"
							class="claimText"
							:key="claim.id"
						>
							{{ claim.text }}
						</div>
					</div>

					<div
						v-if="true || userMeMsg !== ''" 
						class="userMeLogs"
					>
						{{  userMeMsg }}
					</div>

				</div>

			</div>
		</div>
	</FixedAutoSizer>

</template>
<script setup>

// vue
import { ref, shallowRef, watch, computed, inject } from 'vue';
import { chromeRef, chromeShallowRef } from '../../scripts/chromeRef';
import { RefAggregator } from '../../scripts/RefAggregator';
import { socketShallowRefReadOnly } from 'socket-ref';

// other components
import AutoSizer from '@components/AutoSizer.vue';
import FixedAutoSizer from '@components/FixedAutoSizer.vue';

// our settings system
import { useToySettings } from '@toys/useToySettings';
import { keepAliveSocket } from '../keepAliveSocket.js';

// inherit scale from AutoSizer
const scale = ref(1);

const thisSlug = 'channelPoints';
const widgetSlug = 'points';
const slugify = (text) => {
	return thisSlug + '__' + text.toLowerCase();
}

// const userMeMsg = ref(`${"Orokro"}: ₱ ${9001}`);
const userMeMsg = ref('');

// set up our live-light code
keepAliveSocket(thisSlug, widgetSlug);

const emit = defineEmits([
	'boxChange'
]);

// define some props
const props = defineProps({

});

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
	// console.log('channel-points settings updated');
	console.log(socketSettingsRef.value);
});

// gets live sockets
const demoMode = socketShallowRefReadOnly('demoMode', false);
const claimCommand = socketShallowRefReadOnly(slugify('claimCommand'), '');
const claimsLeft = socketShallowRefReadOnly(slugify('claimsLeft'), 0);
const mode = socketShallowRefReadOnly(slugify('mode'), 'idle');
const timeLeftNormalised = socketShallowRefReadOnly(slugify('timeLeftNormalised'), 0);
const userClaims = socketShallowRefReadOnly(slugify('userClaims'), []);
const userMeLogs = socketShallowRefReadOnly(slugify('userMeLogs'), []);
const widgetIconPath = socketShallowRefReadOnly(slugify('widgetIconPath'), null);


const claimsSeenHistory = chromeShallowRef('claimsSeenHistory', []);
const claimsVisible = shallowRef([]);
watch(userClaims, (newClaims) => {
	
	// loop over the new value and claim items we haven't se in local history
	for(let i=0; i<newClaims.length; i++){

		const claim = newClaims[i];

		// if we haven't seen this item before, show it on screen
		if(!claimsSeenHistory.value.includes(claim.id)){

			// add to our list
			claimsVisible.value = [...claimsVisible.value, claim];

			// add to local history
			const newHistory = [...claimsSeenHistory.value, claim.id];
			while(newHistory.length > 100)
				newHistory.shift();
			claimsSeenHistory.value = newHistory;
		}

	}// next i
});

/**
 * Queue of pending user messages.
 * @type {string[]}
 */
 const msgQueue = [];

/**
 * Timer ID for clearing messages.
 * @type {number|null}
 */
let msgTimer = null;

/**
 * Duration each message is displayed (in milliseconds).
 * @constant
 */
const DISPLAY_DURATION = 3000;

/**
 * Handles displaying the next message in the queue.
 * This function pops a message, sets it to `userMeMsg`, and
 * sets a timer to clear it after DISPLAY_DURATION.
 */
function processNextMsg() {
	// If queue is empty, nothing to do
	if (msgQueue.length === 0) {
		msgTimer = null;
		return;
	}

	// Pop next message and display it
	const nextMsg = msgQueue.shift();
	userMeMsg.value = nextMsg;

	// Start timer to clear message
	msgTimer = setTimeout(() => {
		userMeMsg.value = '';

		setTimeout(()=>{

			// Clear timer reference
			msgTimer = null;

			// Process next message if any remain
			processNextMsg();

		}, 500);

	}, DISPLAY_DURATION);
}

/**
 * Push a new message to the queue.
 * If no timer is running, it will immediately start processing.
 * Otherwise, it will wait until the current message cycle completes.
 * @param {string} msg - The message to add to the queue.
 */
function pushUserMsg(msg) {
	if (typeof msg !== 'string' || !msg.trim()) return;
	msgQueue.push(msg);

	// If no timer running, start the loop
	if (!msgTimer) {
		processNextMsg();
	}
}

// Example usage:
// pushUserMsg('Hello there!');
// pushUserMsg('This will appear after the previous one.');


/**
 * Set of message IDs we've already processed.
 * Prevents duplicate pushUserMsg() calls.
 * @type {Set<string>}
 */
 const seenMsgIds = new Set();

/**
 * Watch the userMeLogs shallowRef for changes.
 * Whenever new items appear, send their `.text` to pushUserMsg().
 * When items disappear (cleared by the source), we remove their IDs from our tracking set.
 */
watch(
	() => userMeLogs.value,
	(newLogs) => {

		console.log('New userMeLogs:', newLogs);
		if (!Array.isArray(newLogs)) return;

		console.log('b');

		// Collect all current IDs from the newLogs array
		const currentIds = new Set(newLogs.map((log) => log.id));

		// --- Step 1: Remove stale IDs from seenMsgIds ---
		for (const id of seenMsgIds) {
			if (!currentIds.has(id)) {
				seenMsgIds.delete(id);
			}
		}

		// --- Step 2: Process any new logs we haven't seen yet ---
		for (const log of newLogs) {
			if (!seenMsgIds.has(log.id)) {
				seenMsgIds.add(log.id);

				// Defensive: ensure text exists and is a string
				if (typeof log.text === 'string' && log.text.trim()) {
					pushUserMsg(log.text);
				}
			}
		}
	},
	{ deep: false } // shallowRef → no need for deep watching
);

</script>
<style lang="scss" scoped>

	// box used to scale the widget
	.scaleBox {
		
		// same size as the default widget scale
		width: 200px;
		height: 250px;
		
		// center in the widget
		position: absolute;
		top: 50%;
		left: 50%;
		
	}// .scaleBox

	// the main box for the widget
	.channelPointsWidget {

		// fixed size (if the user wants to adjust size we'll use transforms)
		width: 200px;
		height: 250px;

		// for debug
		// border: 1px solid red;

		transition: transform 0.25s ease-in-out;
		transform: scale(1);
		&.idle {
			transform: scale(0);
		}
		/* mix-blend-mode: overlay; */
		&.demoMode {
			border: 1px dashed rgba(255, 255, 255, 0.5);
			transform: scale(1);
		}

		.textOverlay {

			position: absolute !important;
			inset: 0px;
			mask-image: none !important;

			/* border: 1px solid yellow; */
			height: 100%;

			// with the text that appears like "orokro got 100 points!"
			.userClaims {

				position: absolute;
				inset: 0px;

				.claimText {

					position: absolute;
					bottom: 40px;
					left: 50%;
					min-width: 100%;
					
					transform: translate(-50%, 0%);
				
					// claim text
					color: white;
					text-shadow: 2px 2px 0px black;
					font-weight: bolder;
					text-align: center;
					white-space: nowrap;

					// play forward slideUp animation once
					animation: slideUp 0.75s linear forwards;

				}// .claimText

			}// .userClaims

			.userMeLogs {
				position: absolute;
				bottom: 0px;
				left: 0px;
				right: 0px;
				height: 40px;

				// claim text
				color: white;
				text-shadow: 2px 2px 0px black;
				font-weight: bolder;
				text-align: center;
				line-height: 15px;
				/* white-space: nowrap; */
			}// .userMeLogs 

		}// .textOverlay

		// while the .channelPointsWidget is able to be positioned abso-lutely,
		// this inner wrapper will reset CSS stacking context
		.innerWrapper, .textOverlay {

			// fill the box
			width: 100%;
			aspect-ratio: 1 / 1;

			// reset stacking context
			position: relative;

			mask-image:
				radial-gradient(circle, rgb(255, 255, 255) 40%,
					rgba(0, 0, 0, 0.2) 60%,
					rgba(0, 0, 0, 0) 100%);

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
				top: 50%;
				transform: translate(-50%, -50%);
			}	

			// spinner boxes
			.spinnerBox {
				width: 200px;
				height: 200px;
				position: absolute;
				mask-image:
					radial-gradient(circle, rgb(255, 255, 255) 40%,
						rgba(0, 0, 0, 0.2) 50%,
						rgba(0, 0, 0, 0) 100%);
			}

			// the first spinner box, clockwise glow
			.glowSpinner_1 {
				/* display: none; */
				background: url('/assets/channel_points/starburst_glow.png') no-repeat;
				background-size: cover;
				animation: rotate_cw 45s linear infinite;
				opacity: 0.06;

				mask-image:
					radial-gradient(circle, rgb(255, 255, 255) 0%,
						rgba(0, 0, 0, 0.2) 35%,
						rgba(0, 0, 0, 0) 60%);

			}

			// the second spinner box, counter-clockwise glow
			.glowSpinner_2 {

				background: url('/assets/channel_points/starburst_glow.png') no-repeat;
				background-size: cover;
				animation: rotate_ccw 45s linear infinite;
				opacity: 0.35;

				/* display: none; */
				
				mask-image:
					radial-gradient(circle, rgb(255, 255, 255) 25%,
						rgba(0, 0, 0, 0.2) 40%,
						rgba(0, 0, 0, 0) 90%);
			}


			// for coloring the widget
			.colorOverlay {

				/* display: none; */
				// load from CSS var
				background-color: var(--widget-color);
				width: 100%;
				height: 100%;
				position: absolute;
				top: 0;
				left: 0;

				mix-blend-mode: overlay;
				opacity: 0.5;
				
				/* display: none; */

				mask-image:
					radial-gradient(circle, rgb(255, 255, 255) 10%,
						rgba(0, 0, 0, 0.2) 70%,
						rgba(0, 0, 0, 0) 90%);
			}// .colorOverlay

			// remaining count
			.claimsRemaining {

				position: absolute;
				top: 10px;
				left: 50%;
				transform: translateX(-50%);
				font-size: 24px;
				font-weight: bolder;
				color: white;
				text-shadow: 2px 2px 0px black;

			}// .claimsRemaining

			// text prompt for the user
			.command {

				// for debug
				/* border: 1px solid red; */

				// place on bottom
				position: absolute;
				bottom: 50px;
				left: 50%;
				transform: translateX(-50%);

				// text style
				font-size: 19px;
				font-weight: bolder;
				color: white;
				text-shadow: 2px 2px 0px black;
				white-space: nowrap;
				line-height: 22px;

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

	// animation that makes text go from translate(-50%, 0) to translate(-50%, -50%)
	@keyframes slideUp {
		0% {
			transform: translate(-50%, 0px);
			opacity: 1;
		}

		75% {
			transform: translate(-50%, -75px);
			opacity: 1;
		}
		100% {
			transform: translate(-50%, -100px);
			opacity: 0;
		}
	}	

</style>
