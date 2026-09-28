import { createApp } from 'vue'
import KaraokeQueueManagerPage from './pages/KaraokeQueueManagerPage.vue'
import 'material-icons/iconfont/material-icons.css';
import { setGlobalSocketRefPort } from '@scripts/sockets';

async function startManager(){
	const port = await window.electronAPI.invoke('get-server-port');
	window.initPort = port;
	setGlobalSocketRefPort(port);
	window.isPrimaryWindow = false;

	createApp(KaraokeQueueManagerPage).mount('#app');
}

startManager();
