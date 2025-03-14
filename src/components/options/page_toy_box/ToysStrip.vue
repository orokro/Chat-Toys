<!--
	ToysStrip.vue
	-------------

	This component is a vertical strip of toys that have been added to the toy box.
-->
<template>

	<!-- the vertical strip of toys added -->
	<div class="toyStrip">

		<!-- this area scrolls, but we deliberately hide the scroll bar outside via CSS -->
		<div class="scrollArea">

			<!-- loop through the toys and display them -->
			<ToyStripItem
				v-for="toy in toys"
				:key="toy"
				:slug="toy"
				:selected="toy === selectedToy"
				@click="()=>emits('selectToy', toy)"
				@remove="()=>emits('removeToy', toy)"
			/>

			<!-- always have the add button... -->
			<div
				v-if="!allToysAdded"
				class="toyStripItemAdd add"
				@click="()=>emits('addToy')"
			>
				<div class="addButton ">
					<span class="material-icons">add</span>
				</div>
			</div>
		</div>

	</div>
</template>
<script setup>

// vue
import { ref, computed } from 'vue';

// components
import ToyStripItem from './ToyStripItem.vue';

// our app
import { toysData } from '../../../scripts/ToysData';

// define some props
const props = defineProps({

	// the currently selected toy, if any
	selectedToy: {
		type: String,
		default: ''
	},

	// the list of toys to display
	toys: {
		type: Array,
		default: []
	},

});

// emit events
const emits = defineEmits(['selectToy', 'addToy', 'removeToy']);

// true when the user has added all the toys
const allToysAdded = computed(() => {
	return props.toys.length >= toysData.length;
});

</script>
<style lang="scss" scoped>

	// fill toy strip on left side
	.toyStrip {

		// fixed size, allow nothing to escape
		width: 100px;
		overflow: hidden;

		// dark gray bg with inner shadow
		// make inner shadow coming from right side
		// thats inside inside the shape
		background: rgb(128, 128, 128);
		box-shadow: inset -15px 0px 15px -5px rgba(0, 0, 0, 0.25);

		// the scrollable area that has hidden scroll bars
		.scrollArea {

			// fill the area
			position: absolute;
			inset: 0px -200px 0px 0px;
			padding-top: 10px;

			// scroll the box
			overflow-y: auto;

		}// .scrollArea

		// the box that contains our add button
		//(the other toyStripItems will be in the ToyStripItem component)
		.toyStripItemAdd {

			// the strip is 100, so make the items 100% width, square
			width: 100px;
			height: 80px;

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
