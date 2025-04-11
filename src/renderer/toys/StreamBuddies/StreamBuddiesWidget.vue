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
	>

		<div 
				ref="canvasContainerRef"	
				class="canvasContainer"
		></div>

			buddies yo1
			<pre>
				{{ buddiesState }}
			</pre>
			
			<!-- loop to draw buddy boxies (i.e. their name and optional chat messages)-->
			<div
				v-for="(buddy, index) in buddiesState.buddies"
				:key="index"
				class="buddyBox"
				:style="{
					left: buddy.x + 'px',
					top: buddy.y + 'px',
				}"
			>
				<div class="buddy">
					<div class="buddyName">{{ buddy.username }}</div>
					<div>{{ buddy.stateMode }}</div>
					<div v-if="buddy.hugging">hugging</div>
					<div v-if="buddy.attacking">attacking</div>
					<div v-if="buddy.farting">farting</div>
					<div v-if="buddy.knockback">knockback</div>
					<div v-if="buddy.dancing">dancing</div>
					<div v-if="buddy.inAir">in air</div>
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

const thisSlug = 'streamBuddies';
const slugify = (text) => {
	return thisSlug + '__' + text.toLowerCase();
}

// ref to the canvas container
const canvasContainerRef = ref(null);

// make new instance of the drag helper
const dragHelper = new DragHelper();

const emit = defineEmits([
	'boxChange'
]);


// define some props
const props = defineProps({

});


// gets our settings
const ready = ref(false);
const socketSettingsRef = useToySettings('stream-buddies', 'widgetBox', emit, () => {
	ready.value = true;	
	console.log('buddies settings', socketSettingsRef.value);
});


// update our local copy of the tosser assets when the settings change
watch(socketSettingsRef, (newVal) => {
	// modelsAvailable.value = socketSettingsRef.value.tosserAssets;
});


// wait for our ref to exist & then make the tosser system
let buddiesSystem = null;
watch(canvasContainerRef, (newVal)=>{

	// if we have a new canvas container, and we don't have a tosser system yet
	if(newVal != null && buddiesSystem == null){

		// make new tosser system
		buddiesSystem = new ThreeJSBuddiesSystem(
			canvasContainerRef,
		);

		// expose on window for debug
		window.bs = buddiesSystem;
	}
});


// watch when new items are scheduled to be tossed
let lastCommandTimeStamp = 0;
const buddiesState = socketShallowRefReadOnly(slugify('buddiesState'), []);
watch(buddiesState, (newVal) => {

	// console.log(newVal);
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

		background: rgba(255, 255, 255, 0.1);
		color: white;

		// place to spawn threeJS canvas
		.canvasContainer {
			position: absolute;
			inset: 0px;
		}

		// CSS box for the buddy (non TrheeJS part)
		.buddyBox {

			// fixed positioning
			position: absolute;

			// we'll be a small 1x1 square and then overflow the actual box & other things
			width: 1px;
			height: 1px;

			// for debugging
			border: 1px solid red;

			// box for the actual user
			.buddy {

				// fixed size for now
				width: 70px;
				height: 100px;

				// overflow up out of our 1x1 box
				position: absolute;
				bottom: 0px;
				left: -35px;

				font-size: 12px;
				background: rgba(230, 230, 250, 0.205);
			
				// the user name above the user
				.buddyName {

					position: absolute;
					top: -20px;
					left: 50%;
					transform: translateX(-50%);

					// text settings
					font-size: 12px;
					text-align: center;
					color: white;
					text-shadow: 1px 1px 0px rgba(0, 0, 0, 1);
					white-space: nowrap;

				}// .buddyName

			}// .buddy

		}// .buddyBox

	}// .buddiesWidget
	
</style>
