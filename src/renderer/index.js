/*
	main.js
	-------

	Basic JS file to bootstrap the dev page.
*/
import { createApp } from 'vue'
import MainWindow from './pages/MainWindow.vue'
import 'material-icons/iconfont/material-icons.css';
import { setGlobalSocketRefPort, enableConnectionLogs } from 'socket-ref';

// wrap async logic in helper function
async function startMain(){

	// get port from the main process
	const port = await window.electronAPI.invoke('get-server-port');
	window.initPort = port;
	console.log("Before Creating Main Window, Starting with Port: " + port);

	// set the socket port for the library globally
	setGlobalSocketRefPort(port);

	// enable connection logs
	// enableConnectionLogs(true);

	// now we'll create the main window, so the socketRefs use the correct port
	createApp(MainWindow).mount('#app');
}

// start up
startMain();
