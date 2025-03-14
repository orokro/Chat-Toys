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
		:title="toysData.asObject[slug].name"
		@click="$emit('click')"
	>
		
		<!-- the inner box that will be styled as a tab when active -->
		<div class="innerBox">

			<!-- the icon for the toy -->
			<div class="icon">
				<img
					class="iconImage"
					:src="toyIconPath"
					:alt="toysData.asObject[slug]"
					width="60"
					height="60"
				/>
			</div>

			<!-- the delete button -->
			<div
				class="deleteButton"
				:title="`Remove ${toysData.asObject[slug].name}`"
				@click="$emit('remove', slug)"
			>
				<span class="material-icons">delete</span>
			</div>

		</div>

	</div>

</template>
<script setup>

// vue
import { ref, computed } from 'vue';

// our app
import { toysData } from '../../../scripts/ToysData';

// props
const props = defineProps({

	// the toy object
	slug: {
		type: String,
		default: ''
	},

	// is this toy currently selected?
	selected: {
		type: Boolean,
		default: false
	}

});

// emits
const emits = defineEmits(['click', 'remove']);

// the path to the icon
const toyIconPath = computed(() => {
	return `../assets/icons/${props.slug}.png`;
});

</script>
<style lang="scss" scoped>

	// the outermost container
	.toyStripItem {

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
				left: 10px;

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
			}

		}// &.selected


	}// .toyStripItem
</style>
