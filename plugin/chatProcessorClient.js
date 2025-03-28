/*
	chatProcessorClient.js
	----------------------

	This script will be injected into chat pages when the user clicks the "Enable Chat Socket" button.
	It will override the fetch function to intercept chat messages and forward them to the main process via a WebSocket connection.

	TODO: make socket plugin more robust & deeply integrated with the chatProcessor.
*/

// connect to our Electron Backend
const socket = new WebSocket('ws://localhost:3001');

// when we connect, send a message to denote we've connected
socket.addEventListener('open', () => {

	// for debug
	console.log('WebSocket connected');

	// send a message to denote we've connected
	const message = {
		type: 'chat',
		data: { msg: 'connected' }
	};
	socket.send(JSON.stringify(message));
});

// save a reference to the original fetch function
const fetchFallback = window.fetch;
window.fetchFallback = fetchFallback;

// override the fetch function to intercept chat messages
window.fetch = async (...args) => {

	// get the URL from the request
	const request = args[0];
	const url = (typeof request === 'string') ? request : request.url;

	// make the request
	const result = await fetchFallback(...args);

	// define the YouTube API endpoint
	const currentDomain = location.protocol + '//' + location.host;
	const ytApi = function (end) {
		return currentDomain + '/youtubei/v1/live_chat' + end;
	};

	// check if we're receiving or sending a message
	const isReceiving = url.startsWith(ytApi('/get_live_chat'));
	const isSending = url.startsWith(ytApi('/send_message'));
	const action = isReceiving ? 'messageReceive' : 'messageSent';

	// if we're receiving or sending a message, parse the JSON and forward it
	if (isReceiving || isSending) {
		try {
			const cloned = result.clone();
			const json = await cloned.json();
			const response = JSON.stringify(json);
			window.dispatchEvent(new CustomEvent(action, { detail: response }));

			// if we're receiving a message, send it to the main Electron process
			if (isReceiving) {

				// if socket is open, send the message
				if (socket.readyState === WebSocket.OPEN) {
					socket.send(
						JSON.stringify({
							type: 'chat',
							data: response
						})
					);
				}
			}


		} catch (e) {
			console.warn('[fetch override] Failed to parse JSON:', e);
		}
	}

	return result;
};


// Listener for fetch requests via events
window.addEventListener('proxyFetchRequest', async function (event) {
	
	try {
		const args = JSON.parse(event.detail);
		const request = await fetchFallback(...args);
		const json = await request.json();
		window.dispatchEvent(new CustomEvent('proxyFetchResponse', {
			detail: JSON.stringify(json)
		}));

	} catch (e) {
		console.warn('[proxyFetchRequest] Failed to handle request:', e);
	}
});
