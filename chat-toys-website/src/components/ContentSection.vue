<!--
	ContentSection
	--------------

	One of the big boxes with the build in dashed lines for the main content areas.

	These will be either left-or-right styled, as the dashed lines wrap left and right.

	These will also set up intersection observers with the viewport to trigger whatever animations
	their content needs, etc.
-->
<template>

	<!-- main outer-most wrapper -->
	<div
		ref="containerRef"
		class="content-section-box"
		:class="{
			left: isLeft,
			right: !isLeft,
			show: appearedOnce,
		}"
	>
		<!-- optional top circle -->
		<div 
			v-if="showTopCircle"
			class="top-circle"
		/>

		<!-- optional bottom circle -->
		<div 
			v-if="showBottomCircle"
			class="bottom-circle"
		/>

		<!-- the graphic stylized dashed lines to go left/right-->
		<div class="dashed-lines-section-main">
			<div class="lines"/>
		</div>
		<div class="dashed-lines-section-sub">
			<div class="lines"/>
		</div>
		
		<!-- the title of the section -->
		<div class="content-header">
			<h2 class="show my-header">{{ sectionTitle }}</h2>
			<h2 class="no-show my-header">{{ sectionTitle }}</h2>
			<div class="circle"></div>
		</div>

		<!-- the content of the section -->
		<div class="content-box">
			
			<!-- add some wide space to make room for the picture -->
			<div 
				v-if="sectionImage!=''"
				class="white-space"
			>
				<div 
					v-if="sectionImage!=''"
					class="pic-box"
					:class="{
						show: appearedOnce,
					}"
				>
					<img
						class="pic"
						draggable="false"
						width="80%"
						:src="sectionImage"
						:alt="sectionTitle"
						:style="{ 
							transform: 'translateY(-50%) scale(' + parseFloat(imageScale) + ')'
						}"
					/>
				</div>
			</div>

			<slot/>
		</div>

	</div>
</template>
<script setup>

// vue
import { ref, onMounted, onUnmounted, onBeforeUnmount } from 'vue';

// some props
const props = defineProps({
	
	// title text for the section
	sectionTitle: {
		type: String,
		default: "Section Title"
	},

	// image to show
	sectionImage: {
		type: String,
		default: ""
	},

	// optional image scaling
	imageScale: {
		type: String,
		default: "1"
	},

	// theme color for this section
	themeColor: {
		type: String,
		default: "#00ABAE"
	},

	// true if the dashed lines should be on the left side
	isLeft: {
		type: Boolean,
		default: true
	},

	// optional top circle for style
	showTopCircle: {
		type: Boolean,
		default: false
	},

	// optional top circle for style
	showBottomCircle: {
		type: Boolean,
		default: false
	}
});

// some events
const emits = defineEmits(['onScreenEnter', 'onScreenExit', 'onFirstEnter'])

// Threshold for detecting if the element is in the viewport
const visibility = 0.5;

// the main components outer dom element
const containerRef = ref(null);

// refs
const isOnScreen = ref(false)
const appearedOnce = ref(false)

// intersection observer
let observer = null;

onMounted(() => {

	// set up the intersection observer w/ the viewport
	observer = new IntersectionObserver(
		(entries) => {

			for (const entry of entries) {

				if (entry.target !== containerRef.value) 
					continue;

				const visible = entry.isIntersecting && entry.intersectionRatio >= visibility
				if (visible) {
					if (!isOnScreen.value) {
						isOnScreen.value = true
						emits('onScreenEnter', {
							bgColor: props.themeColor,
						})
					}
					if (!appearedOnce.value) {
						appearedOnce.value = true
						emits('onFirstEnter')
					}
				} else {
					if (isOnScreen.value) {
						isOnScreen.value = false
						emits('onScreenExit')
					}
				}
			
			}// next entry
		},
		{
			threshold: visibility
		}
	)

	// observe the container element
	if (containerRef.value) {
		observer.observe(containerRef.value)
	}
});

onBeforeUnmount(() => {

	// if we have an observer, unobserve the container element
	if (observer && containerRef.value) {
		observer.unobserve(containerRef.value)
		observer.disconnect()
	}
});

