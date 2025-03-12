<!--
	ModalWindowFrame.vue
	--------------------

	This component makes the border / close button, and title areas
	for reusable modal windows.

	In the future, this may also allow for resize / drag functionality.
-->
<template>

	<div 
		class="modalWindowFrame"
		:class="{ 
			'hasClose': showClose
		}"
		:style="{ 
			width: `${width}px`,
			height: `${height}px`
		}"	
	>
		<!-- the title bar / header -->
		<div class="titleBar">

			<!-- the actual title -->
			<div class="title">
				{{ props.title }}
			</div>

			<!-- the close button -->
			<div
				v-if="showClose"
				class="closeButton"
				@click="closeModal"
			>
				<span class="material-icons">close</span>
			</div>

		</div>

		<!-- the content -->
		<div class="content">
			<slot></slot>
		</div>

	</div>

</template>
<script setup>

// vue
import { ref } from 'vue';

// lib misc
import { closeModal } from 'jenesius-vue-modal';

// props
const props = defineProps({
	
	// the title for the modal window
	title: {
		type: String,
		default: 'Modal Window'
	},

	// true if we should show the close button
	showClose: {
		type: Boolean,
		default: true
	},

	// width
	width: {
		type: Number,
		default: 600
	},

	// height
	height: {
		type: Number,
		default: 400
	},

});

</script>
<style lang="scss" scoped>

	// the main window frame
	.modalWindowFrame {

		// new stacking context
		position: relative;

		// rounded border box
		border: 2px solid #000;
		background: #FFF;
		border-radius: 15px;

		// allow nothing to escape
		overflow: hidden;

		// title bar on top
		.titleBar {

			// fixed on top w/ fixed height
			position: absolute;
			inset: 0px 0px auto 0px;
			height: 30px;

			// black w/ white text
			background: #000;
			color: #FFF;

			// title goes here, slightly different if we have a close button
			.title {

				position: absolute;
				inset: 0px 0px 0px 0px;				
				padding-top: 3px;

				// allow nothing to escape
				overflow: hidden;

				// text settings
				text-align: center;
				font-weight: bold;
				white-space: nowrap;
				text-overflow: ellipsis;

				// for debug
				/* border: 1px solid red; */
			}// .title

		}// .titleBar

		// the content area
		.content {

			// fill area under title
			position: absolute;
			inset: 30px 0px 0px 0px;
			overflow: auto;

			// for debug
			/* border: 1px solid red; */

		}// .content

		&.hasClose {
			
			// make room for the close button
			.titleBar {
				.title {
				inset: 0px 30px auto 0px;
				}
			}

			// the close button
			.closeButton {
				
				// fixed on right
				position: absolute;
				inset: 3px 3px 0px auto;
				width: 22px;
				height: 22px;
				text-align: center;
				cursor: pointer;

				// dark gray circle
				/* background: #575757; */
				border-radius: 50%;

				span {
					font-size: 20px;
					position: relative;
					top: 1px;
				}

				&:hover {
					background: #810f0f;
				}
				// for debug
				/* border: 1px solid red; */
		
			}// .closeButton
		
		}// &.hasClose

	}// .modalWindowFrame

</style>
