<!--
	YTVideoBox.vue
	--------------

	This component will load a YouTube video thumbnail and play button,
	then when clicked, will open the video in a new window.

	This way we don't embed videos directly in the app, but we can still
	see the video and play it in a new window.
-->
<template>

	<!-- basic div to grab the clicks & show the thumbnail -->
	<div
		:style="thumbnailStyle"
		class="youtube-thumbnail"
		@click="openVideo"
	>
		<div class="play-button">
			<span>&#9658;</span>
		</div>
	</div>
</template>
<script setup>

// vue
import { computed } from 'vue'


// define some props
const props = defineProps({

	// the youtube URL of the video to show
	url: {
		type: String,
		required: true
	},

	// the width of the thumbnail, defaulting to 100%
	width: {
		type: String,
		default: '100%'
	}
});


// function to extract the video ID from the URL
const getVideoId = (url) => {
	const regex = /(?:youtube\.com\/.*v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
	const match = url.match(regex);
	return match ? match[1] : null;
}


// computed property to get the video ID from the URL if the prop changes
const videoId = computed(() => getVideoId(props.url));


// prepare reactive/computed styles for the thumbnail
const thumbnailStyle = computed(() => ({

	width: props.width,
	
	backgroundImage: videoId.value
		? `url(https://img.youtube.com/vi/${videoId.value}/maxresdefault.jpg)`
		: 'none',
}));


// function to open the video in a new window
const openVideo = () => {

	if (videoId.value) {

		// we'll use the embeded URL to open the video so it's full screen
		const embedUrl = `https://www.youtube.com/embed/${videoId.value}?modestbranding=1&rel=0`
		window.open(embedUrl, '_blank', 'width=800,height=450')
	}
}

</script>
<style lang="scss" scoped>

	// main box
	.youtube-thumbnail {

		// animate hover
		transition: transform 0.2s;
		&:hover {
			transform: scale(1.02);
		}

		// reset stacking context
		position: relative;

		// box settings
		aspect-ratio: 16 / 9;
		border: 2px solid black;
		border-radius: 8px;
		display: flex;
		align-items: center;
		justify-content: center;

		// background image details
		background-size: cover;
		background-repeat: no-repeat;
		background-position: center;
		
		// appear clickable
		cursor: pointer;		

		// the play button arrow / triangle icon
		.play-button {

			// box settings
			width: 80px;
			height: 80px;
			display: flex;
			align-items: center;
			justify-content: center;
			pointer-events: none;

			// text settings for the &#9658; triangle
			font-size: 64px;
			color: white;
			background: rgba(255, 255, 255, 0.3);
			border-radius: 50%;

			// just the arrow in the outer circle
			span {
				font-size: 60px;
				position: relative;
				left: 5px;
				top: -2px;

			}// span

		}// .play-button

	}// .youtube-thumbnail

</style>
