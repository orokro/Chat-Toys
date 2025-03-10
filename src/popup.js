// popup.js
window.addEventListener("message", (event) => {
	if (event.data?.text) {
		document.getElementById("message").textContent = `Hello. ${event.data.text}`;
	}
});

