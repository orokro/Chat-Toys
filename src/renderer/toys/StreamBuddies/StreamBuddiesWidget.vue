<!--
	StreamBuddiesWidget.vue
	-----------------------

	The ThreeJS widget for the tosser system.
-->
<template>
	
	<!-- just a simple box -->
	<div 
		v-if="ready"
		class="buddiesWidget"
		:class="{
			demoMode: demoMode,
		}"
	>

		<div 
				ref="canvasContainerRef"	
				class="canvasContainer"
		></div>
		
		<!-- <pre>
			{{ buddiesState }}
		</pre> -->
		
		<!-- loop to draw buddy boxxies (i.e. their name and optional chat messages)-->
		<div
			v-for="(buddy, index) in buddiesState.buddies"
			:key="index"
			class="buddyBox"			
			:style="{
				left: buddy.x + 'px',
				top: buddy.y + 'px',
				transform: 'scale(' + buddySize + ')',
			}"
		>
			<div 
				class="buddy"
				:class="{
					left: buddy.dir == 'left',
					right: buddy.dir == 'right',
					sitting: buddy.stateMode == 'sitting',
				}"
			>

				<!-- the stylized name above the buddy -->
				<div class="buddyName">{{ buddy.username }}</div>

				<!-- animated fart -->
				<div 
					v-if="buddy.farting"
					class="fart"
				></div>

				<!-- chat bubble show message -->
				<div class="chatBubble"
					:class="{
						active: buddy.chatMessageTime>0
					}"
				>
					<div class="arrow arrowUnder"></div>
					<div class="bubbleOuter">
						<div class="bubbleInner">
							{{ buddy.chatMessage }}
						</div>
					</div>
					<div class="arrow arrowOver"></div>
				</div>

				<!-- debug infos -->
				<template v-if="false">
					<div class="debugStuff">
						<div>{{ buddy.stateMode }}</div>
						<div>{{ buddy.dir }}</div>
						<div v-if="buddy.hugging">hugging</div>
						<div v-if="buddy.attacking">attacking</div>
						<div v-if="buddy.farting">farting</div>
						<div v-if="buddy.knockback">knockback</div>
						<div v-if="buddy.dancing">dancing</div>
						<div v-if="buddy.inAir">in air</div>
					</div>
				</template>
			</div>
		</div>

	</div>

</template>
<script setup>

// vue
import { ref, watch, computed, inject, onMounted, onBeforeUnmount, shallowRef } from 'vue';
import { chromeRef, chromeShallowRef } from '../../scripts/chromeRef';
import { socketShallowRefReadOnly } from 'socket-ref';

// lib/misc
import DragHelper from 'gdraghelper';
import { ThreeJSBuddiesSystem } from './ThreeJSBuddiesSystem';

// our settings system
import { useToySettings } from '@toys/useToySettings';
import { keepAliveSocket } from '../keepAliveSocket.js';

const thisSlug = 'streamBuddies';
const widgetSlug = 'streamBuddiesLayer';
const slugify = (text) => {
	return thisSlug + '__' + text.toLowerCase();
}

// set up our live-light code
keepAliveSocket(thisSlug, widgetSlug);

// ref to the canvas container
const canvasContainerRef = ref(null);

const emit = defineEmits([
	'boxChange'
]);

const modelPath = chromeRef('model-path', '');

// define some props
const props = defineProps({

});

// path to 3d model for avatar
// const avatarPath = socketShallowRefReadOnly(slugify('avatarPath'), {});

// gets our settings
const ready = ref(false);
const buddySize = ref(1);
const socketSettingsRef = useToySettings('stream-buddies', 'widgetBox', emit, () => {
	ready.value = true;	
	console.log('buddies settings', socketSettingsRef.value);
	buddySize.value = socketSettingsRef.value.buddySize;
});

// copy to local refs for legibility
watch(socketSettingsRef, (newVal) => {
	if(newVal == null)
		return;
	buddySize.value = socketSettingsRef.value.buddySize;

	if(modelPath.value != socketSettingsRef.value.modelPath){
		modelPath.value = socketSettingsRef.value.modelPath;
		console.log('model path changed', modelPath.value);

		// refresh the current page
		window.location.reload();
	}
});


// update our local copy of the tosser assets when the settings change
watch(socketSettingsRef, (newVal) => {
	// modelsAvailable.value = socketSettingsRef.value.tosserAssets;
});

// socket data
const demoMode = socketShallowRefReadOnly('demoMode', false);
const buddiesState = socketShallowRefReadOnly(slugify('buddiesState'), {});



// wait for our ref to exist & then make the tosser system
let buddiesSystem = null;
watch(canvasContainerRef, (newVal)=>{

	// if we have a new canvas container, and we don't have a tosser system yet
	if(newVal != null && buddiesSystem == null){

		// make new tosser system
		buddiesSystem = new ThreeJSBuddiesSystem(
			canvasContainerRef,
			buddiesState,
			buddySize,
			modelPath,
		);

		// expose on window for debug
		window.bs = buddiesSystem;
	}
});


