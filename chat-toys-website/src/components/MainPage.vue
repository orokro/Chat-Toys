<!--
	MainPage.vue
	------------

	The main scrolling & ineractive page of the website
-->
<template>

	<!-- this thing will waste space for the beginning of the scrolling -->
	<div class="top-scroll-space"></div>

</template>
<script setup>

// vue
import { ref, onMounted } from 'vue';

</script>
<style lang="scss" scoped>

	// area that just takes up space to provide some room to scroll before content begins
	.top-scroll-space {

		height: 1500px;
		border-left: 10px solid red;
	
	}// .top-scroll-space

</style>
