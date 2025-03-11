chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
	if (message.action === "open_settings") {
		chrome.tabs.create({ url: chrome.runtime.getURL("src/options.html") });
	}
});
