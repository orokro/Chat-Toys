/*
	keepAliveSocket.js
	------------------

	Provides a function to set up the keep-alive socket so the
	UI can see which widgets are active. I guess it's not really 'keep-alive'
	but rather 'live reporting' but w/e.
*/

// vue
import { socketRef, socketShallowRef, socketShallowRefReadOnly, socketRefAsync, bindRef, bindRefs } from 'socket-ref';


/**
 * Helper to determine if we're in OBS or not.
 * 
 * @returns {Boolean} - true if we're in OBS, false otherwise
 */
const isInOBS = () => navigator.userAgent.includes("OBS");


/**
 * Helper to determine if we're in Electron only (not OBS).
 * 
 * @returns {Boolean} - true if we're in Electron, false otherwise
 */
const isInElectronOnly = () => navigator.userAgent.includes("Electron") && !navigator.userAgent.includes("OBS");


/**
 * Sets up timing code so the electron UI can see which widgets are active.
 * 
 * @param {String} toySlug - slug for the toy we're in
 * @param {String} widgetSlug - slug for the specific widget for that toy
 * @returns {Object} - object, like {socketRef, stopInterval } containing the socket ref & method to stop the interval
 */
export function keepAliveSocket(toySlug, widgetSlug) {
	
	// gtfo if we're in electron
	if (isInElectronOnly())
		return;

	// make the ref w/ the matching slug
	const socketSlug = `live-state-${toySlug}-${widgetSlug}`;
	const socketRef = socketShallowRef(socketSlug, 'Z_0');

	// set up interval to periodically update the socket
	const timeUpdateInterval = setInterval(() => {

		// gtfo if we're in electron
		if (isInElectronOnly())
			return;
		
		const now = Date.now();
		const code = isInOBS() ? 'O' : 'B';
		socketRef.value = `${code}_${now}`;

	}, 1000);

	// method to stop the interval
	const stopInterval = () => {
		clearInterval(timeUpdateInterval);
	};

	// return the socket ref & method to stop interval
	return {
		socketRef: socketShallowRefReadOnly(socketSlug, socketRef),
		stopInterval
	};
}
