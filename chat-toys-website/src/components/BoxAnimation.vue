<!--
	BoxAnimation.vue
	----------------

	The main component that handles the logic for the opening of the box animation and
	the various pieces that requires.

	In short, we'll have the following pieces in z-order:
	 - Box animation frames a square that shows the box rotating
	 - Content div - where the content from our slot lives
	 - Box-front - an image with the same size as the animation frames, that occludes the content
	 - Box-lid - the png that scrolls up after the animation is over, making the box appear to open

	In addition, we'll also have a area to display debug information, because
	there's lots of moving parts making this responsive, so we'll show some info.
-->
<template>

	<!-- displays debug info here -->
	<div class="debug-info">
		debug
	</div>

</template>
<script setup>

// vue
import { ref, onMounted, computed } from 'vue';

</script>
<style lang="scss" scoped>

	// fixed on top-left to show debug info
	.debug-info {
		
		// fixed on top-left
		position: fixed;
		top: 0px;
		left: 0px;

		// dark mode transparent box with some spacing
		background: rgba(0, 0, 0, .5);
		padding: 10px;

		// text-settings
		color: white;
		font-family: 'Courier New', Courier, monospace;
		
	}// .debug-info

</style>
