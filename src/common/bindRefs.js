// bindRefs.js
// Binds two Vue refs together with 2-way sync, avoiding infinite loops

import { watch } from 'vue';

export function bindRefs(refA, refB) {
	let updatingA = false;
	let updatingB = false;

	const stopA = watch(refA, (newVal) => {
		if (updatingA) {
			updatingA = false;
			return;
		}
		updatingB = true;
		refB.value = newVal;
	});

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
