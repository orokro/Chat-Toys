/*
	chatTester.js
	-------------

	Basic JS file to bootstrap the chat tester page
*/
import { createApp } from 'vue'
import ChatTesterWindow from './pages/ChatTesterWindow.vue'
import 'material-icons/iconfont/material-icons.css';

window.isPrimaryWindow = false;

createApp(ChatTesterWindow).mount('#app');
