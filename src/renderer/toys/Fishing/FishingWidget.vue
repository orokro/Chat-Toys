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

watch(gameState, (newVal) => {
	if (newVal) {
		// console.log('gameState', newVal);
	}
}, { deep: true });

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

			// fill the whole box
			/* position: absolute; */

			// entire fish slightly transparent
			opacity: 0.5;
			
			/* transform: translate(-10px, 0px); */
			
			/* border: 10px solid red;
			width: 1px;
			height: 1px; */

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
			
			// the bobble image, centered
			.image {
				width: 15px;
				height: 20px;
				/* transform: translate(-50%, -65%); */
				animation: bobbleFloat 5s infinite ease-in-out;

				background: url('/assets/fishing/bobble.png') no-repeat center center;
				background-size: 100% 100%;
				/* opacity: 0.5; */

				.line {

					position: absolute;
					bottom: 15px;
					left: 5px;

					width: 70px;
					height: 250px;

					background: url('/assets/fishing/line.png') no-repeat center center;
					background-size: 100% 100%;

					&.altLine {
						
						height: 175px;
					}

					&.flip {
						transform: scaleX(-1);
						left: auto;
						right: 5px;
					}

					
				}

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

	}// .fishingWidget

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
