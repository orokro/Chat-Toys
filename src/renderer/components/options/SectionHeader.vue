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
			{{ title }}
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

		height: 50px;
		margin-bottom: 30px !important;
		margin-top: 60px !important;

		h3 {
			width: 1000px;
			padding: 5px 0;
			font-size: 24px;
			text-align: left;
		}

	}// .sectionHeader

</style>
