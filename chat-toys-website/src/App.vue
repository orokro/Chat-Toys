<!--
	App.vue
	-------

	Main entry point to the website
-->
<template>

	<main>
		<div
			class="page-wrapperz"
		>
			<MainPage/>
		</div>
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

	.page-wrapper {
		
		// main column that has a max size so its not too big on wide screen
		min-width: 700px;
		max-width: 1000px;
		width: 100%;

		// center the column
		margin: 0 auto;
		
		// for debug
		border: 2px solid yellow;
		
	}// .page-wrapper

	@media (min-width: 1024px) {

	}

</style>
