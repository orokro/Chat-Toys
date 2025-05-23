<!--
	App.vue
	-------

	Main entry point to the website
-->
<template>

	<main>
	
		<MainPage/>
	</main>

</template>
<script setup>

// vue
import { ref, onMounted, provide, watch } from 'vue';

// components
import MainPage from './components/MainPage.vue';

// make a reactive BG theme color & provide to children
const bgThemeColor = ref('#00ABAE')
provide('bgThemeColor', bgThemeColor)

// we need to append a raw DOM style element to manipulate the ::before dynamically
let styleEl;

// method to update the body::before style
const updateBodyBeforeStyle = (color) => {

	// generate new css for our raw style element
	const css = `
		body::before {
			transition: background 2s ease-in-out !important;
			background: linear-gradient(${color}, #000);
		}
	`;

	// if not yet created, create it
	if (!styleEl) {
		styleEl = document.createElement('style')
		document.head.appendChild(styleEl)
	}

	// update the style element with the new css
  	styleEl.textContent = css
}

// if any of our children change the bgThemeColor, update the body::before style
watch(bgThemeColor, (newColor) => {
	updateBodyBeforeStyle(newColor)
});

// make sure we set up our gradient once on start up
onMounted(() => {
  	updateBodyBeforeStyle(bgThemeColor.value)
});

</script>
<style lang="scss">

	// add gradient & titled images to main page background
	body {

		/* background: linear-gradient(#5e5e5e, #000);
		background-position: fixed; */

		// use pseudo element to add a vertical gradient that doesn't scroll with content
		&::before {

			// required content to make pseudo element work
			content: "";

			// fill screen
			position: fixed;
			inset: 0px 0px 0px 0px;
			width: 100vw;
			height: 100vh;

			// just a nice gradient
			/* background: linear-gradient(#00ABAE, #000); */
			transition: background 2 ease-in-out;

			// always on bottom, no interaction
			z-index: -1;
			pointer-events: none;	
		}

		// use another pseudo element to add a tiled background image
		// that doesn't scroll with content
		&::after {

			// required content to make pseudo element work
			content: "";
			opacity: 0.33;
			// fill screen
			position: fixed;
			inset: 0px 0px 0px 0px;
			width: 100vw;
			height: 100vh;

			// tiled background image over the screen
			background-image: url('assets/img/main_bg.png');
			background-size: 70vh;
			background-position: center;

			// always on bottom, no interaction
			z-index: -1;
			pointer-events: none;	

		}// &::after

	}// body


	@media (min-width: 1024px) {

	}

</style>
