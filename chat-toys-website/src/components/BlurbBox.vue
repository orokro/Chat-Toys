<!--
	BlurbBox.vue
	------------

	Simple box for thoughts in the main content area.
-->
<template>
	<div class="blurb-box">
		<div class="blurb-content">
			<slot/>
		</div>
	</div>
</template>
<script setup>

// vue
import { ref, onMounted, onUnmounted } from 'vue';

</script>
<style lang="scss" scoped>

	.blurb-box {

		// spacing in & out
		margin: 0px 5%;
		

		.blurb-content {

			padding: 30px;
		
			// round white box
			background: rgba(255, 255, 255, 0.2);
			border-radius: 30px;
			
			text-shadow: 1px 1px 0px black;
			text-align: left;

		}// .blurb-content

	}// .blurb-box

</style>
