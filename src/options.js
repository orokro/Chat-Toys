
let colorChangeTimer = null;

function saveCurrentColor() {

	const colorPicker = document.getElementById("colorPicker");
	const newColor = colorPicker.value;
	chrome.storage.sync.set({ bgColor: newColor });

}


function scheduleColorChange() {

	if (colorChangeTimer != null)
		return;

	saveCurrentColor();

	colorChangeTimer = setTimeout(() => {

		saveCurrentColor();
		colorChangeTimer = null;
	}
		, 300);
}


document.addEventListener("DOMContentLoaded", () => {
	const colorPicker = document.getElementById("colorPicker");

	chrome.storage.sync.get("bgColor", ({ bgColor }) => {
		if (bgColor) {
			colorPicker.value = bgColor;
		}
	});

	colorPicker.addEventListener("input", (event) => {
		scheduleColorChange();
	});

});
