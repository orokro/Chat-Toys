<!--
	TosserWidget.vue
	----------------

	The ThreeJS widget for the tosser system.
-->
<template>
	
	<!-- just a simple box -->
	<div 
		v-if="ready"
		class="tosserWidget" 
	>

		<div 
				ref="canvasContainerRef"	
				class="canvasContainer"
		></div>

		<div 
			class="colliderImage"
			:style="{
				width: colliderBox.width + 'px',
				height: colliderBox.height + 'px',
				left: colliderBox.x + 'px',
				top: colliderBox.y + 'px',
			}"
			@mousedown="handleStartColliderDrag"
		>
			
			<div 
				class="resizeHandle"
				@mousedown="handleStartColliderResize"
			></div>
		</div>

	</div>

</template>
<script setup>

// vue
import { ref, watch, computed, inject, onMounted, shallowRef } from 'vue';
import { chromeRef, chromeShallowRef } from '../../scripts/chromeRef';
import { socketShallowRefReadOnly } from 'socket-ref';

// lib/misc
import DragHelper from 'gdraghelper';
import { ThreeJSTosserSystem } from './ThreeJSTosserSystem';

// our settings system
import { useToySettings } from '@toys/useToySettings';

const thisSlug = 'tosser';
const slugify = (text) => {
	return thisSlug + '__' + text.toLowerCase();
}

// ref to the canvas container
const canvasContainerRef = ref(null);

// make new instance of the drag helper
const dragHelper = new DragHelper();

// we'll store the settings in a chrome ref for now
// until a better solution is found
const colliderBox = chromeShallowRef('tosserColliderPos', {
	x: 0,
	y: 0,
	width: 748 * 0.2,
	height: 1200 * 0.2,
});

const emit = defineEmits([
	'boxChange'
]);

// define some props
const props = defineProps({

});

// store models available locally
const modelsAvailable = shallowRef([]);

// gets our settings
const ready = ref(false);
const socketSettingsRef = useToySettings('tosser', 'widgetBox', emit, () => {
	ready.value = true;
	console.log(socketSettingsRef.value);
	modelsAvailable.value = socketSettingsRef.value.tosserAssets;
});

let tosserSystem = null;

onMounted(()=>{

	console.log(canvasContainerRef.value);

	watch(canvasContainerRef, (newVal)=>{
		
		if(newVal != null && tosserSystem == null){

			// make new tosser system
			tosserSystem = new ThreeJSTosserSystem(
				canvasContainerRef,
				modelsAvailable,
				colliderBox
			);

			window.ts = tosserSystem;
		}
	});

});

// gets live sockets
// const wheelImagePath = socketShallowRefReadOnly(slugify('wheelImagePath'), null);

// // the audio
// let audio = null;

// // update the audio if its changes
// watch(wheelSoundPath, (newVal) => {
// 	audio = new Audio(wheelSoundPath.value);
// });


// handle the drag of the collider box
function handleStartColliderDrag(e){

	doDrag(['x', 'y']);
}


// handle the resize of the collider box
function handleStartColliderResize(e){

	e.cancelBubble = true;
	doDrag(['width', 'height']);
}


// generic drag function for either x/y or width/height
function doDrag(keys){

	// save initial position
	const initialBox = {
		...colliderBox.value
	};
	
	// start the drag
	dragHelper.dragStart(
		
		// during drag
		(dx, dy)=>{

			const newBox = {
				...colliderBox.value,
			};
			newBox[keys[0]] = initialBox[keys[0]] - dx;
			newBox[keys[1]] = initialBox[keys[1]] - dy;

			// update live box
			colliderBox.value = newBox;
		},

		// upon complete
		(dx, dy)=>{

		}
	);

}

</script>
<style lang="scss" scoped>

	// the main box for the widget
	.tosserWidget {

		// fill parent
		width: 100%;
		height: 100%;

		// reset stacking context
		position: relative;

		// allow pointer events on this layer so we can move the collider thing
		pointer-events: initial !important;
		&:hover {
			border: 1px solid white;
			.colliderImage {
				opacity: 0.75;
			}
		}

		.canvasContainer {
			position: absolute;
			inset: 0px;
		}

		// the area where we show a collider to send the info to ThreeJS
		.colliderImage {

			// absolute position
			position: absolute;

			// silhouette collider image
			background-image: url('/assets/tosser_collider_outline.png');
			background-position: 0px 0px;
			background-size: 100% 100%;

			// re-enable pointer events & make look movable
			pointer-events: initial !important;
			cursor: move;

			// light up on hover
			opacity: 0.0;
			&:hover {
				opacity: 1;
				border: 2px dashed white;
			}

			// the box to resize. Only one for this widget cuz lazy
			.resizeHandle {

				// fixed position square on the bottom-right
				position: absolute;
				bottom: -15px;
				right: -15px;
				width: 30px;
				height: 30px;

				// gray box
				background: gray;
				border: 2px solid black;

				// appear resizable	
				cursor: nwse-resize;

			}// .resizeHandle

		}// .colliderImage

	}// .tosserWidget
	
</style>
