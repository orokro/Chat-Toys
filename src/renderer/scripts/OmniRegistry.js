/*
	OmniRegistry.js
	---------------

	In-process registry coordinating the Omni toy's "gating" of alert toys.

	When an Omni group is configured to include a toy, the omni registers
	that toy with itself as the owner. When an alert toy (or its
	StateTickerQueue) is about to fire, it asks the registry "am I being
	gated by an omni right now?". If the registered omni is currently
	showing something else from its include list, the toy holds its fire.

	No socket-refs here - this is all renderer-side. The omni and the toys
	live in the same renderer process and just talk via these methods.

	Multi-omni note: each toy can be registered to at most one omni at a
	time. The Omni page UI is responsible for preventing overlap (a toy is
	physically in one group's drop box or another, not both). If two omnis
	somehow both register the same toy, last-registered wins - the previous
	omni's gating becomes a no-op for that toy.
*/

export class OmniRegistry {

	constructor() {
		/**
		 * Maps `toySlug` → the Omni instance that includes it. The Omni
		 * exposes an `isBusyExcept(toySlug)` method we call to decide
		 * whether the asking toy should hold its fire.
		 *
		 * @type {Map<string, Object>}
		 */
		this.toyToOmni = new Map();
	}


	/**
	 * Register that an Omni instance "owns" a toy slug. If another omni
	 * had previously registered this slug, the new registration replaces
	 * it (last-write-wins).
	 *
	 * @param {string} toySlug
	 * @param {Object} omni - any object exposing isBusyExcept(toySlug)
	 */
	register(toySlug, omni) {
		this.toyToOmni.set(toySlug, omni);
	}


	/**
	 * Drop a toy's registration. Idempotent.
	 *
	 * @param {string} toySlug
	 * @param {Object} [omni] - if provided, only unregister if this exact
	 *   omni is the current owner (prevents a teardown from clobbering a
	 *   newer registration)
	 */
	unregister(toySlug, omni = null) {
		const current = this.toyToOmni.get(toySlug);
		if (omni && current !== omni) return;
		this.toyToOmni.delete(toySlug);
	}


	/**
	 * Should this toy hold its fire? True when there's an omni registered
	 * for this slug AND that omni currently has another included toy showing.
	 *
	 * Falls back to false when there's no omni registered (i.e. standalone
	 * mode - toy fires immediately as today).
	 *
	 * @param {string} toySlug
	 * @returns {boolean}
	 */
	isBlocking(toySlug) {
		const omni = this.toyToOmni.get(toySlug);
		if (!omni) return false;
		if (typeof omni.isBusyExcept !== 'function') return false;
		return omni.isBusyExcept(toySlug);
	}


	/**
	 * Look up the owning omni for a toy slug (or null).
	 *
	 * @param {string} toySlug
	 * @returns {?Object}
	 */
	getOmniFor(toySlug) {
		return this.toyToOmni.get(toySlug) || null;
	}


	/**
	 * Snapshot of which toys are currently claimed. Used by the Omni
	 * settings page to drive the drag-and-drop pool / gray-out enforcement.
	 *
	 * @returns {Object<string, Object>}
	 */
	getAllOwners() {
		const out = {};
		for (const [slug, omni] of this.toyToOmni.entries()) {
			out[slug] = omni;
		}
		return out;
	}
}
