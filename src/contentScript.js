console.log("Content script injected!");

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
			chrome.runtime.getURL("popup.html"),
			"popup",
			"width=400,height=300"
		);

		setTimeout(() => {
			popup.postMessage({ text: "from content script" }, "*");
		}, 10000);
	};

	target.appendChild(button);
	console.log("Button added successfully!");
}, 2000);
