<!--
	MainPage.vue
	------------

	The main scrolling & ineractive page of the website
-->
<template>

	<!-- this thing will waste space for the beginning of the scrolling -->
	<div class="top-scroll-space"></div>

	<!-- header bar & image -->
	<div 
		:class="{
			'header-bar': true,
			'show': scrollY > 1480,
		}"
		align="center"
	>
		<!-- header image -->
		<img
			class="header-image"
			src="../assets/img/header.png"
			alt="header image"		
		/>
	</div>

	<!-- the animated box segment -->
	<BoxAni :scroll-y="scrollY" />

</template>
<script setup>

// vue
import { ref, onMounted, onUnmounted } from 'vue';

// components
import BoxAni from './BoxAni.vue';

// reactive vertical scroll variable
const scrollY = ref(0)

// function to update scroll position
function updateScroll() {
	scrollY.value = window.scrollY || window.pageYOffset
}


onMounted(() => {

	window.addEventListener('scroll', updateScroll, { passive: true })
	window.addEventListener('resize', updateScroll)

	requestAnimationFrame(() => {
		updateScroll()
	})
});


onUnmounted(() => {
	window.removeEventListener('scroll', updateScroll)
	window.removeEventListener('resize', updateScroll)
});


</script>
<style lang="scss" scoped>

	// area that just takes up space to provide some room to scroll before content begins
	.top-scroll-space {

		// for debug
		/* border-left: 10px solid red; */

		height: 3000px;

	}// .top-scroll-space

	.header-bar {

		// fixed on top
		position: fixed;
		top: 0px;
		left: 0px;
		right: 0px;

		// blurry bg
		background: rgba(0, 0, 0, 0.25);
		backdrop-filter: blur(5px);

		opacity: 0;
		transition: opacity 0s ease-in-out;
		&.show { 
			transition: opacity 0.15s ease-in-out;
			opacity: 1; 
		}


		.header-image {

			/* position: fixed; */
			width: 70vw;

		}// .header-image

	}// .header-bar

</style>
