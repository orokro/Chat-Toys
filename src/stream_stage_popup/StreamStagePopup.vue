<template>
	<!-- The container's style is bound to bgColor so it updates automatically -->
	<div :style="{ backgroundColor: bgColor }">
	  <h2>Hello, World from Popup!</h2>
	  <!-- Additional popup UI elements can go here -->
	</div>
  </template>
  
  <script>
  export default {
	name: 'Popup',
	data() {
	  return {
		// Default background color if none is saved
		bgColor: '#ffffff'
	  }
	},
	mounted() {
	  // Retrieve the saved background color from Chrome storage on mount.
	  chrome.storage.sync.get("bgColor", ({ bgColor }) => {
		if (bgColor) {
		  this.bgColor = bgColor;
		}
	  });
  
	  // Listen for changes to the background color and update accordingly.
	  chrome.storage.onChanged.addListener((changes) => {
		if (changes.bgColor) {
		  this.bgColor = changes.bgColor.newValue;
		}
	  });
	}
  }
  </script>
  
  <style scoped>
  /* You can add additional styles here if needed */
  </style>
  