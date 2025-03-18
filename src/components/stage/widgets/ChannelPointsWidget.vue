<!--
	ChanelPointsWidget.vue
	----------------------
	
	The icon that will periodically appear to allow chatters to claim points.
-->
<template>

	<!-- the main box for the widget -->
	<div class="channelPointsWidget">
		<div class="icon">
			<img
				:src="'/assets/channel_points/point_icon.png'"
				alt="channel points icon"
			/>
		</div>
		<div class="content">
			<slot></slot>
		</div>
	</div>

</template>
<script setup>

// vue
import { ref, watch } from 'vue';

const props = defineProps({
	demoMode: Boolean,
});

</script>
<style lang="scss" scoped>


	// the main box for the widget
	.channelPointsWidget {

		// fixed size (if the user wants to adjust size we'll use transforms)
		width: 200px;
		height: 200px;

		// for debug
		border: 1px solid red;
		
	}// .channelPointsWidget

</style>
