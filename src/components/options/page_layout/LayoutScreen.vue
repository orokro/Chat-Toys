<!--
	LayoutBox.vue
	-------------

	This component shows a black rectangle and mounts all of the chat toys widgets so they can be
	laid out on the screen. It's the main component for the "Layout" tab in the options page.

	We'll also provide some inputs to set:
		- the width and height of the stage
		- the background color of the stage
		- if all widgets should be visible
-->
<template>

	<!-- this div will fill it's parent 100% and we will measure it to do maths for our layout screen -->
	<div 
		ref="autoSizeDiv"
		class="autoSizer"
	>
		<!-- row along the top with settings -->
		<div class="settingsRow">
			<div class="setting">
				<label>Stage Width</label>
				<input type="number"v-model="stageWidth" />
			</div>
			<div class="setting">
				<label>Stage Height</label>
				<input type="number" v-model="stageHeight" />
			</div>
			<div class="setting">
				<label for="colColor">Stage Color</label>
				<div class="colorWrapper">
					<input id="colColor" type="color" v-model="stageColor" />
				</div>
			</div>
			<div class="setting">
				<label for="chkShowAll">Show All Widgets</label>
				<input id="chkShowAll" type="checkbox" v-model="showAllWidgets" />
			</div>
		</div>


		<!-- the container that will fit the screen -->
		<div 
			class="layoutScreenContainer"
			:style="{
				height: `${containerHeight}px`,
			}"
		>

			<!-- the actual screen full of widgets and what not -->
			<div 
				class="layoutScreen"
				:style="{
					width: `${stageWidth}px`,
					height: `${stageHeight}px`,
					backgroundColor: stageColor,
					transform: `translate(-50%, -50%) scale(${scale}) `,
				}"
			>
				
				<!-- actual editable widgets will be in here -->
				<LayoutWidgets
					:optionsApp="props.optionsApp"
					:activeTab="props.activeTab"
					:scale="scale"
				/>

			</div>

		</div>

	</div>
</template>
<script setup>

// vue
import { ref, onMounted, onBeforeUnmount, watch, mergeProps } from 'vue'

// components
import LayoutWidgets from './LayoutWidgets.vue';

// refs to html elements
const autoSizeDiv = ref(null);

// data
const stageWidth = ref(1920);
const stageHeight = ref(1080);
const stageColor = ref('#000000');
const showAllWidgets = ref(false);

// the height the container should be to accommodate the stage aspect ratio
const containerHeight = ref(0);

// the scale value applied to the layout screen to fit the container
const scale = ref(1);

// accept some props
const props = defineProps({
	
	// reference to the state of the options page
	optionsApp: {
		type: Object,
		default: null
	},

	// the currently active widget tab
	activeTab: {
		type: String,
		default: 'settings'
	}
});


/**
 * Rectify screen
 */
function rectifyScreen() {

	// get the current width of the autosize div
	const width = measureWidth();

	// if the stage width is less than the width of the autosize div
	// then we can just make containerHeight the same height as the stageHeight
	// and the scale will be 1:1 (i.e. no scaling)
	if (width >= stageWidth.value) {
		containerHeight.value = stageHeight.value;
		scale.value = 1;
		return;
	}

	// otherwise, we need to scale the screen to fit the width of the autosize div
	scale.value = width / stageWidth.value;
	containerHeight.value = stageHeight.value * scale.value;
}


/**
 * Measures the current width of the autosize div
 * 
 * @returns {number}
 */
const measureWidth = () => {
	return autoSizeDiv.value.clientWidth;
}


// make a resize observer that will call the rectify function when the autosize div changes size
const resizeObserver = new ResizeObserver(() => {
	rectifyScreen();
});


// when the component mounts, start observing the autosize div
onMounted(() => {
	resizeObserver.observe(autoSizeDiv.value);

	// rectify the screen initially
	rectifyScreen();
});


// when the component unmounts, stop observing the autosize div
onBeforeUnmount(() => {
	resizeObserver.unobserve(autoSizeDiv.value);
});


// watch the users custom size settings and rectify the screen
watch([stageWidth, stageHeight], () => {
	rectifyScreen();
});

</script>
<style lang="scss" scoped>

	// the main container, this div must resize 100% horizontally,
	// but it's height will be programmatically set to match the aspect ratio of the stage
	// it will contain errthang
	.autoSizer {

		// fill width
		width: 100%;

		// nice border
		border: 2px solid black;
		border-radius: 15px;
		overflow: hidden;
		
		// the container that will fit the screen
		.layoutScreenContainer {

			// fill parent horizontally
			width: 100%;
			background:rgba(0, 0, 0, 0.25);

			// for el debuggerino
			/* border: 1px solid red; */

			// reset stacking context cuz our screen will be absolutely positioned
			position: relative;

			// the actual screen full of widgets and what not
			.layoutScreen {

				// center hacks
				position: absolute;
				top: 50%;
				left: 50%;

				// allow nothing to escape
				overflow: hidden;	

				color: white;
				font-size: 30px;
			}// .layoutScreen

		}// layoutScreenContainer

		// row along the top w/ the settings for our layout
		.settingsRow {

			// nice spacing
			display: flex;
			flex-direction: row;
			justify-content: space-between;
			align-items: center;

			// box settings
			background-color: #777;
			border-bottom: 2px solid #333;
			padding: 10px;
			border-radius: 10px 10px 0px 0px;

			// text settings
			color: #fff;
			font-size: 14px;

			// one of the settings containers
			.setting {

				display: flex;
				flex-direction: row;
				align-items: center;
				margin-right: 10px;

				label {
					margin-right: 5px;
				}	

				// we will wrap the color input in a div to make it look nice
				.colorWrapper {

					// fixed size
					width: 60px;
					height: 30px;
					border: 2px solid black;
					border-radius: 5px;
					
					// allow nothing (i.e. the color picker input) to escape
					overflow: hidden;

					// reset stacking context
					position: relative;

					// the color picker input
					input[type="color"] {
						cursor: pointer;
						position: absolute;
						top: -10px;
						left: -10px;
						width: 80px;
						height: 50px;
					}// input[type="color"]

				}// .colorWrapper

				// the text inputs
				input[type="text"], input[type="number"] {
					
					// fixed size
					width: 100px;
					
						
					// thick box w/ nice inner shadow
					border: 1px solid black;
					outline: 1px solid black;
					border-radius: 5px;
					padding: 5px 10px;
					box-shadow: inset 0 0 5px rgba(0, 0, 0, 0.5);

					// error
					&.error {
						border-color: rgb(255, 8, 8);
						outline: 1px solid rgb(255, 8, 8);
					}
				}// input[type="text"], input[type="number"]

				input[type="checkbox"] {
					width: 25px;
					height: 25px;
					accent-color: black;

				}//input[type="checkbox"]

			}// .setting
		
		}// .settingsRow

	}// .autoSizer

</style>
