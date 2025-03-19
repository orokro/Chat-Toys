<!--
	VItem.vue
	---------

	This is one of the "tabs" / "vertical icons" that appear in the vertical item strip
	Originally this was designed just to be a 'toy' but has been made generic to be used
	on any page that needs a vertical strip of icons.

	This by default shows just a chilling icon, but when that item is selected,
	it will be styled as a tab connecting to the main area to the right.
-->
<template>

	<!-- the outermost container -->
	<div
		class="vItem"
		:class="{ selected: selected }"
		:title="item.name"
		@click="$emit('click')"
	>
		
		<!-- the inner box that will be styled as a tab when active -->
		<div class="innerBox">

			<!-- the icon for the vertical strip item -->
			<div class="icon">
				<img
					class="iconImage"
					:src="itemIconPath"
					:alt="item.name"
					height="60"
				/>
			</div>

			<!-- the delete button -->
			<div
				v-if="showDelete"
				class="deleteButton"
				:title="`Remove ${item.name}`"
				@click="$emit('remove', slug)"
			>
				<span class="material-icons">delete</span>
			</div>

		</div>

	</div>

</template>
<script setup>

// vue
import { computed } from 'vue';

// props
const props = defineProps({

	// the vertical item object data
	item: {
		type: Object,
		default: ''
	},

	// is this item currently selected?
	selected: {
		type: Boolean,
		default: false
	},

	// the path to the icon
	iconPath: {
		type: String,
		default: ''
	},

	// should we show the delete button?
	showDelete: {
		type: Boolean,
		default: false
	},

});

// emits
const emits = defineEmits(['click', 'remove']);

// the path to the icon
const itemIconPath = computed(() => {
	return `${props.iconPath}/${props.item.slug}.png`;
});

</script>
<style lang="scss" scoped>

	// the outermost container
	.vItem {

		// reset stacking context
		position: relative;

		// the strip is 100, so make the items 100% width, square
		width: 100px;
		height: 80px;

		// center the icon
		display: flex;
		justify-content: center;
		align-items: center;

		// look clickable
		cursor: pointer;

		// the inner box
		.innerBox {

			// tab styles
			position: absolute;
			inset: 5px -100px 5px 10px;
			border-radius: 10px 0px 0px 10px;

			.icon {
				// animate left
				transition: left 0.5s;
				position: relative;
				top: 2px;
				left: 6px;

				.iconImage {

					&:hover {
						filter: drop-shadow(2px 4px 4px rgba(0, 0, 0, 0.5));
					}
				}
			}// .icon 

			&:hover {
				.deleteButton {
					scale: 1;
				}
			}

			// the delete button
			.deleteButton {
				
				// fixed on top-left corner
				position: absolute;
				left: -5px;
				top: -5px;

				// hidden by default
				transition: 0.2s;
				scale: 0;

				// make it look clickable
				cursor: pointer;

				// nice red circle
				border: 2px solid black;
				border-radius: 100px;
				width: 25px;
				height: 25px;
				background-color: rgb(185, 1, 1);

				span {
					position: relative;
					top: 1px;
					left: 1px;
					font-size: 18px;
					color: white;
				}	

				&:hover {
					background: red;
				}
					
			}// .deleteButton

		}// .innerBox

		// when selected, style as a tab
		&.selected {

			.innerBox {

				background: white;
				// shadow to match the add [+] button
				box-shadow: 5px 5px 5px 0px rgba(0, 0, 0, 0.25);

				.icon {
					left: 15px;
				}

			}// .innerBox

		}// &.selected


	}// .vItem

</style>
