<!--
	Live.vue
	--------

	This is the root component for the live page, that will be compiled and served from Express
	in the final build, so that OBS can use it as a browser source.
-->
<template>

	<div class="pageContainer">
		<h1>Live</h1>

		<ChannelPointsWidget

		></ChannelPointsWidget>
	</div>
</template>
<script setup>

// vue
import { ref } from 'vue';

// include the demo channel points widget
import ChannelPointsWidget from '../components/stage/widgets/ChannelPointsWidget.vue';

</script>
<style lang="scss" scoped>

	// main page wrapper
	.pageContainer {

		// fill area
		position: absolute;
		inset: 0px;
		/* background: black; */

		h1 {
			color: black;
		}

	}// .pageContainer

</style>
