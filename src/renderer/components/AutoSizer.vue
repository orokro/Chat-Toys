<!--
	AutoSizer.vue
	-------------

	AutoSizer will be a div that just chills with 100% width and 100% height
	to fill whatever it's parent's container is.

	It will measure itself, including with a resize observer
	so it can tell it's parent how big it is.

	In it's params it will take either a target width or height, and
	compute it's size based on the the target as a normalized ratio.

	Then it will provide the ratio so its children can use it to
	compute their own sizes.
-->
<template>

	<!-- simple div to autosize-->
	<div
		ref="autoSizeDiv"
		class="autoSizer"
	>
		<!-- just wrap children and nothing else. e-z -->
		<slot/>

	</div>

</template>
<script setup>

// vue
import { ref, onMounted, onBeforeUnmount, provide } from 'vue';

// props
const props = defineProps({

	// target width if we're using it (only one of these should be set)
	// if both are set, width will take precedence
	targetWidth: {
		type: Number,
		default: null
	},

	// target height if we're using it (only one of these should be set)
	targetHeight: {
		type: Number,
		default: null
	}
});

// v-model binding (expects a ref/shallowRef)
const scaleModel = defineModel();

// the div we're measuring
const autoSizeDiv = ref(null);

// the computed scale
const scale = ref(1);

// provide the scale for children further down
provide('autoSizerScale', scale);

/**
 * Measure our autosize div & compute the scale
 */
function computeScale(){

	// get the target size (width or height), width takes precedence
	const measureEdge = props.targetWidth ? 'width' : 'height';
	const targetSize = props.targetWidth || props.targetHeight;
	
	// get the actual size of the autosize div
	const actualSize = measureEdge === 'width'
	? autoSizeDiv.value.offsetWidth
	: autoSizeDiv.value.offsetHeight;

	// compute the scale
	scale.value = actualSize / targetSize;
	scaleModel.value = scale.value;
}

// resize observer for the autosize div
const resizeObserver = new ResizeObserver(computeScale);

// on mount, observe the autosize div & compute the scale initially
onMounted(()=>{
	resizeObserver.observe(autoSizeDiv.value);
	onMounted(computeScale);
});

// on unmount, stop observing the autosize div
onBeforeUnmount(()=>{
	resizeObserver.unobserve(autoSizeDiv.value);
});

</script>
<style lang="scss" scoped>

	// a div that fills it's parent so we can measure it
	.autoSizer {

		// fill width/height
		width: 100%;
		height: 100%;

		// for debug
		/* border: 10px dashed lime; */

	}// .autoSizer

</style>
