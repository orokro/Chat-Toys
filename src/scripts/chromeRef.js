/*
	chromeRef.js
	------------

	- This file contains the logic to create reactive refs synced with Chrome storage or localStorage.
	- It uses the FinalizationRegistry to cleanup listeners when the ref is garbage collected.
	- It also uses a single registry for both chromeRef and chromeShallowRef.
	- It detects the environment once and uses the appropriate storage API.
	- It also listens for storage changes and updates the ref accordingly.

	So basically, in Vue we can use either chromeRef or chromeShallowRef the same way
	we would use ref or shallowRef, but the value is synced with Chrome storage or localStorage.

	So, if the user changes the value in another tab, the ref will update automatically.
*/

// vue imports
import { ref, shallowRef, watch } from 'vue';

// toggle debug prints
const DEBUG = false;

// Detect environment once
const isChromeExtension = typeof chrome !== "undefined" && chrome.storage && chrome.storage.local;
console.log(`Running in ${isChromeExtension ? "Chrome extension mode" : "localStorage mode"}`);

// map of listener functions that either listen to chrome.storage or localStorage changes
const listeners = new Map();

// Single registry for both chromeRef and chromeShallowRef
// This will be used to cleanup listeners when the ref is garbage collected
const registry = new FinalizationRegistry(({ storageKey, stopWatch }) => {
    
	if (DEBUG)
		console.log(`Cleaning up storage key: ${storageKey}`);

    // Remove storage listener from either chrome.storage or localStorage
    const storageListener = listeners.get(storageKey);
    if (storageListener) {

        if (isChromeExtension)
            chrome.storage.onChanged.removeListener(storageListener);
        else 
            window.removeEventListener("storage", storageListener);
        
        listeners.delete(storageKey);
    }

    // Stop Vue watch associated with the ref
    stopWatch();
});


/**
 * Internal function to create a reactive ref (either deep or shallow) synced with storage.
 * 
 * @param {Function} refType - The type of ref to use (ref or shallowRef).
 * @param {string} storageKey - The storage key.
 * @param {*} initialValue - Default value if not in storage.
 * @returns {object} A reactive ref.
 */
function createChromeStorageRef(refType, storageKey, initialValue) {

	// make a new ref (either deep or shallow, as per refType)
    const state = refType(initialValue);

	// weak reference to the state so we can check if it's garbage collected later on,
	// but still reference it's value without preventing it from being garbage collected
    const weakState = new WeakRef(state);

	// flag to prevent infinite loops
    let isSettingValue = false;

    // Load initial value from storage (if any)
    if (isChromeExtension) {

		// read from the chrome plugin storage if it's a chrome extension
        chrome.storage.local.get([storageKey], (result) => {
            if (result[storageKey] !== undefined) {
                state.value = result[storageKey];
            }
        });
    } else {

		// read from the localStorage if it's not a chrome extension
        const storedValue = localStorage.getItem(storageKey);
        if (storedValue !== null) {
            state.value = JSON.parse(storedValue);
        }
    }

    // Now, we've created a ref called that we intend to return to the caller
	// but that caller can modify the .value of that ref. So here we'll watch
	// for changes to that value and update the storage accordingly.
    const stopWatch = watch(state, (newValue, oldValue) => {

		// if we're reading from storage or the value hasn't changed, do nothing
        if (isSettingValue || newValue === oldValue) return;

		// save the new value to persistent storage
        if (isChromeExtension)
            chrome.storage.local.set({ [storageKey]: newValue });
        else
            localStorage.setItem(storageKey, JSON.stringify(newValue));
        
    });

    // now, we returned a ref (or shallowRef) to the caller, but what if storage changes
	// in another tab or another part of the extension? We need to listen for those changes
	// and update the ref accordingly. This way, the ref will always be in sync with storage.
    function storageListener(eventOrChanges, area) {

        if (isChromeExtension) {

			// if we got an event but it wasn't for our key, or was for session or something else, gtfo
            if (area !== 'local' || !eventOrChanges[storageKey]) return;

			// dereference the weak ref to get the actual ref so we can update it
            const strongState = weakState.deref();

			// if it was garbage collected, remove the listener and gtfo
            if (!strongState) {
				
				if (DEBUG)
					console.log(`State for "${storageKey}" has been garbage collected.`);
                
                chrome.storage.onChanged.removeListener(storageListener);
                listeners.delete(storageKey);
                return;
            }

			// only update the ref if the value has changed
            if (eventOrChanges[storageKey].newValue !== strongState.value) {

				// this boolean is to prevent infinite loops, ideally
                isSettingValue = true;
                strongState.value = eventOrChanges[storageKey].newValue;
                isSettingValue = false;

            }

		// otherwise if it's not a chrome extension, we're listening for storage events
        } else {

			// if the event wasn't for our key, gtfo
            if (eventOrChanges.key !== storageKey) return;

            const strongState = weakState.deref();

			// if it was garbage collected, remove the listener and gtfo
            if (!strongState) {
                
				if (DEBUG)
					console.log(`State for "${storageKey}" has been garbage collected.`);
				
                window.removeEventListener("storage", storageListener);
                listeners.delete(storageKey);
                return;
            }

			// parse the new value from the event
            const newValue = JSON.parse(eventOrChanges.newValue);

			// only update the ref if the value has changed
            if (newValue !== strongState.value) {
                isSettingValue = true;
                strongState.value = newValue;
                isSettingValue = false;
            }
        }
    }

    // Attach listener to either chrome.storage or localStorage
    if (isChromeExtension)
        chrome.storage.onChanged.addListener(storageListener);
    else
        window.addEventListener("storage", storageListener);
    
	// Save listener to map, so we can unregister it later if the ref is garbage collected
    listeners.set(storageKey, storageListener);

    // Register cleanup using storageKey and stopWatch
	// this is because we need to stop the Vue watch when the ref is garbage collected
    registry.register(state, { storageKey, stopWatch });

	// return a ref (or shallowRef) that is synced with storage
    return state;
}


/**
 * Creates a Vue `ref` synced with Chrome storage or localStorage.
 * 
 * @param {string} storageKey - The storage key.
 * @param {*} initialValue - Default value if not in storage.
 * @returns {object} A reactive deep ref.
 */
export function chromeRef(storageKey, initialValue) {
    return createChromeStorageRef(ref, storageKey, initialValue);
}


/**
 * Creates a Vue `shallowRef` synced with Chrome storage or localStorage.
 * 
 * @param {string} storageKey - The storage key.
 * @param {*} initialValue - Default value if not in storage.
 * @returns {object} A shallow reactive ref.
 */
export function chromeShallowRef(storageKey, initialValue) {
    return createChromeStorageRef(shallowRef, storageKey, initialValue);
}
