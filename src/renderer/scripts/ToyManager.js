/*
	ToyManager.js
	-------------

	This will handle the state for the various toy systems, including
	creation / destruction of the toy state objects.
*/

// vue
import { ref, watch } from 'vue';

// our app
import ChatToysApp from "./ChatToysApp";

/**
 * Class to manage the toys
 */
export class ToyManager {

	/**
	 * Creates a new ToyManager
	 * 
	 * @param {ChatToysApp} chatToysApp - The main app object
	 */
	constructor(chatToysApp) {

		// save our app reference
		this.chatToysApp = chatToysApp;

		// our instantiated toys
		this.toys = {};

		// initial sync
		this.syncEnabledToysState();

		// set up a watcher to re-sync whenever enabledToys changes
		watch(this.chatToysApp.enabledToys, () => {
			this.syncEnabledToysState();
		});
	}


	/**
	 * Sync the toy instances with the currently enabled toy slugs.
	 * Instantiates new ones, preserves existing ones, and removes disabled ones.
	 */
	syncEnabledToysState() {

		// get the list of enabled toys
		const enabledSlugs = this.chatToysApp.enabledToys.value;
		const toysData = this.chatToysApp.toysData;

		// Add new toys
		for (const slug of enabledSlugs) {

			if (!this.toys[slug]) {

				const toyConstructor = toysData.asObject[slug];
				if (toyConstructor)
					this.toys[slug] = new toyConstructor(this, toyConstructor);
				
			}
			
		}// next slug

		// Remove toys that are no longer enabled
		for (const slug in this.toys) {

			if (!enabledSlugs.includes(slug)) {

				// tell toy to end if it has an end method
				if (typeof this.toys[slug].end === 'function')
					this.toys[slug].end();
				
				delete this.toys[slug];
			}

		}// next slug

		console.log('resynced toys list', this.toys);
	}


	/**
	 * Completely restart all toys by destroying and re-syncing them.
	 */
	restartToysState() {

		// End and remove all toys
		for (const slug in this.toys) {

			// tell toy to end if it has an end method
			if (typeof this.toys[slug].end === 'function') {
				this.toys[slug].end();
			}
			delete this.toys[slug];
		}

		// Resync to recreate the enabled ones
		this.syncEnabledToysState();
	}

}