// when this component is unmounted, destroy the tosser system
onBeforeUnmount(() => {

	if(buddiesSystem != null){
		buddiesSystem.end();
		buddiesSystem = null;
	}
});


</script>
<style lang="scss" scoped>

	// the main box for the widget
	.buddiesWidget {

		// fill parent
		width: 100%;
		height: 100%;

		// reset stacking context
		position: relative;

		/* background: rgba(255, 255, 255, 0.1); */
		color: white;

		// place to spawn threeJS canvas
		.canvasContainer {
			position: absolute;
			inset: 0px;
		}

		&.demoMode {
			border: 1px dashed rgba(255, 255, 255, 0.5) !important;
		}

		// CSS box for the buddy (non ThreeJS part)
		.buddyBox {

			// fixed positioning
			position: absolute;

			// we'll be a small 1x1 square and then overflow the actual box & other things
			width: 1px;
			height: 1px;

			// box for the actual user
			.buddy {

				// fixed size for now
				width: 70px;
				height: 100px;

				// overflow up out of our 1x1 box
				position: absolute;
				bottom: 0px;
				left: -35px;

				// fart sprite
				.fart {

					// fixed size /p position
					position: absolute;
					bottom: 20px;
					right: 40px;
					width: 20px;
					height: 20px;

					opacity: 0.5;
					
					// background sprite sheet settings
					background-image: url('assets/buddies/fart_sprite_sheet.png');
					background-size: 300% 300%;
					background-position: 100% 0%;
					background-repeat: no-repeat;

					// use keyframes to animate the sprite
					animation: fartSpriteAnimation forwards 1s steps(1);
				
				}// .fart

				// css sprite key frames for the fart
				@keyframes fartSpriteAnimation {
					0%   { background-position: 0% 0%; }
					11.11% { background-position: 50% 0%; }
					22.22% { background-position:100% 0%; }
					33.33% { background-position: 0% 50%; }
					44.44% { background-position: 50% 50%; }
					55.55% { background-position:100% 50%; }
					66.66% { background-position: 0% 100%; }
					77.77% { background-position: 50% 100%; }
					88.88% { background-position:100% 100%; }
					100%  { background-position:100% 100%; }
				}

				&.sitting {
					.fart {
						bottom: 0px;
					}
				}
				&.left {
					.fart {
						left: 45px;
						right: auto;

					}
				}
				&.right {
					.fart {
						right: 45px;
						left: auto;
						/* background: red !important; */
						transform: scaleX(-1);
					}
				}

				// debug text
				.debugStuff {
					font-size: 12px;
					line-height: 12px;
					font-family: 'Courier New', Courier, monospace;
					opacity: 0.5;

				}// .debugStuff
			
				// the user name above the user
				.buddyName {

					position: absolute;
					top: -5px;
					left: 50%;
					transform: translateX(-50%);

					// text settings
					font-size: 12px;
					font-family: 'Open Sans', sans-serif;
					text-align: center;
					color: white;
					text-shadow: 1px 1px 0px rgba(0, 0, 0, 1);
					white-space: nowrap;

				}// .buddyName

				// the chat bubble above the user when they're chatting
				.chatBubble {

					// fixed above center
					position: absolute;
					top: -10px;
					left: 50%;
					width: 200px;
					height: 1px;
					transform: translateX(-50%);

					// the bottom center for scaling
					transform-origin: bottom left;

					// for animating in-and-out
					scale: 0;
					transition: scale 0.25s ease-in-out;
					&.active {
						scale: 1;
					}

					// wrapper to move the bubble up
					.bubbleOuter {
						
						// position on bottom so text pushes up
						position: absolute;
						bottom: 0px;						
						width: 100%;
						text-align: center;

						// the actual text will be centered in this div, which will
						// max its width at he the size 2 levels up (.chatBubble)
						.bubbleInner {

							// so we center
							display: inline-block;

							// white bubble settings
							background: white;
							border-radius: 5px;
							border: 2px solid black;
							padding: 1px 5px;
							
							// text setting
							font-size: 12px;
							line-height: 12px;
							font-family: monospace;
							color: black;

						}// .bubbleInner
						
					}// .bubbleOuter

					// the arrow layers
					.arrow {
						position: absolute;
						left: 50%;
						bottom: -1px;

						width: 12px;
						height: 12px;
						box-sizing: content-box;

						// rotate the box pointing down
						transform: translateX(-50%) rotate(45deg);

						// the top arrow is white with no border
						&.arrowOver {
							
							background: white;
							mask-image:
								linear-gradient(
									135deg,
									rgb(0, 0, 0, 0) 48%,
									rgba(0, 0, 0, 1) 49%,
									rgba(0, 0, 0, 1) 100%);

						}// &.arrowOver

						// the bottom arrow is black with a border
						&.arrowUnder {
							bottom: -2px;
							background: black;
							border: 2px solid black;

						}// &.arrowUnder

					}// &.arrow

				} // chatBubble

			}// .buddy

		}// .buddyBox

	}// .buddiesWidget
	
</style>
