/*
	Plugin.js
	---------

	This is the root class for the state of the plugin application.
	Instead of "App" or "Application", we're using "Plugin" to avoid confusion with Vue's App.

	---

	Things to consider:

	When the plugin is loaded it could be for any of the reasons:
	- Initially installed
	- Chrome restarted
	- Extension updated
	- Extension reloaded

	And when some of these happen, the user may be in the middle of a session.

	So we need to recover quickly and accurately to the state the user was in.

	--- 

	Another note to consider:

	This class will be instantiated in the background script, and will be the main point of contact
	for the content script, options page, and popup.	
*/

// vue things
import { ref, shallowRef, reactive, shallowReactive } from 'vue';

// main export
export default class Plugin {

	/**
	 * Builds the Plugin instance.
	 */
	constructor() {

		// the list of toys that are currently active
		this.toys = shallowRef([]);


	}


	/**
	 * Adds a toy for the user to play with in the setup.
	 * 
	 * @param {Object} toyDesc - one of the items as defined in ToysData.js
	 */
	addToy(toyDesc){

		// instantiate the toy
		const toy = new toyDesc.constructor();

		// add it to the list
		this.toys.value = [...this.toys.value, toy];
	}

}
