<!--
	FishingWidget.vue
	-----------------
	
	The fishing mini game widget.
-->
<template>

	<!-- auto sizer so we can lazily scale the widget lol -->
	<AutoSizer :targetWidth="250" v-model="scale">

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
				class="fishingWidget"				
			>
				<!-- animated gif of caustics -->
				<div class="caustics"></div>

				<!-- show the fish -->
				<div
					v-for="(fish, index) in gameState.fish"
					:key="index"
					class="fish"	
				>
					<div 
						v-for="(pos, j) in fish.oldPositions"
						:style="{
							left: pos[0] + 'px',
							top: pos[1] + 'px',
							transform: `translate(-50%, -50%) scale(${(j/20)+0.2})`,
						}"
						class="fishShape"
						:class="{
							debugColors: false,	
							nibble: fish.nibbling,
							attract: fish.mode=='attract' && fish.nibbling==false,
							wander: fish.mode=='wander',
							sadWander: fish.mode=='sadwander',			
						}"	
					>
					</div>
				</div>

				<!-- show the cast bobbles -->
				<div 
					v-for="(bobble, index) in gameState.casts"
					:key="index"
					class="bobble"				
					:class="{
						nibble: bobbleIsBeingNibbled(bobble),
					}"	
					:style="{
						left: bobble.screenX + 'px',
						top: bobble.screenY + 'px',
					}"
				>
					<div class="ripple">
						<div class="inner"></div>
					</div>
					<div class="image">
						<div 
							class="line"
							:class="{
								altLine: (bobble.number%2==0),
								flip: ((1+bobble.number%2==0) ^ (bobble.number%5==0)),								
							}"
						></div>
					</div>
					<div class="name">{{ bobble.username }}</div>
					
				</div>

				<!-- some hard-coded ripple locations -->
				<div class="ripple tl"><div class="inner"></div></div>
				<div class="ripple tr"><div class="inner"></div></div>
				<div class="ripple l"><div class="inner"></div></div>
				<div class="ripple br"><div class="inner"></div></div>

				<!-- the message box for when chatter catches a fish -->
				<div 
					v-if="currentCatch!=null" 
					class="catchMessage"
				>

					<!-- our bobble image & fishing line -->
					<div class="bobbleBig">
						<div class="line"></div>
					</div>

					<!-- the image of the caught fish -->
					<img
						:src="currentCatch.fishImage" 
						class="fishImage" 
						:width="70*currentCatch.fishScale"
					/>

					<!-- top message -->
					<div class="message fishText">
						<span class="username">{{ currentCatch.username }}</span>
						<br>
						<span class="username">
							<span class="caughtA">caught a </span>
							<span class="fishName">{{ currentCatch.fishName }}!</span>
						</span>
					</div>	

					<!-- the points -->
					<div class="points fishText">
						<span>+{{ currentCatch.fishPoints }}</span> points
					</div>

				</div>

			</div>
		</div>
	</AutoSizer>

</template>
<script setup>

// vue
import { ref, watch, computed } from 'vue';
import { chromeRef, chromeShallowRef } from '../../scripts/chromeRef';
import { RefAggregator } from '../../scripts/RefAggregator';
import { socketShallowRefReadOnly } from 'socket-ref';

// other components
import AutoSizer from '@components/AutoSizer.vue';

// our app
import { useToySettings } from '@toys/useToySettings';

// inherit scale from AutoSizer
const scale = ref(1);

const thisSlug = 'fishing';
const slugify = (text) => {
	return thisSlug + '__' + text.toLowerCase();
}

const emit = defineEmits([
	'boxChange'
]);

// define some props
const props = defineProps({

});


// helper method to see if a specific bobble is being nibbled
const bobbleIsBeingNibbled = function(bobble) {
	return this.gameState.fish.some((fish) => {
		return fish.nibbling && fish.targetCast.userID == bobble.userID;
	});
};

// gets our settings
const ready = ref(false);
const socketSettingsRef = useToySettings('fishing', 'widgetBox', emit, () => {
	ready.value = true;
});

// gets live sockets
const gameState = socketShallowRefReadOnly(slugify('gameState'), '');
const catches = socketShallowRefReadOnly(slugify('catches'), '');


// keep a time stamp of the last catch we saw, so we don't double spawn
let lastCatchTime = 0;

// keep an array queue of catches to show on screen, serially
const catchQueue = [];

// reactive variable for current catch
const currentCatch = ref(null);

// watch for when our state catch list changes
watch(catches, (newVal) => {

	if (newVal) {		

		// filter out any ones that are newer than the last one we saw
		const filtered = newVal.filter((catchObj) => {
			return catchObj.time > lastCatchTime;
		});

		// loop to add the filtered catches to the queue & update the last time
		for (let i = 0; i < filtered.length; i++) {
			catchQueue.push(filtered[i]);
			lastCatchTime = Math.max(lastCatchTime, filtered[i].time);
		}// next i

		// if our catch queue is not empty, show the first one & start loop
		if(catchQueue.length > 0) {
			showCatch();
		}
	}

}, { deep: true });


