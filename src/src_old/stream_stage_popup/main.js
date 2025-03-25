/*
	steam_stage_popup/main.js
	-------------------------

	- This file is the entry point for the Stream Stage Popup.
	- It creates a new Vue app and mounts the Popup component to the #app element.
*/

// Import the createApp function from Vue
import { createApp } from 'vue'
import Popup from './StreamStagePopup.vue'

// Create a new Vue app and mount the Popup component to the #app element
createApp(Popup).mount('#app')
