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

				<div class="c tl"></div>
				<div class="c tr"></div>
				<div class="c bl"></div>
				<div class="c br"></div>

				<!-- show the fish -->
				<div
					v-for="(fish, index) in gameState.fish"
					class="fish"					
					:key="index"
					:style="{
						left: fish.screenPosX + 'px',
						top: fish.screenPosY + 'px',
					}"
				></div>

				<!-- show the cast bobbles -->
				<div 
					v-for="(bobble, index) in gameState.casts"
					class="bobble"
					:key="index"
					:style="{
						left: bobble.screenX + 'px',
						top: bobble.screenY + 'px',
					}"
				>
					<div class="image"></div>
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


// gets our settings
const ready = ref(false);
const socketSettingsRef = useToySettings('fishing', 'widgetBox', emit, () => {
	ready.value = true;
});

// gets live sockets
const gameState = socketShallowRefReadOnly(slugify('gameState'), '');

watch(gameState, (newVal) => {
	if (newVal) {
		console.log('gameState', newVal);
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

			// fill the whole box
			position: absolute;

			// gray transparent circle
			width: 15px;
			height: 15px;
			border-radius: 50%;
			background-color: rgba(0, 0, 0, 0.5);

			// fade out towards distance
			mask-image:
				radial-gradient(circle, rgb(0, 0, 0, 1) 20%,
					rgba(0, 0, 0, 0) 70%,
					rgba(0, 0, 0, 0) 100%);
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

		}//. bobble

		.c {
			position: absolute;
			width: 5px;
			height: 4px;
			background: lime;

			&.tl { left: 35px; top: 53px; }
			&.tr { left: 210px; top: 53px; }
			&.bl { left: 12px; top: 188px; }
			&.br { left: 232px; top: 188px; }			
		}

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

</style>
