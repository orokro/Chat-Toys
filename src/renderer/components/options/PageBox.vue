<!--
	PageBox.vue
	-----------

	This will be a generic page container so our pages can have some
	common styles and theming.

	Primarily, it will be a nice header / gradient and build in place for a title.
-->
<template>

	<!-- main outermost wrapper for a 'page' -->
	<div
		class="pageBox"
		:style="{ 
			background: gradientCSS,
			'--tColor': newColor
		}"
	>

		<div class="pageHeader" align="center">
			<h2 class="title">
				{{ title }}
			</h2>
		</div>

		<div class="pageContent">
			<div :class="{ limitWidth }">
				<slot/>
			</div>
		</div>

	</div>

</template>
<script setup>

// vue
import { computed, ref } from 'vue';

// lib misc
import chroma from "chroma-js";

// props
const props = defineProps({
	
	// the title of the page
	title: {
		type: String,
		default: 'Page Title'
	},

	// theme color for the page
	themeColor: {
		type: String,
		default: 'rgb(199, 199, 199)'
	},

	// limit the width of the content
	limitWidth: {
		type: Boolean,
		default: true
	}

});

// compute the gradient CSS once
const gradientCSS = computed(() => generateGradient(props.themeColor));
const newColor = chroma.mix(chroma(props.themeColor), "#ffffff", 60 / 255).hex(); // More color retained

// generate a gradient from a base color
function generateGradient(colorHex) {

    // Convert to chroma color object
    const baseColor = chroma(colorHex);

	

    // Adjust the mix ratios for better color retention
    const lightened1 = chroma.mix(baseColor, "#ffffff", 100 / 255).hex(); // More color retained
    const lightened2 = chroma.mix(baseColor, "#ffffff", 220 / 255).hex(); // Almost white
	const lightened3 = chroma.mix(baseColor, "#ffffff", 240 / 255).hex(); // Almost white
	const white = 'white';

	return `linear-gradient(to bottom, 
        ${newColor} 0px, 
        ${newColor} 69px,
		${lightened1} 55px, 
        ${lightened2} 85px, 
        ${lightened2} 100%)`;
}


</script>
<style lang="scss" scoped>

	// the main wrapper for the page - fill the screen
	.pageBox {

		// fill the screen
		height: 100%;
		width: 100%;

		// At least full height of parent, but can expand
		min-height: 100%; 
		height: min-content;

		// rounded corners just on top
		border-radius: 10px 10px 10px 10px;

		// header
		.pageHeader {

			// fixed height 
			height: 70px;
			padding: 4px 20px 0px;
			border-bottom: 2px solid white;
			
			// text settings
			font-size: 24px;
			color: white;

			text-shadow: 2px 2px 0px rgba(0, 0, 0, 0.5);

		}// .pageHeader

		// content
		.pageContent {
			padding: 20px;

			overflow-x: hidden;
			.limitWidth {

				/* border: 1px solid blue; */
				width: 1000px;

				position: relative;
				left: 50%;
				transform: translateX(-50%);
			}
		}

		// deep select .sectionHeader and make its background the props theme color
		:deep(.sectionHeader) {
			margin: 0px -200px;
			padding: 0px 20px 0px 20px;
			background-color: var(--tColor);

			color: white;
			text-shadow: 2px 1px 0px rgba(0, 0, 0, 0.5);
		}

		:deep(.infoBox) {
			background-color: var(--tColor);
		}

		:deep(.settings-row) {

			padding: 20px;
			&:nth-child(odd) {
				background: rgba(0, 0, 0, 0.05);
			}
			&:nth-child(even) {
				background: rgba(0, 0, 0, 0.1);
			}
		}
		
	}// .pageBox

</style>
