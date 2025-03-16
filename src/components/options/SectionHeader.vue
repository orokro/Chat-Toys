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
		height: 33px;
		margin-bottom: 10px !important;
	}

</style>
