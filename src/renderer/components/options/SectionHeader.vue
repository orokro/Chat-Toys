<!--
	SectionHeader.vue
	-----------------

	To be used as a child component of a PageBox, this will be a header for a section of a page.

	It will inherit the theme color from the parent PageBox.
-->
<template>
	<div
		class="sectionHeader"
		:style="{ marginTop: autoTopMargin + 'px' }"
		align="center"
	>
		<h3 class="title">
			<div class="titleText">
				<span>{{ title }}</span>
			</div>
			<div class="titleTextV">
				<span>{{ title }}</span>
			</div>
		</h3>
	</div>
</template>
<script setup>

// vue
import { ref } from 'vue';

// props
const props = defineProps({
	
	// the title of the section
	title: {
		type: String,
		default: 'Section Title'
	},

	// auto top margin
	autoTopMargin: {
		type: Number,
		default: 20
	}
});

</script>
<style lang="scss" scoped>

	
	.sectionHeader {

		clear: both;

		height: 50px;
		margin-bottom: 30px !important;
		margin-top: 60px !important;

		h3 {
			width: 1000px;
			/* padding: 5px 0; */
			font-size: 24px;
			text-align: left;
			overflow: hidden;

			position: relative;

			.titleText {
				display: inline-block;
				padding: 6px 0px;

				/* background: linear-gradient(90deg,rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, 0.25) 10%, rgba(0, 0, 0, 0.25) 90%, rgba(0, 0, 0, 0) 100%); */
				mask-image:
					linear-gradient(90deg,rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, .7) 10%, rgba(0, 0, 0, .7) 90%, rgba(0, 0, 0, 0) 100%);
				
				mix-blend-mode: multiply;

				span {
					opacity: 1;
				}
		
			}

			.titleTextV {
				position: absolute;
				top: 6px;
				/* left: 40px; */
			}

		}

	}// .sectionHeader

</style>
