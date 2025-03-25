<!--
	VerticalItemStrip.vue
	---------------------

	This component will show a vertical list of icon tabs.
	Originally this component was designed just for the Toy Box page,
	but has not been made generic to show tabs on the left side of any page.
-->
<template>

	<!-- the vertical strip of items added -->
	<div class="vStrip">

		<!-- this area scrolls, but we deliberately hide the scroll bar outside via CSS -->
		<div class="scrollArea">

			<!-- loop through the items and display them -->
			<VItem
				v-for="item in vItems"
				:key="item"
				:item="item"
				:selected="item.slug === selectedItemSlug"
				:showDelete="showDelete"
				:iconPath="iconPath"
				@click="()=>emits('selectItem', item)"
				@remove="()=>emits('removeItem', item)"
			/>

			<!-- always have the add button... -->
			<div
				v-if="showAdd"
				class="vStripItemAdd add"
				@click="()=>emits('addItem')"
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
import VItem from './VItem.vue';

// define some props
const props = defineProps({

	// the currently selected item, if any
	selectedItemSlug: {
		type: String,
		default: ''
	},

	// the list of items to display
	vItems: {
		type: Array,
		default: []
	},

	// path to resolve icons for this strip
	iconPath: {
		type: String,
		default: ''
	},

	// true if we should show the add button
	showAdd: {
		type: Boolean,
		default: false
	},

	// true if icons should show delete button
	showDelete: {
		type: Boolean,
		default: false
	},

});

// emit events
const emits = defineEmits(['selectItem', 'addItem', 'removeItem']);


</script>
<style lang="scss" scoped>

	// fill item strip on left side
	.vStrip {

		// fixed size, allow nothing to escape
		width: 100px;
		overflow: hidden;

		// dark gray bg with inner shadow
		// make inner shadow coming from right side
		// thats inside inside the shape
		background: linear-gradient(90deg, #808080 0%, #808080 80%, #555 100%);
		

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
		//(the other v items will be in the VItem component)
		.vStripItemAdd {

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

		}// .vStripItemAdd

	}// .vStrip

</style>