</script>
<style lang="scss" scoped>

	// main outer wrapper
	.content-section-box {

		pointer-events: none;

		// for debug
		/* border: 1px solid red; */

		// reset stacking context for children
		position: relative;
		
		// padding on top to make room for the title
		padding: 130px 0px 30px 0px;

		// the header w/ dashed underline
		.content-header {
			
			// for debug
			/* border: 1px solid red; */
			left: 5%;
			max-width: 50%;
			height: 1px;
			position: absolute;
			top: 127px;
			border-bottom: 3px dashed white;
			padding: 0px 20px;

			// animate in
			transform-origin: left;
			transform: scaleX(0);
			transition: transform 0.5s ease-in-out;

			h2 {
				line-height: 1.4rem;
				margin-bottom: 5px;
				text-align: center;

				&.show {
					pointer-events: initial;
					position: absolute;
					inset: auto 0px 0px 0px;					
				}

				&.no-show {
					opacity: 0;
				}

				// animate in
				transform-origin: bottom;
				transform: scaleY(0);
				transition: transform 0.5s ease-in-out;
				transition-delay: 0.4s;

			}// hd

			// white circle
			.circle {

				// fixed position
				position: absolute;
				top: -6px;
				right: -15px;

				// white circle
				width: 15px;
				height: 15px;
				border-radius: 100%;
				background: #ffffff;

				// animate in
				transform: scale(0);
				transition: transform 0.5s ease-in-out;
				transition-delay: 0.25s;
			}// .circle

		}// .content-header
		
		// box w/ actual content text
		.content-box {

			position: relative;
			top: 50px;
			opacity: 0;
			transition: 
				top 0.5s ease-in-out,
				opacity 0.5s ease-in-out;

			pointer-events: initial;

			/* position: absolute; */
			margin: 0% 5%;
			border-radius: 0px 0px 0px 36px;

			background: rgba(255, 255, 255, 0.25);
			background: #ffffff;
			background: linear-gradient(90deg, rgba(255, 255, 255, 0.25) 0%, rgba(255, 255, 255, 0) 80%);

			font-size: 12px;
			padding: 30px 20px;

			// box that floats left or right to push the text around to make room for the optional image
			.white-space {

				// for debug
				/* border: 1px solid red; */

				width: 40%;
				height: 100%;

				float: right;
				
				// shows picture over a grid
				.pic-box {

					position: relative;
					left: 15%;
					top: 0%;
					transform: translateY(-30%) scale(0);
					width: 100%;
					aspect-ratio: 1;
					border-radius: 100%;

					background-image: url('../assets/img/grid.png');
					background-size: contain;
					background-repeat: no-repeat;
					background-position: center;

					transition: transform 0.5s ease-in-out;
					&.show {
						transform: translateY(-30%) scale(1);
					}
					// actual picture
					.pic {
						position: absolute;
						left: 10%;
						top: 50%;						
					}// .pic

				}// .pic-box

			}// .white-space

		}// .content box

		// white circles
		.top-circle, .bottom-circle {

			// fixed position
			position: absolute;
			top: 0px;
			right: 5%;
			transform: translateX(40%);

			// white circle
			width: 15px;
			height: 15px;
			border-radius: 100%;
			background: #ffffff;

		}// .top-circle, .bottom-circle

		.bottom-circle {
			top: initial;
			bottom: 0px;
		}

		// dashed lines, common styles
		.lines {

			// for debug
			/* border: 1px solid cyan; */
			position: absolute;
		}

		// area where the dashed lines will go
		.dashed-lines-section-main, 
		.dashed-lines-section-sub {

			// for debug
			/* border: 1px solid yellow; */

			// fill the box with room on both sides
			position: absolute;		

			// prevent CSS rendering bug, our lines will be clipped
			overflow: clip;	
			
		}

		// the larger of the lines that connects from top & across bottom
		.dashed-lines-section-main {

			inset: 0px 10% 30px 5%;		
			.lines {
				inset: -3px -3px 0px 0px;
				border-left: 3px dashed white;
				border-bottom: 3px dashed white;
				border-radius: 0px 0px 0px 30px;
			}
		}// .dashed-lines-section-main
		
		// smaller line section that curves down to connect on the bottom
		.dashed-lines-section-sub {

			inset: auto 5% 0px auto;	
			width: 5%;
			height: 33px;
			.lines {
				inset: 0px 0px -3px -3px;
				border-right: 3px dashed white;
				border-top: 3px dashed white;
				border-radius: 0px 50px 0px 0px;
			}

		}// .dashed-lines-section-sub

		// over-ride styles just for the right-side boxes
		&.right {

			.content-header {
				left: initial;
				right: 5%;
				transform-origin: right;

				.circle {
					right: initial;
					left: -15px;
				}

			}// .content-header

			.content-box {

				/* position: absolute; */
				margin: 0% 5%;
				border-radius: 0px 0px 36px 0px;

				background: rgba(255, 255, 255, 0.25);
				background: #ffffff;
				background: linear-gradient(270deg, rgba(255, 255, 255, 0.25) 0%, rgba(255, 255, 255, 0) 80%);

				.white-space {

					float: left;

					.pic-box {

						left: initial;
						right: 15%;						

						.pic {
							position: absolute;
							left: initial;
							right: 10%;							
						}// .pic
						
					}// .pic-box

				}// .white-space

			}// .content-box

			.dashed-lines-section-main {

				inset: 0px 5% 30px 10%;		
				.lines {
					inset: -3px 0px 0px -4px;
					border-right: 3px dashed white;
					border-bottom: 3px dashed white;
					border-radius: 0px 0px 30px 0px;
				}
			}// .dashed-lines-section-main

			.dashed-lines-section-sub {

				inset: auto auto 0px 5%;	
				width: 5%;
				height: 33px;
				.lines {
					inset: 0px -4px -3px 0px;
					border-left: 3px dashed white;
					border-top: 3px dashed white;
					border-radius: 50px 0px 0px 0px;
				}

			}// .dashed-lines-section-sub

		}// .right

		&.show {

			.content-header {
				transform: scaleX(1);

				.circle {
					transform: scale(1);
				}

				h2 {
					transform: scaleY(1);
				}
			}

			.content-box {
				top: 0px;
				opacity: 1;
			}

		}// &.show


	}// .content-section-box

</style>
