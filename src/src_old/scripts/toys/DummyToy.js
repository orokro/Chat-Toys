/*
	DummyToy.js
	--------------

	Each of the "Toys" will be a separate classes that will be imported into the main script.

	When the user adds a toy to their setup, the corresponding Toy's class will be instantiated,
	and stored in the array of toys on the Plugin state.

	However, until we have all systems programmed, this DummyToy will be used as a placeholder.
*/

// main export
export default class DummyToy {

	/**
	 * Builds the DummyToy instance.
	 */
	constructor() {

		this.isDummy = true;
	}
	
}
