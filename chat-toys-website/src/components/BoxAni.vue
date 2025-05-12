<!--
	BoxAni.vue
	----------

	Component to animate opening box
-->
<template>
	<div 
		class="box-ani-wrapper"
		:style="{
			'--scroll-frame': computedFrame,
		}"
	>
		<div 
			class="ani-frames"
			:data-frame="computedFrame"
			:style="{
				left: computedBoxScaleAndPos.left,
				bottom: computedBoxScaleAndPos.bottom,
				width: computedBoxScaleAndPos.scale + 'vw',
				
			}"
		>
			<!-- the lid of the box -->
			<div
				v-show="computedLidYPos > -1"
				class="box-lid"
				:style="{
					top: -computedLidYPos + 'px',
				}"
			></div>
		</div>

	</div>

</template>
<script setup>

// vue
import { ref, onMounted, computed } from 'vue';

// define some props
const props = defineProps({

	// the scroll position of the page
	scrollY: {
		type: Number,
		default: 0
	}

});

// step size for frames
const frameStepSize = 50;


// compute which frame of animation to show
const computedFrame = computed(() => {
	
	const frame = Math.floor(props.scrollY / frameStepSize);
	return (frame > 16) ? 16 : frame;
});

// compute the lid position (-1 should be hidden)
const computedLidYPos = computed(() => {
	
	const cutOff = (16 * frameStepSize) - 1;
	return (props.scrollY > cutOff) ? (props.scrollY-cutOff) : -1;
});

// the scale of the box
const computedBoxScaleAndPos = computed(() => {

	// cut if is where frames end
	const cutOff = (16 * frameStepSize) - 1;

	// if we're below the cut of, return defaults
	if(props.scrollY <= cutOff)
		return {
			scale: 100,
			left: '0vw',
			bottom: 'calc(50vh - 55vw)'
		}
	

	// the amount extra to scroll for the animation
	const aniDistance = 300;
	const aniScroll = props.scrollY - cutOff;

	const tUnclamped = aniScroll / aniDistance;
	const t = Math.min(Math.max(tUnclamped, 0), 1);
	const iT = 1.0 - t;

	// return interpolated values
	return {
		scale: 100 + (t * 50),
		left: (-25 * t) + 'vw',
		bottom: `calc(${50*iT}vh - ${55 + 5*t}vw)`
	}
});


</script>
<style lang="scss" scoped>

	.ani-frames {

		// for debug
		/* border: 1px solid red; */

		// fixed position w/ animation
		position: fixed;
		left: 0vw;
		width: 100vw;
		aspect-ratio: 1 / 1;

		/* transition: 
			bottom 0.5s ease-in-out,
			width 0.5s ease-in-out,
		; */
		

		// css glow filter
		/* filter: drop-shadow(0px 0px 10px #00ABAE99)
				drop-shadow(0px 0px 20px #00ABAE77)
				drop-shadow(0px 0px 30px #00ABAE66)
				drop-shadow(0px 0px 40px #00ABAE33)
				drop-shadow(0px 0px 50px #00ABAE22); */

		// background sprite sheet
		background-image: url('../assets/img/box_frames.webp');
		background-size: 400% 400%;
		background-position: 0% 0%;

		&[data-frame="0"]  { background-position:  0% 		0%; }
		&[data-frame="1"]  { background-position: -100% 	0%; }
		&[data-frame="2"]  { background-position: -200% 	0%; }
		&[data-frame="3"]  { background-position: -300% 	0%; }

		&[data-frame="4"]  { background-position:  0% 		-100%; }
		&[data-frame="5"]  { background-position: -100% 	-100%; }
		&[data-frame="6"]  { background-position: -200% 	-100%; }
		&[data-frame="7"]  { background-position: -300% 	-100%; }
		
		&[data-frame="8"]  { background-position:  0% 		-200%; }
		&[data-frame="9"]  { background-position: -100% 	-200%; }
		&[data-frame="10"] { background-position: -200% 	-200%; }
		&[data-frame="11"] { background-position: -300% 	-200%; }
		
		&[data-frame="12"] { background-position:  0% 		-300%; }
		&[data-frame="13"] { background-position: -100% 	-300%; }
		&[data-frame="14"] { background-position: -200% 	-300%; }
		&[data-frame="15"] { background-position: -300% 	-300%; }

		&[data-frame="16"] { 

			background-image: url('../assets/img/box_open.webp');
			background-size: 100% 100%;
			background-position: 0% 0%;
		}

		// animated lid PNG that opens up
		.box-lid {

			// for debug
			/* border: 1px solid cyan; */

			// fixed pos
			position: absolute;
			top: 0px;
			left: 0px;

			// fill container
			width: 100%;
			height: 100%;

			background-image: url('../assets/img/box_lid.webp');
			background-size: 100% 100%;
			background-position: 0% 0%;
			
		}// .box-lid

	}// .ani-frames

</style>
