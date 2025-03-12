<!--
	ModalOverlay.vue
	----------------

	The blurry / dark overlay that appears when a modal is active.
-->
<template>
	<div
		class="modalOverlay"
		@click="$emit('close')"
	>

	</div>
</template>
<script setup>

// vue
import { defineProps } from 'vue';

// props
const props = defineProps({

	// is the modal currently active?
	active: {
		type: Boolean,
		default: false
	}

});

</script>
<style lang="scss" scoped>

	// the overlay
	.modalOverlay {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		background-color: rgba(0, 0, 0, 0.5);
		z-index: 1000;
		transition: opacity 0.3s;
		opacity: 0;
		pointer-events: none;

		&.active {
			opacity: 1;
			pointer-events: all;
		}
	}
</style>
