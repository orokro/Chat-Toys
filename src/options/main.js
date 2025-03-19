/*
	options/main.js
	---------------

	- This file is the entry point for the options page.
	- It creates a new Vue app and mounts the options component to the #app element.
*/

// Import the createApp function from Vue
import { createApp } from 'vue'
import Options from './Options.vue'
import 'material-icons/iconfont/material-icons.css';

import { createVuetify } from 'vuetify';
import 'vuetify/styles';

const vuetify = createVuetify();

// Create a new Vue app and mount the Options component to the #app element
const app = createApp(Options);
app.use(vuetify);
app.mount('#app');
