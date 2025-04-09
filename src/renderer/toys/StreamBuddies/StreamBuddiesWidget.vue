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

			buddies yo

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
const commandQueue = socketShallowRefReadOnly(slugify('commandQueue'), []);
watch(commandQueue, (newVal) => {

	console.log(newVal);
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

		// place to spawn threeJS canvas
		.canvasContainer {
			position: absolute;
			inset: 0px;
		}

	}// .buddiesWidget
	
</style>
