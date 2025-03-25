/*
	background.js
	-------------

	Background script for the extension.
	
	Here we handle the current state of the app,
	listen for messages from the content script,
	and send messages to the stream stage popup.
*/

import { dropALog } from "./scripts/CSLogger";

// for debug
console.log("Background script injected!");
dropALog();

// fow now we just listen for this
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

	if (message.action === "open_settings") {
		chrome.tabs.create({ url: chrome.runtime.getURL("src/options.html") });
	}

});
