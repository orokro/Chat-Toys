<!--
	ArrayEdit.vue
	-------------

	This component will take in an array as it's model, and allow the user to
	add, remove, and edit the items in the array.

	It will also take a prop for the type of item in the array, and use that to
	provide the correct input field for editing.
-->
<template>

	<!-- outermost wrapper -->
	<div class="array-edit">

		<!-- the box that contains the item rows -->
		<div class="items">

			<!-- if we don't have any items, show this row as a message -->
			<div 
				v-if="model.length <= 0"
				class="row nowItems"
			>
				<p>No items</p>
			</div>

			<!-- loop to spawn a row for each item in the editable array -->
			<div 
				v-for="(item, index) in model"
				:key="index"
				class="row itemRow"
			>
				<!-- spawn the component from props for each item -->
				<component
					:is="props.component"
					:value="item"
					:index="index"
					:key="index"
					:schema="props.schema"
					:rowProps="props.rowProps"
					@change="(newValue) => updateItem(index, newValue)"
				/>

				<!-- delete item button -->
				<button 
					class="deleteButton"
					@click="removeItem(index)"
				>
					<span class="material-icons">delete</span>
				</button>
			</div>

		</div>

		<!-- one last row, for our add button -->
		<div class="row buttonRow">
			<button @click="addItem" class="bg-blue-500 text-white px-4 py-2 rounded">Add Item</button>
		</div>
	</div>
</template>
<script setup>

// vue
import { ref } from 'vue';

// props
const props = defineProps({

	// The component to render each item
	component: Object, 

	// Function to create a new item
	createItem: {
		type: Function, 
		default: () => ({})
	},

	// the optional yup schema for the item
	schema: {
		type: Object,
		default: null
	},

	// optional props for row
	rowProps: {
		type: Object,
		default: () => ({})
	}

});

// the array we'll be editing
const model = defineModel({ type: Array, default: () => [] });

// updates a single item in the array
const updateItem = (index, newValue) => {
	model.value = [...model.value.slice(0, index), newValue, ...model.value.slice(index + 1)];
};

// adds a new item to the array
const addItem = () => {
	model.value = [...model.value, props.createItem()];
};

// removes an item from the array
const removeItem = (index) => {
	model.value = model.value.filter((_, i) => i !== index);
};
</script>

<style lang="scss" scoped>

	// the main outer wrapper
	.array-edit {

		// reset stacking context
		position: relative;
		min-width: 550px;
		max-width: 1000px;
		// box settings
		// thicc round border, and since this element is a predictable table, let's hard-code it's width
		border: 2px solid black;
		border-radius: 10px;
		overflow: hidden;

		// this element will be in dark theme just to contrast it against everything else, since it's an important element
		background: rgb(172, 172, 172);

		// make room for fixed header on top:
		padding: 0px 0px 40px 0px;

		// one of the rows to stack
		.row {

			// reset stacking context
			position: relative;

			// borders on bottom except for the last row
			border-bottom: 2px solid black;
			&:last-child {
				border-bottom: none;
			}

			// attach the delete button to the right
			.deleteButton {
				
				position: absolute;
				top: 50%;
				right: 5px;
				transform: translateY(-50%);

				// clear the default button styles
				background: none;
				border: none;
				cursor: pointer;

				// red on hover
				color: black;
				&:hover {
					color: red;
				}
			}// .deleteButton

			// row to show when there are no items
			&.nowItems {
				padding: 10px;
				text-align: center;
				font-style: italic;
			}

			// bottom row w/ the add button
			&.buttonRow {

				// fix on bottom
				display: block;
				position: absolute;
				inset: auto 0px 0px 0px;
				padding: 5px;

				// black bar w/ white text
				height: 40px;
				background: black;
				color: white;

				// make the add button look nice
				button {

					// box styles
					background: #EFEFEF;
					border: none;
					border-radius: 40px;
					padding: 5px 10px;
					cursor: pointer;
					border: 2px solid black;

					// text settings
					color: black;
					font-weight: bolder;
					
					&:hover {
						background: white;
						border: 2px solid rgba(255, 255, 255, 1);
					
					}
				}// button

			}// &.buttonRow

		}// .row

	}// .array-edit

</style>
