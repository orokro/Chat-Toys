<!--
	URLCopyBox.vue
	--------------

	A stylized textbox that auto-selects & provides a copy button.

	Used for making copyable URLs in the options pages
-->
<template>

	<div class="inputRow">

		<!-- a read only input that can be copied from: -->
		<input type="text" :value="url" readonly @focus="$event.target.select()" @click="$event.target.select()"
			@copy="$event.target.select()"
		></input>

		<div class="copyButton">
			<span class="material-icons"
				@click="copyURL">
				content_copy
			</span>
		</div>

	</div>

</template>
<script setup>

// vue
import { ref, inject, computed } from 'vue';

// define props
const props = defineProps({

	// the URL object
	url: {
		type: String,
		required: true
	}
});


/**
 * Copy the URL to the clipboard
 * 
 * @param event {MouseEvent} the click event
 */
const copyURL = (event) => {
    const input = event.target.closest('.inputRow').querySelector('input');

    // Try using modern Clipboard API
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(input.value)
            .catch(err => {
                console.error('Clipboard copy failed', err);
                fallbackCopy(input);
            });
    } else {
        // Fallback for older browsers
        fallbackCopy(input);
    }
};


/**
 * Fallback copy function for older browsers
 * 
 * @param input {HTMLInputElement} the input element to copy from
 */
const fallbackCopy = (input) => {
    input.focus();
    input.select();
    try {
        const success = document.execCommand('copy');
        if (!success) {
            console.warn('Fallback copy command was not successful.');
        }
    } catch (err) {
        console.error('Fallback copy failed', err);
    }
};

</script>
<style scoped lang="scss">

	// row with the text box & the copy button
	.inputRow {

		// reset stacking context
		position: relative;

		// fixed height & look like a box
		height: 40px;
		background: white;
		padding: 5px 15px;
		border-radius: 5px;
		border: 2px solid black;

		// inner shadow
		box-shadow: inset 0px 0px 5px rgba(0, 0, 0, 0.5);

		// actual text input
		input {

			// fill container
			position: absolute;
			inset: 0px;
			font-size: medium;
			font-family: monospace;
			padding: 0px 10px;
		}

		// the copy button
		.copyButton {

			// position it to the right
			position: absolute;
			inset: 0px 0px 0px auto;
			top: 0px;
			width: 40px;
			cursor: pointer;
			border-left: 2px solid black;

			&:hover {
				background: black;
				span {
					color: white;
				}
			}

			// icon
			span {
				font-size: 1.5em;
				position: relative;
				top: 5px;
				left: 7px;
				color: black;
			}

		}// .copyButton

	}// .inputRow

</style>
