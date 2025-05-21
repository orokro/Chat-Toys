<!--
	BoxAnimation.vue
	----------------

	The main component that handles the logic for the opening of the box animation and
	the various pieces that requires.

	In short, we'll have the following pieces in z-order:
	 - Box animation frames a square that shows the box rotating
	 - Content div - where the content from our slot lives
	 - Box-front - an image with the same size as the animation frames, that occludes the content
	 - Box-lid - the png that scrolls up after the animation is over, making the box appear to open

	In addition, we'll also have a area to display debug information, because
	there's lots of moving parts making this responsive, so we'll show some info.
-->
<template>

	<!-- displays debug info here -->
	<div class="debug-info">
		{{ isLandscape ? 'landscape' : 'portrait' }}<br/>
		Scroll-Y Raw: {{ scrollY }}<br/>
		Initial Animation: {{ initialAnimationMode }}
	</div>

	<!-- 
		This will be the only element that isn't fixed/absolute positioned.
		It will be used to add computed white space height we'll use for scrolling.
	 -->
	<div 
		class="top-scroll-space"
		:style="whiteSpaceStyle"
	/>

	<!-- 
	 	This box will be the main root layer of everything visible.

		Because we want the main browser scroll bar to be used, we'll use the .top-scroll-space
		above to create the scrollable space, and we'll use JavaScript to manually scroll
		the content when appropriate.
	-->
	<div
		class="box"
		:style="boxStyle"
	>		
		<!-- This will be the first 16-frames of animation, the 17th frame (box open handled separately)-->
		<div
			v-show="initialAnimationMode"
			class="ani-frames"
			:data-frame="boxAniFrame"
		/>

		<!--
			After we run out of frames, we should show static image of box open.

			Note: we _could_ show the image as the BG of our .box parent,
			but I will use v-show instead so it mounts & loads and can appear without a network
			call. I realize there's other case to cache resources, but this is simple.
		-->
		<div
			v-show="initialAnimationMode == false"
			class="open-box"
		/>

		<!-- this will be the actual content that scrolls, along with the box lid -->
		<div
			v-show="initialAnimationMode == false"
			class="main-content"
			:style="contentStyle"
		>
			<slot/>
		</div>

		<!-- 
			This layer will be the image that appears in front (on top) of the content.
			This way it will occlude the content so it appears to come from within the box
		-->
		<div
			v-show="initialAnimationMode == false"
			class="box-front"
		/>

		<!-- Lastly, this will be the lid of he box that scrolls up with the rest of the content -->
		<div
			ref="lidElRef"
			v-show="initialAnimationMode == false"
			class="box-lid"
			:style="lidStyle"
		/>

	</div>

</template>
<script setup>

// vue
import { ref, onMounted, computed, onBeforeUnmount } from 'vue';

// element refs
const lidElRef = ref(null);

// some vars we'll use for layout & animations tate
const isPortrait = ref(false);
const isLandscape = ref(false);
const windowWidth = ref(window.innerWidth);
const windowHeight = ref(window.innerHeight);
const squareSize = ref(0);
const scrollY = ref(0);
const boxAniFrame = ref(0);
const initialAnimationMode = ref(true);

// for computing animation, we'll pick an arbitrary y-height to use
const initialAnimationScrollDistance = 16 * 50;

// scroll distance for moving the box down
const moveDownScrollDistance = 10 * 50;

// set up resize observer on the window
const bodyResizeObserver = new ResizeObserver((entries) => {
	entries.forEach(entry => {
		measureOrientation();
	});
});


// the size of the white space that will be used to create scrollable space
const whiteSpaceStyle = computed(() => {

	// for now, return a fixed size
	return {
		height: 9100 + 'px',
	}
});


// styles for the main box
const boxStyle = computed(() => {

	// compute where there box should be positioned
	// const scale = initialAnimationMode.value ? 1 : 1.5;

	/*
		the scale and bottom position will like so:
		
		bottom: 50% -> 5%
		scale: 1 -> 1.5

		We will use our constant moveDownScrollDistance to compute the interpolation
	*/

	// defaults
	let bottom = 45;
	let scale = 1;

	// only compute the interpolation if we're not in animation mode
	if(initialAnimationMode.value == false) {

		// compute the scale based on the scroll position
		const aniT = Math.min(Math.max((scrollY.value - initialAnimationScrollDistance) / moveDownScrollDistance, 0), 1);
		scale = 1 + (aniT * 0.5);

		// compute the bottom position based on the scroll position
		bottom = 45 - (aniT * 40);
	}

	// for now, return a fixed size
	return {
		width: squareSize.value + 'px',
		height: squareSize.value + 'px',
		bottom: `${bottom}%`,
		transform: `translateX(-50%) translateY(50%) scale(${scale})`
	}
});


// styles for the content area
const contentStyle = computed(() => {

	// the height is based on the lid position and it's height. It's height can change, however, based
	// on it's width aspect ratio, so we need to compute that too.

	// compute where there lid should be positioned
	const topPos = initialAnimationMode.value ? 0 : Math.max((scrollY.value - initialAnimationScrollDistance), 0);

	// get the HTML element of the lid & it's height or use 0 if null
	const lidHeight = (lidElRef.value ? lidElRef.value.clientHeight : 0) * 0.2;

	// reading .value of this will cause this computed method to recompute
	// this is hackish, but w/e
	const zero = (windowWidth.value / windowWidth.value) - 1;

	// for now, return a fixed size
	return {
		height: (initialAnimationMode.value ? 0 : (topPos-lidHeight+zero)) + 'px',
	}
});


