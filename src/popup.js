window.addEventListener("DOMContentLoaded", () => {
	chrome.storage.sync.get("bgColor", ({ bgColor }) => {
		if (bgColor) {
			document.body.style.backgroundColor = bgColor;
		}
	});
});

chrome.storage.onChanged.addListener((changes) => {
	if (changes.bgColor) {
		document.body.style.backgroundColor = changes.bgColor.newValue;
	}
});
