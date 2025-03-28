/*
	chatProcessorClient.js
	----------------------

	This script will be injected into chat pages when the user clicks the "Enable Chat Socket" button.
	It will override the fetch function to intercept chat messages and forward them to the main process via a WebSocket connection.

	TODO: make socket plugin more robust & deeply integrated with the chatProcessor.
*/

// Flag to mark script injection
window.YTCTLoaded = true;
window.YTCTEnabled = true; // default to enabled on initial load

// WebSocket connection
let socket;
function connectSocket() {

	// Don't connect if not enabled or already connected
	if (!window.YTCTEnabled) return;
	if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) return;

	// Connect to the WebSocket server in Electron
	socket = new WebSocket('ws://localhost:3001');

	// when we first connect, send welcome message
	socket.addEventListener('open', () => {
		console.log('WebSocket connected');
		socket.send(JSON.stringify({
			type: 'chat',
			data: { msg: 'connected' }
		}));
	});

	// if we closed, try to reconnect (if enabled)
	socket.addEventListener('close', () => {
		
		console.warn('[YTCT] Socket closed. Will attempt reconnect if enabled.');
		
		// Try reconnecting every 2.5s if still enabled
		if (window.YTCTEnabled)
			setTimeout(connectSocket, 2500);
		
	});

	socket.addEventListener('error', (err) => {
		console.warn('[YTCT] Socket error:', err);
	});
}
connectSocket();

// save original fetch function
const fetchFallback = window.fetch;
window.fetchFallback = fetchFallback;

// override fetch function to intercept chat messages
window.fetch = async (...args) => {

	// get the request URL
	const request = args[0];
	const url = (typeof request === 'string') ? request : request.url;
	const result = await fetchFallback(...args);

	// check if the URL is a YouTube chat API endpoint
	const currentDomain = location.protocol + '//' + location.host;
	const ytApi = (end) => currentDomain + '/youtubei/v1/live_chat' + end;
	const isReceiving = url.startsWith(ytApi('/get_live_chat'));
	const isSending = url.startsWith(ytApi('/send_message'));

	// if the URL is a chat API endpoint, parse the JSON and forward it to the main process
	if (window.YTCTEnabled && (isReceiving || isSending)) {
		try {
			const cloned = result.clone();
			const json = await cloned.json();
			const response = JSON.stringify(json);

			window.dispatchEvent(new CustomEvent(
				isReceiving ? 'messageReceive' : 'messageSent',
				{ detail: response }
			));

			if (isReceiving && socket && socket.readyState === WebSocket.OPEN) {
				socket.send(JSON.stringify({
					type: 'chat',
					data: response
				}));
			}
		} catch (e) {
			console.warn('[fetch override] Failed to parse JSON:', e);
		}
	}

	return result;
};

// handle fetch proxy events
window.addEventListener('proxyFetchRequest', async function (event) {

	if (!window.YTCTEnabled)
		return;

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

// Listen for toggle messages
window.addEventListener('message', (event) => {

	if (event.data?.source === 'YTCTController') {
		window.YTCTEnabled = !!event.data.enabled;
		console.log(`[YTCT] ${window.YTCTEnabled ? 'Enabled' : 'Disabled'}`);
		if (window.YTCTEnabled) {
			connectSocket();
		}
	}
	
});
