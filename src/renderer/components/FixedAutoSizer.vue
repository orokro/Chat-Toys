<template>
	<div ref="container" class="auto-sizer-container">
		<slot />
	</div>
</template>
<script setup>
import { ref, onMounted, onBeforeUnmount, inject } from 'vue';

const props = defineProps({
	targetWidth: {
		type: Number,
		required: true
	},
	targetHeight: {
		type: Number,
		required: true
	},
	modelValue: {
		type: Number,
		required: true
	}
});

const emit = defineEmits(['update:modelValue']);
const container = ref(null);

let resizeObserver;

const layoutScreenScale = inject('layoutScreenScale', null);

const updateScale = () => {
	const el = container.value;
	if (!el) return;

	const { width: containerWidth, height: containerHeight } = el.getBoundingClientRect();

	const widthScale = containerWidth / props.targetWidth;
	const heightScale = containerHeight / props.targetHeight;

	const fitScale = Math.min(widthScale, heightScale);

	const finalScale = layoutScreenScale!== null ?
		(1/layoutScreenScale.value) * fitScale :
		fitScale;

	emit('update:modelValue', finalScale);
};

onMounted(() => {
	updateScale();
	resizeObserver = new ResizeObserver(updateScale);
	resizeObserver.observe(container.value);
});

onBeforeUnmount(() => {
	if (resizeObserver && container.value) {
		resizeObserver.unobserve(container.value);
	}
});

</script>
<style scoped>
	.auto-sizer-container {
		position: relative;
		width: 100%;
		height: 100%;
		overflow: hidden;
	}
</style>
