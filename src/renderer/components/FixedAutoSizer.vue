<!--
	FixedAutoSizer.vue
	------------------

	This is similar to the AutoSizer component, but both width and height are required parameters.
	It will compute scale in order to completely fit the container.
-->
<template>

	<div ref="container" class="auto-sizer-container">
		<slot />
	</div>

</template>
<script setup>

// vue
import { ref, onMounted, onBeforeUnmount, inject } from 'vue';

// props
const props = defineProps({

	// the width we want to base for the scale/fit
	targetWidth: {
		type: Number,
		required: true
	},

	// the height we want to base for the scale/fit
	targetHeight: {
		type: Number,
		required: true
	},

	// the scale value we want to bind to
	modelValue: {
		type: Number,
		required: true
	}
});

// define emits - specifically, for our v-model
const emit = defineEmits(['update:modelValue']);

// ref to the container we'll use to measure
const container = ref(null);

// the resize observer for our container so we can recompute on reflows/scale changes
let resizeObserver;

// if our component is mounted in the layout screen, it will have an additional scale applied to it.
// this breaks the regular scale code. This is ugly, but if we inject this variable we know we're
// on the layout screen and can cancel it's scale with the inverse value.
const layoutScreenScale = inject('layoutScreenScale', null);


/**
 * Function to compute the scale value we should apply to our v-model,
 * so our child consumers can use it to compute their own sizes.
 */
const updateScale = () => {

	// make sure we have ref to our container element or GTFO
	const el = container.value;
	if (!el) 
		return;

	// measure our container's current size
	const { width: containerWidth, height: containerHeight } = el.getBoundingClientRect();

	// figure out the ratio of the container to the target size
	const widthScale = containerWidth / props.targetWidth;
	const heightScale = containerHeight / props.targetHeight;

	// pick whichever ratio is smaller, so we can fit the container
	const fitScale = Math.min(widthScale, heightScale);

	// if we're on the layout screen, we need to cancel out the scale applied to it
	const finalScale = layoutScreenScale!== null ?
		(1/layoutScreenScale.value) * fitScale :
		fitScale;

	// set the scale value to our v-model
	emit('update:modelValue', finalScale);
};

// when the component mounts, we need to set up our resize observer
onMounted(() => {
	updateScale();
	resizeObserver = new ResizeObserver(updateScale);
	resizeObserver.observe(container.value);
});

// when the component unmounts, we need to disconnect our resize observer
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

	}// .auto-sizer-container

</style>
