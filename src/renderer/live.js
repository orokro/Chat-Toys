/*
	live.js
	-------

	Basic JS file to bootstrap the dev page.
*/
import { createApp } from 'vue'
import Live from './pages/Live.vue'
import 'material-icons/iconfont/material-icons.css';
import { setGlobalSocketRefPort, enableConnectionLogs } from 'socket-ref';
import { registerInstalledPluginsFromHTTP } from './plugins/PluginManager';

// get the port number from the window url
const paramPort = parseInt(new URL(location.href).searchParams.get('port') || '3001');
const hostPort = parseInt(location.port || '3001');
const paramPortOrDefault = paramPort || 3001;
const socketPort = (location.port==8080) ? paramPortOrDefault : hostPort;

// tell our library which port to use
setGlobalSocketRefPort(socketPort);
window.isPrimaryWindow = false;
// Publish the widget-server port so plugin components (PluginWidgetHost iframe
// src, RemoteBrokerProxy WS) hit the Express server (3001) and not the Vite dev
// server (8080) the live page itself is served from in dev.
window.initPort = socketPort;
// enableConnectionLogs(true);

// Register installed plugins (over HTTP - the live page has no IPC) BEFORE
// mounting, so plugin widgets resolve in LiveLayout / single-widget mode.
async function boot() {
	try {
		await registerInstalledPluginsFromHTTP(socketPort);
	} catch (e) {
		console.warn('Live-page plugin registration failed; built-ins only:', e);
	}
	createApp(Live).mount('#app');
}

boot();
