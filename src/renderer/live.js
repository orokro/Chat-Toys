/*
	live.js
	-------

	Basic JS file to bootstrap the dev page.
*/
import { createApp } from 'vue'
import Live from './pages/Live.vue'
import 'material-icons/iconfont/material-icons.css';
import { setGlobalSocketRefPort, enableConnectionLogs } from 'socket-ref';

// get the port number from the window url
const paramPort = parseInt(new URL(location.href).searchParams.get('port') || '3001');
const hostPort = parseInt(location.port || '3001');
const paramPortOrDefault = paramPort || 3001;
const socketPort = (location.port==8080) ? paramPortOrDefault : hostPort;

// tell our library which port to use
setGlobalSocketRefPort(socketPort);
window.isPrimaryWindow = false;
// enableConnectionLogs(true);

createApp(Live).mount('#app');
