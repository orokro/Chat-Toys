/*
	DummyToy.js
	-----------

	Each of the Toys in our app will manager their state with their own class that extends ToyState.

	The file ToyData.js will provide all the constructors based on the various toy kinds.

	However, we need a placeholder for when a toy is not yet implemented. This is that placeholder.
*/

// our app
import ToyState from "../ToyState";

// main export
export default class DummyToy extends ToyState {

	/**
	 * Constructs the DummyToy object
	 * 
	 * @param {ToyManager} toyManager - reference to the toy manager
	 * @param {Object} toyInfo - the toy's info from the toysData
	 */
	constructor(toyManager, toyInfo) {

		// call the parent constructor
		super(toyManager, toyInfo);

		// mark this as a dummy toy
		this.isDummy = true;
	}
	
}
