<!--
	TopTab.vue
	----------

	This component will be one of the main tabs along the top of the options page.

	For example:
	- Help
	- Settings
	- ToyBox
-->
<template>

	<!-- the outermost wrapper -->
	<div 
		class="topTab"
		:class="{ 
			active: active,
			hasIcon: icon !== '',
		 }"
		@click="$emit('click', index)"
	>
			
		<!-- icon fixed on left, if not empty -->
		<div v-if="icon" class="icon" >
			<span class="material-icons">{{ icon }}</span>
		</div>

		<!-- title of the tab -->
		<div class="title">
			{{ title }}
		</div>

	</div>
</template>
<script setup>

// vue
import { ref } from 'vue';

// props
const props = defineProps({
	
	// the icon for tab - for now, material icon slug
	icon: {
		type: String,
		default: ''
	},

	// the title for the tab
	title: {
		type: String,
		default: 'Tab'
	},

	// the index of the tab when it was spawned by the tab bar
	index: {
		type: Number,
		default: 0
	},

	// an optional slug for the tab, incase code needs to reference it
	slug: {
		type: String,
		default: ''
	},

	// true if we're the active tab
	active: {
		type: Boolean,
		default: false
	},
});

// define our events
const events = defineEmits([
	'click',
]);


</script>
<style lang="scss" scoped>

	// the main tab wrapper
	.topTab {

		// disable flex shrink/grow, spacing on the left
		flex: 0 0 auto;
		margin-left: 5px;

		// new CSS stack context
		position: relative;

		// make room for the icon if we have one
		&.hasIcon {
			padding-left: 40px;
		}

		// appear clickable
		cursor: pointer;

		// the actual box / corner styles of the tab
		height: 35px;
		margin-top: 4px;
		background: #d3d3d3;
		border: 1px solid #CCC;
		border-bottom: none;
		border-radius: 5px 5px 0 0;
		
		// if we're active, make the bottom border the same color as the background
		&.active {
			background: white;
			height: 38px;
			.title {
				font-weight: bold;
			}
		}

		// hover styles
		&:hover {
			background: white;
		}

		// icon 
		.icon {

			// fixed on left
			position: absolute;
			left: 10px;
			top: 5px;
			font-size: 20px;

		}// icon

		// title
		.title {

			// same height as tab
			height: 35px;

			// spacing
			padding: 5px 15px 0 5px;

			// text styles
			font-size: 16px;
			

		}// .title

	}// .topTab

</style>
