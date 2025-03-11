/*
	chat_content_script.js
	----------------------

	This is the main entry point for reading the chat and parsing messages.

	This script has two primary objectives::
		1. Add a couple buttons to show the windows related to the extension.
		2. Read the chat messages and parse them to determine if they contain any commands.

	When a command is detected, the script will send a message to the background script to handle the command.

	Note: This script is injected into the chat page and runs in the context of the chat page.
*/

import { dropALog } from "./scripts/CSLogger";

// for debug
console.log("Content script injected!");
dropALog();

// Wait a bit to ensure elements exist
setTimeout(() => {

	const target = document.querySelector("#chat-messages #primary-content");
	console.log("Checking for target:", target);
	if (!target) {
		console.warn("Target element not found!");
		return;
	}

	const button = document.createElement("button");
	button.textContent = "Open Chat Toys";
	button.style.margin = "10px";
	button.onclick = () => {
		const popup = window.open(
			chrome.runtime.getURL("src/stream_stage_popup.html"),
			"popup",
			"width=900,height=700"
		);
	};

	const settingsButton = document.createElement("button");
	settingsButton.textContent = "Open Settings";
	settingsButton.style.margin = "10px";
	settingsButton.onclick = () => {
		chrome.runtime.sendMessage({ action: "open_settings" });
	};


	target.appendChild(button);
	target.appendChild(settingsButton);
	console.log("Buttons added successfully!");

}, 500);

