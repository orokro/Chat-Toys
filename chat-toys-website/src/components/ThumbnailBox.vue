<!--
	ThumbnailBox.vue
	----------------

	The box that shows thumbnails of videos and screenshots for each section.

	src\assets\img\screens\thumbs

-->
<template>

	<!-- main container -->
	<div 
		ref="container"
		class="thumbnail-box"
		@mouseenter="onMouseEnter"
		@mouseleave="onMouseLeave"
		@wheel="onWheel"
	>

		<!-- loop to generate the thumbnails -->
		<div
			v-for="n in parseInt(count, 10)"
			class="thumb"
			:key="`${slug}-${n}`"
			:style="{
				backgroundImage: `url(${getImage(slug, n)})`,
				backgroundSize: 'cover',
				backgroundPosition: 'center',
				margin: '5px',
				display: 'inline-block',
			}"
		>	
			<div
				v-if="videoUrl!='' && n === 1"
				class="play-button"
			>
				<svg viewBox="0 0 100 100" width="40" height="40" fill="white">
					<circle cx="50" cy="50" r="50" fill="white" />
					<polygon points="40,30 70,50 40,70" fill="black" />
				</svg>
			</div>

		</div>

	</div>

</template>
<script setup>

// vue
import { ref, onMounted, onUnmounted } from 'vue';

// define some props
const props = defineProps({
	
	// string to use to load thumbnails in the folder
	slug: {
		type: String,
	},

	// how many thumbnails?
	count: {
		type: String,
		default: "1"
	},

	// for now we'll only support one video thumbnail and it will always be the first
	// if this URL is non-empty, we'll use it as the video thumbnail
	videoUrl: {
		type: String,
		default: ""
	},
});

// import thumbnail images for dynamic generation
const thumbnailImages = import.meta.glob('@assets/img/screens/thumbs/*.jpg', { eager: true });

// helper method to get loaded image in template
function getImage(slug, n) {
	const key = `/src/assets/img/screens/thumbs/${slug}_0${n}.jpg`;
	const img = thumbnailImages[key]?.default;
	return img;
}

// DOM el for the container
const container = ref(null);
let hoverTimeStamp = 0;

// record time when we enter
function onMouseEnter() {
	hoverTimeStamp = Date.now();
}

// if the mouse leaves the container, reset the timestamp
function onMouseLeave() {
	hoverTimeStamp = 0;
}

// handle when the wheel is used
function onWheel(e) {	

	// if the timeStamp is <=0, GTFO
	if (hoverTimeStamp <= 0)
		return;	

	// compute delta time
	const deltaTime = Date.now() - hoverTimeStamp;

	// if the mouse hasn't been over the element for a while, GTFO
	if (deltaTime < 200)
		return;

	if (container.value)
		container.value.scrollLeft += e.deltaY / 5;

	// prevent default scroll behavior (you already use @wheel.prevent, but just in case)
	e.preventDefault();
	e.stopPropagation();
}

</script>
<style lang="scss" scoped>

	// main outer wrapper
	.thumbnail-box {
		
		display: flow-root;

		// reset stacking context
		position: relative;

		// for debug:
		/* border: 1px solid red; */

		// rounded darkish box
		background: rgba(0, 0, 0, 0.25);
		border-radius: 8px;
		box-shadow: inset 0 0 10px rgba(0, 0, 0, 0.1);

		// scroll horizontally only
		overflow-x: auto;

		// layout & spacing
		padding: 10px;
		display: flex;
		flex-direction: row;

		// actual thumbnail images
		.thumb {

			// reset stacking context
			position: relative;

			// don't resize for the flex
			flex-grow: 0;
			flex-shrink: 0;

			// rounded fix sized box
			border: 2px solid black;
			border-radius: 5px;
			width: 120px;
			height: 60px;

			// appear clickable
			cursor: pointer;

			// zoom on hover
			transition: transform 0.2s ease-in-out;
			&:hover {
				transform: scale(1.1);				
			}

			// play button for video thumbnails
			.play-button {

				// don't interfere with the button
				pointer-events: none;

				// center the play button icon
				position: absolute;
				top: 50%;
				left: 50%;
				transform: translate(-50%, -45%) scale(0.8);			
				
			}// .play-button

		}// .thumb

		&::-webkit-scrollbar {
			height: 12px;
		}

		&::-webkit-scrollbar-track {
			background: transparent;
		}

		&::-webkit-scrollbar-thumb {
			background-color: white;
			border-radius: 6px;
			
			// Creates "padding" effect
			border: 3px solid transparent; 

			// Ensures border doesn't overlay the background
			background-clip: content-box; 
			transition: background-color 0.2s ease-in-out;
		}

		&:hover::-webkit-scrollbar-thumb,
		&:active::-webkit-scrollbar-thumb {
			background-color: white;
		}

	}// .thumbnail-box

</style>
