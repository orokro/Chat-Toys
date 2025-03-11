/*
	options/main.js
	---------------

	- This file is the entry point for the options page.
	- It creates a new Vue app and mounts the options component to the #app element.
*/

// Import the createApp function from Vue
import { createApp } from 'vue'
import Options from './Options.vue'

// Create a new Vue app and mount the Options component to the #app element
createApp(Options).mount('#app')
