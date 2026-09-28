/*
	bindRefs.js
	-----------

	Binds two Vue refs together with 2-way sync, avoiding infinite loops.
	(Vendored unchanged from the old socket-ref package.)
*/

// vue
import { watch } from 'vue';

/**
 * Bind two Vue refs together with 2-way sync, avoiding infinite loops.
 *
 * @param {ref|shallowRef} refA - Vue ref (or shallowRef) to bind
 * @param {ref|shallowRef} refB - Vue ref (or shallowRef) to bind
 * @returns {function} - Function to stop the binding
 */
export function bindRefs(refA, refB) {

	// guard flags
	let updatingA = false;
	let updatingB = false;

	// watch refA & update refB
	const stopA = watch(refA, (newVal) => {
		if (updatingA) {
			updatingA = false;
			return;
		}
		updatingB = true;
		refB.value = newVal;
	});

	// watch refB & update refA
	const stopB = watch(refB, (newVal) => {
		if (updatingB) {
			updatingB = false;
			return;
		}
		updatingA = true;
		refA.value = newVal;
	});

	return () => {
		stopA();
		stopB();
	};
}


/**
 * Helper to bindRefs but first assign the value of refB to refA.
 *
 * @param {ref|shallowRef} ref - the ref to bind to another, existing ref
 * @returns {Object} - an object with a .to() method that takes a ref to bind to
 */
export function bindRef(ref) {
	return {
		to: function (refB) {
			ref.value = refB.value;
			return bindRefs(ref, refB);
		}
	};
}
