/*
	background.js
	-------------

	Background script for the extension.
	
	Here we handle the current state of the app,
	listen for messages from the content script,
	and send messages to the stream stage popup.
*/

// fow now we just listen for this
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

	if (message.action === "open_settings") {
		chrome.tabs.create({ url: chrome.runtime.getURL("src/options.html") });
	}

});