// styles for the lid of the box
const lidStyle = computed(() => {

	// compute where there lid should be positioned
	let topPos = initialAnimationMode.value ? 0 : (scrollY.value - initialAnimationScrollDistance);
	if(topPos < 0)
		topPos = 0;
	
	// for now, return a fixed size
	return {
		top: (initialAnimationMode.value ? 0 : -topPos) + 'px',
	}
});


// initialize our animation & event listeners on start uip
onMounted(() => {

	// make sure we can measure when the body/window resizes
	bodyResizeObserver.observe(document.body);
	measureOrientation();
	window.addEventListener('resize', measureOrientation);

	// make sure we can measure scroll as it changes
	window.addEventListener('scroll', measureScroll, { passive: true })
});


// clean up stuff on unmount
onBeforeUnmount(() => {

	// clean up our window events if we unmount
	bodyResizeObserver.disconnect();
	window.removeEventListener('resize', measureOrientation);
});


/**
 * Measures our window and determines things like if we're portrait or landscape, etc.
 */
function measureOrientation() {

	// get the window size
	windowWidth.value = window.innerWidth;
	windowHeight.value = window.innerHeight;

	// check if we're in portrait or landscape mode
	isPortrait.value = (windowHeight.value > windowWidth.value);
	isLandscape.value = (windowWidth.value > windowHeight.value);

	// set the square size to the smaller of the two
	squareSize.value = Math.min(windowWidth.value, windowHeight.value);
}


/**
 * function to update scroll position
 */
function measureScroll() {

	// update our scroll position
	scrollY.value = window.scrollY || window.pageYOffset

	// normalize the scroll position to be between 0 and 1 for the animation
	const aniT = Math.min(Math.max(scrollY.value / initialAnimationScrollDistance, 0), 1);
	boxAniFrame.value = Math.floor(aniT * 16);

	// compute if we've exited the animation mode
	initialAnimationMode.value = (boxAniFrame.value < 15);
}

</script>
<style lang="scss" scoped>

	// the main box that's visible on screen
	.box {

		// var for our brightness
		--box-brightness: 1.4;

		// for debug
		/* background: rgba(0, 0, 0, 0.2); */
		/* border: 2px solid rgb(255, 166, 0); */

		// fixed positioning, centered initially
		position: fixed;
		left: 50%;	
		
		// the box that shows the animation frames
		.ani-frames {

			// for debug
			/* border: 1px solid cyan; */

			// fill container box 100%;
			position: absolute;
			inset: 0px 0px 0px 0px;

			// lighten it a bit
			filter: brightness(var(--box-brightness));

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
			
		}// .ani-frames	

		// image of the box open
		.open-box {

			// fill container box 100%;
			position: absolute;
			inset: 0px 0px 0px 0px;

			// background sprite sheet
			background-image: url('../assets/img/box_open.webp');
			background-size: 100% 100%;
			background-position: 0% 0%;

			// lighten it a bit
			filter: brightness(var(--box-brightness));

		}// .open-box

		// area where our page content will spawn
		.main-content {

			/* border: 2px solid yellow; */

			// fill container, but we half special left/right to fit "inside" the box
			position: absolute;
			inset: auto 18% 40% 18%;

			// we will control our scrolling via JS and don't want anything to "escape" the box
			overflow: hidden;

		}// .main-content

		// the png on top of the content to occlude it
		.box-front {

			// for debug
			/* border: 1px solid rgb(0, 255, 0); */
			/* opacity: 90%; */

			// fill container box 100%;
			position: absolute;
			inset: 0px 0px 0px 0px;

			// lighten it a bit
			filter: brightness(var(--box-brightness));

			// background sprite sheet
			background-image: url('../assets/img/bottom_front.png');
			background-size: 100% 100%;
			background-position: 0% 0%;
			
		}// .box-front

		// the lid PNG that will animate up with the scroll
		.box-lid {

			// for debug
			/* border: 1px solid rgb(0, 255, 0); */

			// fill container box 100%;
			position: absolute;
			left: 0px;
			right: 0px;
			width: 100%;
			height: 100%;

			// lighten it a bit
			filter: brightness(var(--box-brightness));

			// background sprite sheet
			background-image: url('../assets/img/box_lid.webp');
			background-size: 100% 100%;
			background-position: 0% 0%;

		}// .box-lid

	}// .box

	// the white space that is computed to create scrollable space
	.top-scroll-space {

		// for debug
		/* border-left: 10px solid red; */

	}// .top-scroll-space

	// fixed on bottom-left to show debug info
	.debug-info {

		// fixed on top-left
		position: fixed;
		bottom: 0px;
		left: 0px;
		z-index: 9001;

		// pretty
		border-radius: 0px 15px 0px 0px;

		// dark mode transparent box with some spacing
		background: rgba(0, 0, 0, .5);
		padding: 10px;

		// text-settings
		color: white;
		font-family: 'Courier New', Courier, monospace;

	}// .debug-info

</style>
