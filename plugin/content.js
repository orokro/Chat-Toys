/*
	content.js
	----------

	This file is the content script that is injected into the YouTube Live Chat page.

	It will forward chat messages to the main process via a WebSocket connection.
*/

/**
 * Add a button to the YouTube Live Chat page to enable the chat forwarding.
 */
function addInjectionButton() {

	// Only add the button if it doesn't already exist
	const header = document.querySelector('yt-live-chat-header-renderer');
	if (!header || document.getElementById('inject-socket-btn')) return;

	// Create the button
	const btn = document.createElement('button');
	btn.id = 'inject-socket-btn';
	btn.textContent = 'Enable YTCT';
	btn.style.cssText = 'margin-left: 10px; padding: 4px 8px; cursor: pointer;';

	// our state for if the chat forwarder is enabled
	let enabled = false;

	// Add a click listener to the button
	btn.addEventListener('click', () => {

		// Inject the chatProcessorClient script if it hasn't been loaded yet
		if (!window.YTCTLoaded) {
			const script = document.createElement('script');
			script.src = chrome.runtime.getURL('chatProcessorClient.js');
			script.onload = () => script.remove();
			(document.head || document.documentElement).appendChild(script);
		}

		// Toggle the enabled state
		enabled = !enabled;
		btn.textContent = enabled ? 'Disable YTCT' : 'Enable YTCT';

		// Send a message to the main process to enable/disable the chat forwarder
		window.postMessage({ source: 'YTCTController', enabled }, '*');
	});

	// Append the button to the header
	header.appendChild(btn);
}


// Observe the body for changes and add the button when the chat page loads
// Because the app is a SPA, the chat page may change without a full page reload
const observer = new MutationObserver(addInjectionButton);
observer.observe(document.body, { childList: true, subtree: true });

// this may be called more than once as the page changes, but that's fine
// because it guards against adding the button multiple times
addInjectionButton();
