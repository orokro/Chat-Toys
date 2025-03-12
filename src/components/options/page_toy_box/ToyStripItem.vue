<!--
	ToyStripItem.vue
	----------------

	This is one of the "tabs" / "toy icons" that appear in the vertical ToyStrip
	when the user has added various toys to the toy box / their set up.

	This by default shows just a chilling icon, but when that toy is selected,
	it will be styled as a tab connecting to the main area to the right.
-->
<template>

	<!-- the outermost container -->
	<div
		class="toyStripItem"
		:class="{ selected: selected }"
		:title="toy.name"
	>
		
		<!-- the inner box that will be styled as a tab when active -->
		<div class="innerBox">

			<!-- the icon for the toy -->
			<div class="icon">
				<img
					:src="toyIconPath"
					alt="toy.name"
					width="80"
					height="80"
				/>
			</div>

		</div>

	</div>

</template>
<script setup>

// vue
import { ref, computed } from 'vue';

const toyIconPath = computed(() => {
	return `../assets/icons/${props.toy.slug}`;
});

// props
const props = defineProps({

	// the toy object
	toy: {
		type: Object,
		default: null
	},

	// is this toy currently selected?
	selected: {
		type: Boolean,
		default: false
	}

});

</script>
<style lang="scss" scoped>

	// the outermost container
	.toyStripItem {

		// look clickable
		cursor: pointer;

		// the inner box
		.innerBox {



		}// .innerBox

	}// .toyStripItem
</style>
