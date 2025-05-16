<!--
	BoxFront.vue
	------------

	The box animation happens on an lower z-index than the main page content,
	however to make the illusion complete, we need a box front that occludes
	the content behind it.

	This will be used as a pair with the BoxAni.vue component.

	We will listen to evens on the BoxAni component to know when the box is open,
	and then this component will show on top of the pages content, and the page content
	will fade in, etc.
-->
<template>
	<div class="box-top-wrapper">
		<div 
			class="main-box"
			:style="{
				bottom: '0%',
				width: 150 + 'vw',
				maxWidth: (1100 * (150/100)) + 'px',
				transform: `translateX(-50%) translateY(45%)`
			}"
		>

			<!-- the box overlay on the bottom to occlude content -->
			<div class="box-top"></div>

		</div>

	</div>

</template>
<script setup>

// vue
import { ref, onMounted, computed } from 'vue';

</script>
<style lang="scss" scoped>

	.main-box {

		// for debug
		/* border: 1px solid red; */

		// fixed position w/ animation
		position: fixed;
		width: 100vw;
		max-width: 1100px;
		aspect-ratio: 1 / 1 !important;
		z-index: 9001;

		bottom: 0%;
		left: 50%;
		
		// lighten it a bit
		filter: brightness(1.5);

		// the top of the box that occludes content
		.box-top {

			// for debug
			/* border: 1px solid blue; */
			/* filter: brightness(.5); */

			// fixed pos
			position: absolute;
			inset: 0px 0px 0px 0px;

			background-image: url('../assets/img/bottom_front.png');
			background-size: 100% 100%;
			background-position: 0% 0%;

		}// .box-top

	}// .main-box

</style>
