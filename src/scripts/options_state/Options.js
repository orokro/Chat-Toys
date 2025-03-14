/*
	Options.js
	----------

	This file will provide a class that manages the state for the Options page.
*/

// vue
import { ref, shallowRef } from 'vue';
import { chromeRef, chromeShallowRef } from '../chromeRef';

// main export
export default class Options {

	/**
	 * Builds the Options instance.
	 */
	constructor() {

		// we will use a chromeRef to persist the list of enabled toys
		this.enabledToys = chromeShallowRef('enabledToys', []);

		// but a regular ref for the active toy (if any), since
		// this doesn't need to persist across tabs or even refreshes
		this.selectedToy = ref(null);

		this.somevalue = ref("hi");
	}
	

	/**
	 * Selects a toy to be the selected toy.
	 * 
	 * @param {string} toy - OPTIONAL; toy slug to set as selected, or leave undefined to clear the selected toy
	 */
	selectToy(toy) {

		// if toy is undefined, set selected toy to null
		if (toy === undefined) {
			this.selectedToy.value = null;
			return;
		}

		// set the selected toy
		this.selectedToy.value = toy;
	}


	/**
	 * Adds a toy to the user's enabled toys.
	 * 
	 * @param {string} slug - toy slug to add to our list of enabled toys
	 */
	addToy(slug) {

		// if the toy is already enabled, don't add it again
		if (this.enabledToys.value.includes(slug) === true)
			return;
		
		// add the toy to the list of enabled toys
		this.enabledToys.value = [...this.enabledToys.value, slug];
	}


	/**
	 * Removes a toy from users list of toys
	 * 
	 * @param {string} slug - toy slug to remove from our list of enabled toys
	 */
	removeToy(slug) {

		// find where the toy was in the list index wise
		const index = this.enabledToys.value.indexOf(slug);

		// remove the toy from the list of enabled toys
		this.enabledToys.value = this.enabledToys.value.filter(s => s !== slug);

		// if the toy was the active toy, we should select the next closest index
		// that is still valid in the array
		if (this.selectedToy.value === slug) {

			// if there are no toys left, set active toy to null
			if (this.enabledToys.value.length === 0) {
				this.selectedToy.value = null;
				return;
			}

			// if the toy was the last in the list, select the previous toy
			if (index === this.enabledToys.value.length)
				this.selectedToy.value = this.enabledToys.value[index - 1];
			else
				this.selectedToy.value = this.enabledToys.value[index];
		}		
	}

}
