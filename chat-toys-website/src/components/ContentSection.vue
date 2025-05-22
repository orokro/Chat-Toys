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
		class="content-section-box"
		:class="{
			'left': isLeft,
			'right': !isLeft
		}"
	>
		<!-- the graphic stylized dashed lines to go left/right-->
		<div class="dashed-lines-section-main">
			<div class="lines"/>
		</div>
		<div class="dashed-lines-section-sub">
			<div class="lines"/>
		</div>
		

		<!-- the title of the section -->
		<h2 class="content-header my-header">{{ sectionTitle }}</h2>

		<!-- the content of the section -->
		<div class="content-box">
			<slot/>
		</div>

	</div>
</template>
<script setup>

// vue
import { ref, onMounted, onUnmounted } from 'vue';

const defineProps = defineProps({
	
	sectionTitle: {
		type: String,
		default: "Section Title"
	},

	isLeft: {
		type: Boolean,
		default: true
	}

});

</script>
<style lang="scss" scoped>

	// main outer wrapper
	.content-section-box {

		// for debug
		/* border: 1px solid red; */

		// reset stacking context for children
		position: relative;

		// padding on top to make room for the title
		padding: 130px 0px 30px 0px;

		// the header w/ dashed underline
		.content-header {
			
			position: absolute;
			top: 91px;
			border-bottom: 3px dashed white;
		}

		
		// box w/ actual content text
		.content-box {

			/* position: absolute; */
			/* ins */
			margin: 0% 5%;
			border-radius: 0px 50px 50px 38px;

			background: rgba(255, 255, 255, 0.25);

			font-size: 12px;
			padding: 10px;
		}

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


		&.left {

			.content-header {
				padding: 0px 0px 0px 20px;
				left: 5%;
			}

			.dashed-lines-section-main {

				inset: 0px 10% 30px 5%;		
				.lines {
					inset: -3px -3px 0px 0px;
					border-left: 3px dashed white;
					border-bottom: 3px dashed white;
					border-radius: 0px 0px 0px 30px;
				}
			}// .dashed-lines-section-main
			
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

		}// .left

		&.right {

			.content-header {
				padding: 0px 20px 0px 0px;
				right: 5%;
			}

			.dashed-lines-section-main {

				inset: 0px 5% 30px 10%;		
				.lines {
					inset: -3px 0px 0px -3px;
					border-right: 3px dashed white;
					border-bottom: 3px dashed white;
					border-radius: 0px 0px 50px 0px;
				}
			}// .dashed-lines-section-main

			.dashed-lines-section-sub {

				inset: auto auto 0px 5%;	
				width: 5%;
				height: 33px;
				.lines {
					inset: 0px -3px -3px 0px;
					border-left: 3px dashed white;
					border-top: 3px dashed white;
					border-radius: 50px 0px 0px 0px;
				}

			}// .dashed-lines-section-sub

		}// .right

	}// .content-section-box

</style>
