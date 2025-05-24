<!--
	ThumbModal.vue
	--------------

	The component we'll use with the jenesius-vue-modal library to show a modal with
	with the expanded images / thumbs / videos.
-->
<template>
	<div
		class="modal-window"
		@click.self="closeModal()"
	>
		<div 
			class="modal-content"
			:style="{
				backgroundImage: shouldShowVideo ? 'none' : `url(${currentImageUrl})`,
			}"
		>
			<iframe
				v-if="shouldShowVideo"
				width="100%"
				height="100%"
				:src="`https://www.youtube.com/embed/${videoUrl}`"
				title="YouTube video player"
				frameborder="0"
				allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
				allowfullscreen
			></iframe>

			<!-- the close button -->
			<div
				class="close-button button"
				@click.stop="closeModal()"
			>
				<span>&#10006;</span>
			</div>

			<!-- the left/right buttons -->
			<template 
				v-if="count>1"
			>
				<div
					class="nav-button button left"
					:class="{
						disabled: currentIndex === 0,
					}"
					@click.stop="decrementIndex"
				>
					<span>&#9664;</span>
				</div>
				<div
					class="nav-button button right"
					:class="{
						disabled: currentIndex >= count-1,
					}"
					@click.stop="incrementIndex"
				>
					<span>&#9654;</span>
				</div>				
			</template>
		</div>
		<div class="thumb-row">

			<ThumbnailBox
				class="thumb-box"
				:slug="slug"
				:count="`${count}`"
				:selected-index="currentIndex"
				:videoUrl="videoUrl"
				@thumbnail-click="handleThumbnailClick"
			/>
		</div>

	</div>	

</template>
<script setup>

// vue
import { ref, onMounted, computed, inject } from 'vue';

// components
import ThumbnailBox from './ThumbnailBox.vue';

// lib misc
import { closeModal, Modal } from 'jenesius-vue-modal';


// current image URL / index
const currentIndex = ref(0);
const currentImageUrl = computed(()=>{
	return getImage(props.slug, currentIndex.value);	
});


// import thumbnail images for dynamic generation
const fullImages = import.meta.glob('@assets/img/screens/full/*.png', { eager: true });


// true when we wanna show the video
const shouldShowVideo = computed(()=>{
	return props.videoUrl!='' && currentIndex.value === 1;
});

// helper method to get loaded image in template
function getImage(slug, n) {
	const key = `/src/assets/img/screens/full/${slug}_0${n}.png`;
	const img = fullImages[key]?.default;
	return img;
}


// props
const props = defineProps({
	
	// the slug for the thumbnail
	slug: {
		type: String,
		default: ''
	},

	// the number of thumbnails to show
	count: {
		type: Number,
		default: 1
	},

	// current index to show
	index: {
		type: Number,
		default: 0
	},

	// the video URL to show
	videoUrl: {
		type: String,
		default: ''
	}
});


// set up current index on mount
onMounted(()=>{
	currentIndex.value = props.index;
});


/**
 * Handle when a thumbnail is clicked to change the main image/video
 * 
 * @param thumbnail {Object} the thumbnail object
 */
function handleThumbnailClick(thumbnail) {
	currentIndex.value = thumbnail.index;

};

/**
 * Navigate left
 */
function decrementIndex() {
	if(currentIndex.value > 1)
		currentIndex.value--;
};

/**
 * Navigate right
 */
function incrementIndex() {
	if(currentIndex.value < props.count)
		currentIndex.value++;
};

</script>
<style lang="scss" scoped>
		
	// main container
	.modal-window {

		user-select: none;

		// fill screen
		width: 100%;
		height: 100%;

		// reset stacking context for children
		position: relative;

		// blurred dark bg
		background: rgba(0, 0, 0, 0.5);
		backdrop-filter: blur(5px);

		// padding on bottom for thumbs row
		padding-bottom: 90px;

		// area to spawn thumbnails
		.thumb-row {

			// for debug
			/* border-top: 1px solid red;  */

			// fixed on bottom
			position: absolute;
			inset: auto 0px 0px 0px;
			height: 90px;

			.thumb-box {		
				max-width: 100% !important;
				justify-content: flex-start;

			}// .thumb-box

		}// .thumb-row

	}// .modal-window

	/* the modal content */
	.modal-content {
		
		// for debug
		/* border: 1px solid red; */
		pointer-events: none;

		position: absolute;
		inset: 10px 10px 110px 10px;

		padding: 20px;
		background-size: contain;
		background-position: center;
		background-repeat: no-repeat;

		iframe {
			pointer-events: initial;
			background: black;
		}

		// our nav / close buttons
		.button {

			// re-enable pointer events & look clickable
			pointer-events: initial;
			cursor: pointer;
			
			text-align: center;

			// round circle that expands on hover
			width: 30px;
			height: 30px;
			border-radius: 100%;
			background: rgba(255, 255, 255, 0.5);
			transform: scale(1);
			transition: 
				background 0.2s ease-in-out,
				transform 0.2s ease-in-out;

			&:hover {
				background: rgba(255, 255, 255, 0.8);
				transform: scale(1.3);
			}

			// icon styles in the span inside
			span {
				position: relative;
				top: 2px;
				color: white;
				font-weight: bolder;
			}// span

			// left/right buttons
			&.left {
				position: absolute;
				left: 10px;
				top: 50%
			}// .left

			&.right {
				position: absolute;
				right: 10px;
				top: 50%;
			}// .right

			// close button
			&.close-button {
				position: absolute;
				top: 10px;
				right: 10px;
			}// .close-button

		}// .button

	}// .modal-content

</style>