// show the next catch in the queue
function showCatch(){

	// get the first item in the queue
	const catchObj = catchQueue.shift();
	if (catchObj) {

		// set the current catch
		currentCatch.value = catchObj;

		// set a timeout to clear the current catch
		setTimeout(() => {
			currentCatch.value = null;
			if (catchQueue.length > 0) {

				setTimeout(() => {
					showCatch();
				}, 100);
			}
		}, 4000);
	}
}


</script>
<style lang="scss" scoped>

	// box used to scale the widget
	.scaleBox {
		
		// same size as the default widget scale
		width: 250px;
		height: 250px;
		
		// center in the widget
		position: absolute;
		top: 50%;
		left: 50%;
		
	}// .scaleBox

	// the main box for the widget
	.fishingWidget {

		// fixed size (if the user wants to adjust size we'll use transforms)
		width: 250px;
		height: 250px;

		// reset stacking context
		position: relative;

		// make circle with fadeout mask
		border-radius: 50%;
		overflow: hidden;
		mask-image:
			radial-gradient(circle, rgb(255, 255, 255, 1) 62%,
				rgba(255, 255, 255, 0) 70%,
				rgba(255, 255, 255, 0) 100%);

		// load the lake as the bg	
		background-image: url('/assets/fishing/lake.png');
		background-position: 50% 70%;
		background-size: 110% 110%;
		background-repeat: no-repeat;

		// animated caustics gif
		.caustics {

			// fill the whole box
			position: absolute;
			inset: 0px;

			// use animated gif for bg
			background-image: url('/assets/fishing/caustics.gif');
			background-position: 50% 50%;
			background-size: 50% 50%;
			background-repeat: repeat;

			opacity: 0.5;
			mix-blend-mode: overlay;

			// fade out towards distance
			mask-image:
				linear-gradient(rgb(0, 0, 0, 0) 20%,
					rgba(0, 0, 0, 1) 70%,
					rgba(0, 0, 0, 1) 100%);

		}// .caustics

		// a fish
		.fish {
			pointer-events: initial;
			cursor: pointer;

			// entire fish slightly transparent
			opacity: 0.5;

			// a number of circles that trail off and get smaller to show fish path
			.fishShape {

				// fixed pos
				position: absolute;

				// gray transparent circle
				width: 25px;
				height: 25px;
				border-radius: 50%;
				background-color: rgba(0, 0, 0, 1);

				// fade out towards distance
				mask-image:
					radial-gradient(circle, rgb(0, 0, 0, 1) 20%,
						rgba(0, 0, 0, 0) 70%,
						rgba(0, 0, 0, 0) 100%);

				// show fish stat via debugging
				&.debugColors {
				
					&.attract { background-color: rgba(0, 255, 242, 0.5); }
					&.nibble { background-color: rgba(0, 255, 0, 0.5) !important; }
					&.wander { background-color: rgba(39, 22, 87, 0.5); }
					&.sadWander { background-color: rgba(83, 16, 16, 0.5); }

				}// &.debugColors

			}// .fishShape

		}// .fish

		// a users cast bobble
		.bobble {

			position: absolute;
			border: 1px solid red;
			width: 1px;
			height: 1px;
			transform: translate(0px, -10px);
			
			// the ripple
			.ripple {
				left: -25px;
				top: -12px;
				transform: scale(0.7, 0.3);
			}
			
			// the bobble image, centered
			.image {

				width: 15px;
				height: 20px;

				animation: bobbleFloat 5s infinite ease-in-out;
				background: url('/assets/fishing/bobble.png') no-repeat center center;
				background-size: 100% 100%;

				.line {

					// fixed rectangle based on top of the bobble image
					position: absolute;
					bottom: 15px;
					left: 5px;
					width: 70px;
					height: 250px;

					// background image
					background: url('/assets/fishing/line.png') no-repeat center center;
					background-size: 100% 100%;

					// slight height variation
					&.altLine {
						
						height: 175px;
					}

					// flipped line
					&.flip {
						transform: scaleX(-1);
						left: auto;
						right: 5px;
					}

				}// .line

			}// .image
			
			
			// the name of the cast
			.name {

				// fixed above bobble
				position: absolute;
				top: 0px;
				left: 50%;
				transform: translate(-50%, -100%);

				// text settings
				font-size: 10px;
				color: white;
				text-align: center;
				text-shadow: 1px 1px 1px black;
				white-space: nowrap;

			}// .name
			
			// nibble animation
			&.nibble { 
				.image {
					animation: bobbleFloatNibble 2s infinite ease-in-out;
				}
			}

		}//. bobble


		// ripple box
		.ripple {

			// fixed position
			position: absolute;
			top: 100px;
			left: 100px;
			width: 50px;
			height: 50px;

			// default scale
			transform: scaleY(0.4);

			// specific named ripples for the scene
			&.tl {
				top: 67px;
				left: 4px;
			}
			&.tr {
				top: 65px;
				left: 193px;
			}
			&.l {
				top: 110px;
				left: -10px;
			}
			&.br {
				top: 173px;
				left: 192px;
				transform: scale(1.5, 0.6);
			}

			// fade out
			mask-image:
				radial-gradient(circle, rgb(0, 0, 0, 1) 50%,
					rgba(0, 0, 0, 0) 70%,
					rgba(0, 0, 0, 0) 100%);

			// animated ripple image
			.inner {
				width: 50px;
				height: 50px;

				background: url('/assets/fishing/ripples.png') no-repeat center center;
				background-size: 100% 100%;

				// bg image for ripple
				background-position: center;
				transform-origin: center center;
				animation: spinBg 1s infinite ease-in-out alternate,
						zoomBg 1s infinite ease-in-out alternate;
			}// .inner

		}// .ripple

		// the box with the catch messages
		.catchMessage {

			--text-opacity: 1;

			// fixed position
			position: absolute;
			left: 50%;
			top: 15%;
			transform: translate(-50%, 0%);

			// fixed size w/ padding on top to push fish image down
			width: 150px;
			padding-top: 15px;

			// text settings
			text-align: center;

			// text settings
			.fishText {

				opacity: var(--text-opacity);

				font-size: 14px;
				font-weight: bolder;
				color: white;
				text-align: center;
				line-height: 19px;
				text-shadow: 3px 2px 0px black;

			}// .fishText

			// the top message w/ users name & message
			.message {

				position: absolute;
				inset: 0px 0px auto 0px;

				.username {					
					white-space: nowrap;
					color: yellow;
					background: rgba(0, 0, 0, 0.5);
					border-radius: 25px;
					padding: 0px 5px;
				}

				.caughtA {
					color: white;
				}
				.fishName {
					white-space: nowrap;
					color: lime;
				}

			}// .message

			.points {
				position: absolute;
				inset: auto 0px 0px 0px;

				/* background: rgba(0, 0, 0, 0.5);
				padding: 0px 5px;
				border-radius: 25px; */

				span {
					color: lime;
					font-size: 30px;
				}

			}// .points

			// bobble
			.bobbleBig {

				// fixed position
				position: absolute;
				left: 50%;
				top: 0px;
				transform: translate(-60%, -45%);
				z-index: 0;

				// fixed size
				width: 30px;
				height: 40px;

				// animated bobble image
				background: url('/assets/fishing/bobble.png') no-repeat center center;
				background-size: 100% 100%;
				transform-origin: center center;
				
				// div that fades out as it goes upward
				.line {

					position: absolute;
					bottom: 35px;
					left: 14px;
					width: 3px;
					height: 250px;

					background: black;
					
					// fade out towards distance
					mask-image:
						linear-gradient(rgb(0, 0, 0, 0) 20%, rgba(0, 0, 0, 1) 100%);

				}// .line

			}// .bobbleBig


			// the image of the caught fish
			.fishImage {

				position: relative;
				transform-origin: top center;
				
				// animated fish image
				animation: fishHang 1s infinite ease-in-out alternate;
				
			}// .fishImage

			animation: showCatch 4s forwards ease-in-out;

		}// .catchMessage

	}// .fishingWidget

	@keyframes showCatch {
		0% {
			transform: translate(-50%, 180%);
			--text-opacity: 0;
		}
		20% {
			transform: translate(-50%, 0%);
			--text-opacity: 0;
		}
		25% {
			transform: translate(-50%, 0%);
			--text-opacity: 1;
		}
		75% {
			transform: translate(-50%, 0%);
			--text-opacity: 1;
		}
		80% {
			transform: translate(-50%, 0%);
			--text-opacity: 0;
		}
		100% {
			transform: translate(-50%, -150%);
			--text-opacity: 0;
		}		
	}

	
	@keyframes fishHang {
		0%   { transform: rotate(-3deg) scale(1); }
		100% { transform: rotate(3deg) scale(1); }
	}

	@keyframes spinBg {
		0%   { transform: rotate(-30deg) scale(1); }
		50%  { transform: rotate(0deg) scale(1); }
		100% { transform: rotate(30deg) scale(1); }
	}

	@keyframes zoomBg {
		0%   { transform: scale(1.05) rotate(-30deg); }
		50%  { transform: scale(0.97) rotate(0deg); }
		100% { transform: scale(1.05) rotate(30deg); }
	}

	@keyframes bobbleFloat {
		0%   { transform: translate(-50%, 0); }
		15%  { transform: translate(-50%, -6px); }
		30%  { transform: translate(-50%, -3px); }
		45%  { transform: translate(-50%, -7px); }
		60%  { transform: translate(-50%, -2px); }
		75%  { transform: translate(-50%, -5px); }
		90%  { transform: translate(-50%, -1px); }
		100% { transform: translate(-50%, 0); }
    }

	@keyframes bobbleFloatNibble {
		0%   { transform: translate(-50%, 0px); }
		15%  { transform: translate(-52%, -2px); }
		30%  { transform: translate(-50%, -1px); }
		45%  { transform: translate(-47%, -3px); }
		60%  { transform: translate(-50%, -0px); }
		75%  { transform: translate(-53%, -2px); }
		90%  { transform: translate(-49%, -3px); }
		100% { transform: translate(-51%, -1px); }
    }

</style>
