<!--
	FixedAutoSizer.vue
	------------------

	FixedAutoSizer will be a div that just chills with 100% width and 100% height
	to fill whatever it's parent's container is.

	It will measure itself, including with a resize observer
	so it can tell it's parent how big it is.

	In it's params it will take both a target width or height, and
	compute it's size based on the the target as a normalized ratio.

	Then it will provide the ratio so its children can use it to
	compute their own sizes.
-->
<template>

	<!-- simple div to autosize-->
	<div ref="container" class="auto-sizer-container">

		<!-- this is the div that will be scaled -->
		<div 
			class="auto-sizer-content" 
			:style="{
				transform: `scale(${scale})`,
				width: `${targetWidth}px`,
				height: `${targetHeight}px`,
				transformOrigin: 'top left',
				position: 'absolute',
				left: `${offsetX}px`,
				top: `${offsetY}px`
			}"
		>
			<!-- just wrap children and nothing else. e-z -->
			<slot />
		</div>

	</div>

</template>
<script setup>

// vue
import { ref, onMounted, onBeforeUnmount, watchEffect } from 'vue';

// define some props
const props = defineProps({
	targetWidth: {
		type: Number,
		required: true
	},
	targetHeight: {
		type: Number,
		required: true
	}
});

// ref to main element for measuring
const container = ref(null);

// v-model binding (expects a ref/shallowRef)
const scaleModel = defineModel();

// computed values for scale & offset
const scale = ref(1);
const offsetX = ref(0);
const offsetY = ref(0);

// we'll use this to watch for resize events
let resizeObserver;


/**
 * Method to update the scale and offsets
 */
const updateScale = () => {

	// get the container element & gtfo if it doesn't exist
	const el = container.value;
	if (!el)
		return;

	// get the size of the container
	const { width: containerWidth, height: containerHeight } = el.getBoundingClientRect();

	// compute the ratio of the target size to the container size
	const widthScale = containerWidth / props.targetWidth;
	const heightScale = containerHeight / props.targetHeight;

	// use the smaller scale to fit the target in the container
	const finalScale = Math.min(widthScale, heightScale);
	scale.value = finalScale;
	// scaleModel.value = finalScale;

	// Calculate leftover space for centering
	const scaledWidth = props.targetWidth * finalScale;
	const scaledHeight = props.targetHeight * finalScale;

	offsetX.value = (containerWidth - scaledWidth) / 2;
	offsetY.value = (containerHeight - scaledHeight) / 2;
};


// set up a watcher to update the scale when the target size changes
onMounted(() => {
	updateScale();
	resizeObserver = new ResizeObserver(updateScale);
	resizeObserver.observe(container.value);
});


// clean up the resize observer when the component is unmounted
onBeforeUnmount(() => {
	if (resizeObserver && container.value) {
		resizeObserver.unobserve(container.value);
	}
});

</script>
<style lang="scss" scoped>

	.auto-sizer-container {
		position: relative;
		width: 100%;
		height: 100%;
		overflow: hidden;

		border: 2px solid magenta;
	}


	.auto-sizer-content {
		will-change: transform;

		border: 3px solid greenyellow;
	}

</style>
