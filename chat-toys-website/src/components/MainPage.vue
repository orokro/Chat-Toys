<!--
	MainPage.vue
	------------

	The main scrolling & ineractive page of the website
-->
<template>

	<!-- this thing will waste space for the beginning of the scrolling -->
	<div class="top-scroll-space"></div>

	<!-- header image -->
	<img
		v-show="scrollY > 1500"
		class="header-image"
		src="../assets/img/header.png"
		alt="header image"		
	/>

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
})

onUnmounted(() => {
	window.removeEventListener('scroll', updateScroll)
	window.removeEventListener('resize', updateScroll)
})


</script>
<style lang="scss" scoped>

	// area that just takes up space to provide some room to scroll before content begins
	.top-scroll-space {

		height: 3000px;

	}// .top-scroll-space

	.header-image {

		position: fixed;
		top: 0px;
		left: 50%;
		width: 70vw;
		transform: translateX(-50%);
	}
</style>
