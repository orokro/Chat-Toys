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
 * Checks OBS status (if available) to see if it's live.
 * 
 * @returns {Promise} - Promise that resolves to true if OBS is live, false otherwise
 */
const obsIsLive = () => {

	return new Promise((resolve, reject) => {

		// errors will resolve false
		try {
			// if we have obs studio, obs might be libe
			if (window.obsstudio) {

				// get the status..., with async call back
				window.obsstudio.getStatus(function(status) {
					resolve(status.streaming);				
				});

			// if we're not in OBS, we can just resolve false
			}else{
				resolve(false);
			}
		}catch(e) {
			resolve(false);
		}
	});
}


/**
 * Sets up timing code so the electron UI can see which widgets are active.
 * 
 * @param {String} toySlug - slug for the toy we're in
 * @param {String} widgetSlug - slug for the specific widget for that toy
 * @returns {Object} - object, like {socketRef, stopInterval } containing the socket ref & method to stop the interval
 */
export async function keepAliveSocket(toySlug, widgetSlug) {
	
	// gtfo if we're in electron
	if (isInElectronOnly())
		return;

	/*
		Right so this function has two purposes - one to send a 'keep alive' (a bit of a misnomer)
		based on the actual widget is loaded. This will be used to light the status light 
		inside the electron app when it widget is loaded somewhere.

		Widgets can be loaded in 3 places:
		 - inside Electron itself, in the layout page or on their settings pages
		 - inside any Browser, like Chrome, Firefox, etc, if you're testing the widgets
		 - inside OBS Browser source

		We don't want to send the keep alive if we're in Electron, we're only interested in reporting
		if the widgets are found outside of Electron, like a browser or OBS.

		So we'll create a websocket ref with the slug of the toy and widget, and update our status if we're in
		OBS or a browser. The socket ref will be updated every second with the current time, and the code.

		---- HOWEVER ----

		We also want to run some code we're in OBS and if the streamer is LIVE. In this case,
		electron should search the users channel for a live stream and automatically start watching it's chat.

		While I could just use the same socket ref, I think it's better to have a separate one just for OBS data.

		Now, this function, keepAliveSocket will be run in every widget that's loaded, which means multiple
		things will be writing to write to the socket in parallel.

		We'll use the following format: "timestamp:live_status". We will only update the socket if our current timestamp
		is greater than the previous timestamp.

		Then, over on the electron side, we'll watch() this socket and if live_status goes from false to true
		it we can start watching the chat. If it goes from true to false, we can stop watching the chat.

		For electrons side, we'll only accept timestamps newer than 2 seconds, so if obs is closed, the socket
		will still have a value on it, but we'll treat anything older than 2 seconds as 'false' automatically.
	*/

	// make the ref w/ the matching slug. This will report the actual status of this widget
	const socketSlug = `live-state-${toySlug}-${widgetSlug}`;
	const socketRef = socketShallowRef(socketSlug, 'Z_0');

	// make a socket ref for OBS global status
	const initialTime = Date.now();
	const initialStatus = await obsIsLive();
	const osbSocketRef = socketShallowRef('obsStatus', `${initialTime}:${initialStatus}`);

	// set up interval to periodically update the socket
	const timeUpdateInterval = setInterval(async () => {

		// gtfo if we're in electron
		if (isInElectronOnly())
			return;

		// update our widget socket ref		
		const now = Date.now();
		const code = isInOBS() ? 'O' : 'B';
		socketRef.value = `${code}_${now}`;

		// if we're in obs, lets potentially update the obs socket ref
		if(isInOBS()){

			// get the current socket value / status
			const currentSocketValue = osbSocketRef.value;
			const currentSocketTime = parseInt(currentSocketValue.split(':')[0], 10);

			// if the delta time time is greater than 1 second, we can update the socket
			if (now - currentSocketTime > 1000) {

				// update the socket ref
				const status = await obsIsLive();
				osbSocketRef.value = `${now}:${status}`;
			}
		}

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
