document.addEventListener("DOMContentLoaded", () => {
	const colorPicker = document.getElementById("colorPicker");
	
	chrome.storage.sync.get("bgColor", ({ bgColor }) => {
		if (bgColor) {
			colorPicker.value = bgColor;
		}
	});
	
	colorPicker.addEventListener("input", (event) => {
		const newColor = event.target.value;
		chrome.storage.sync.set({ bgColor: newColor });
	});
});
