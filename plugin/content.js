/*
	content.js
	----------

	This file is the content script that is injected into the YouTube Live Chat page.

	It will forward chat messages to the main process via a WebSocket connection.
*/

/**
 * Adds a button to the YouTube Live Chat page that will inject a script to enable chat forwarding.
 */
function addInjectionButton() {

	// if the button is already there, don't add it again
	const header = document.querySelector('yt-live-chat-header-renderer');
	if (!header || document.getElementById('inject-socket-btn'))
		return;

	// create the button
	const btn = document.createElement('button');
	btn.id = 'inject-socket-btn';
	btn.textContent = 'Enable YTCT';
	btn.style.cssText = 'margin-left: 10px; padding: 4px 8px; cursor: pointer;';

	// when the button is clicked, inject the script
	btn.addEventListener('click', () => {

		// add our chat processing script to the page
		const script = document.createElement('script');
		script.src = chrome.runtime.getURL('chatProcessorClient.js');
		script.onload = () => script.remove();
		(document.head || document.documentElement).appendChild(script);
	});

	// add the button to the header
	header.appendChild(btn);
}

// we'll use an observer because the chat page is a SPA
// and content loads dynamically via JS not via the browser
const observer = new MutationObserver(addInjectionButton);
observer.observe(document.body, { childList: true, subtree: true });

// this may be called more than once as the page changes, but that's fine
// because it guards against adding the button multiple times
addInjectionButton();
