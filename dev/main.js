/*
	main.js
	-------

	Basic JS file to bootstrap the dev page.
*/
import { createApp } from 'vue'
import TestApp from '../src/options/Options.vue'
import 'material-icons/iconfont/material-icons.css';

createApp(TestApp).mount('#app');
