<!--
	ToysStrip.vue
	-------------

	This component is a vertical strip of toys that have been added to the toy box.
-->
<template>

	<!-- the vertical strip of toys added -->
	<div class="toyStrip">

		<!-- loop through the toys and display them -->
		<ToyStripItem
			v-for="toy in toys"
			:key="toy.slug"
			:toy="toy"
			:selected="toy.sug === selectedToy.slug"
			@click="()=>emits('selectToy', toy)"
		/>

		<!-- always have the add button... -->
		<div class="toyStripItem add">
			<div class="addButton">
				<span class="material-icons">add</span>
			</div>
		</div>


	</div>
</template>
<script setup>

// vue
import { ref } from 'vue';

// components
import ToyStripItem from './ToyStripItem.vue';

// define some props
const props = defineProps({

	// the currently selected toy, if any
	selectedToy: {
		type: Object,
		default: null
	},

	// the list of toys to display
	toys: {
		type: Array,
		default: []
	},

});

// emit events
const emits = defineEmits(['selectToy', 'addToy']);

</script>
<style lang="scss" scoped>

	// fill toy strip on left side
	.toyStrip {

		width: 100px;
		background: rgb(128, 128, 128);

		// make inner shadow coming from right side
		// thats inside inside the shape
		box-shadow: inset -15px 0px 15px -5px rgba(0, 0, 0, 0.25);

		// the box that contains our add button
		//(the other toyStripItems will be in the ToyStripItem component)
		.toyStripItem {

			// the strip is 100, so make the items 100% width, square
			width: 100px;
			height: 100px;

			// for debug
			/* border: 1px solid red; */

			// center the icon
			display: flex;
			justify-content: center;
			align-items: center;
			
			// the actual add button
			.addButton {

				// nice rounded gray box
				width: 60px;
				height: 60px;
				border-radius: 25%;
				background: #EFEFEF;

				// add some nice shadow
				box-shadow: 5px 5px 5px 0px rgba(0, 0, 0, 0.25);

				// make the button look clickable
				cursor: pointer;

				// light up on hover;				
				opacity: 0.8;
				&:hover {
					background: #FFFFFF;
					opacity: 1;
				}

				// animate states
				transition: background 0.2s, opacity 0.2s;
				
				// center the icon (the span with the +)
				display: flex;
				justify-content: center;
				align-items: center;				

				// make the icon bigger
				span {
					font-size: 40px;
				}

			}// .addButton

		}// .toyStripItem

	}// .toyStrip

</style>
