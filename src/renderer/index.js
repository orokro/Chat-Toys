/*
	main.js
	-------

	Basic JS file to bootstrap the dev page.
*/
import { createApp } from 'vue'
import MainWindow from './pages/MainWindow.vue'
import 'material-icons/iconfont/material-icons.css';

createApp(MainWindow).mount('#app');
