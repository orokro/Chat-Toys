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
import { ref, onMounted } from 'vue';

// components
import MainPage from './components/MainPage.vue';

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
			background: linear-gradient(#5e5e5e, #000);
			background: linear-gradient(#00ABAE, #000);
			
			// always on bottom, no interaction
			z-index: -1;
			pointer-events: none;	
		}

		// use another pseudo element to add a tiled background image
		// that doesn't scroll with content
		&::after {

			// required content to make pseudo element work
			content: "";
			
			// fill screen
			position: fixed;
			inset: 0px 0px 0px 0px;
			width: 100vw;
			height: 100vh;

			// tiled background image over the screen
			background-image: url('assets/img/main_bg.png');
			background-size: 350px;
			background-position: center;

			// always on bottom, no interaction
			z-index: -1;
			pointer-events: none;	

		}// &::after

	}// body


	@media (min-width: 1024px) {

	}

</style>
