/*
	RefAggregator.js
	----------------
	
	This a class that helps to aggregate multiple refs into a single ref,
	keeping state synced in both directions.
*/
import { watch, shallowRef, isRef } from 'vue';

// main export
export class RefAggregator {

	// constructor
	constructor(aggregateRef) {

		// check if aggregateRef is a ref
		if (!isRef(aggregateRef)) {
			throw new Error('aggregateRef must be a Vue ref');
		}
		this.aggregateRef = aggregateRef;

		// store registered refs to sync with aggregateRef
		this.registeredRefs = [];

		// Watch the aggregateRef and sync changes to registered refs
		watch(
			this.aggregateRef,
			(newVal) => {
				for (const { key, ref } of this.registeredRefs) {

					// if the new value of the aggregateRef has a key with a different value
					// than the registered ref, update the registered ref
					if (newVal.hasOwnProperty(key) && ref.value !== newVal[key]) 
						ref.value = newVal[key];
					
				}// next { key, ref }
			},
			{ deep: true }
		);
	}


	/**
	 * Registers a ref with the aggregator.
	 * 
	 * @param {String} key - The key to register the ref with on the aggregateRef.
	 * @param {ref|shallowRef} ref - The Vue ref to register with this key
	 */
	register(key, ref) {

		// some error checking
		if (!isRef(ref)) {
			throw new Error('The second argument must be a Vue ref');
		}

		// Sync ref with aggregateRef
		if (this.aggregateRef.value.hasOwnProperty(key)) {
			ref.value = this.aggregateRef.value[key];
		} else {
			this.aggregateRef.value = { ...this.aggregateRef.value, [key]: ref.value };
		}

		// Store the registered ref
		this.registeredRefs.push({ key, ref });

		// Watch the ref and sync back to aggregateRef
		watch(
			ref,
			(newVal) => {
				if (this.aggregateRef.value[key] !== newVal) {
					this.aggregateRef.value = { ...this.aggregateRef.value, [key]: newVal };
				}
			}
		);
	}
}
