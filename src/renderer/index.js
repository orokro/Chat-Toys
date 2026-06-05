/*
	main.js
	-------

	Basic JS file to bootstrap the dev page.
*/
import { createApp } from 'vue'
import MainWindow from './pages/MainWindow.vue'
import 'material-icons/iconfont/material-icons.css';
import { setGlobalSocketRefPort, enableConnectionLogs } from 'socket-ref';
import { installHelpPrimitives } from './components/options/page_help/help_system/helpPrimitivesPlugin';
import { registerInstalledPlugins } from './plugins/PluginManager';

// wrap async logic in helper function
async function startMain(){

	// get port from the main process
	const port = await window.electronAPI.invoke('get-server-port');
	window.initPort = port;
	console.log("Before Creating Main Window, Starting with Port: " + port);

	// set the socket port for the library globally
	setGlobalSocketRefPort(port);

	window.isPrimaryWindow = true;

	// enable connection logs
	// enableConnectionLogs(true);

	// Register installed plugins as toys BEFORE ChatToysApp is constructed
	// (MainWindow mount). ChatToysApp + ToyManager read toysData.asObject for
	// every enabled slug, so plugin classes must exist first. Non-fatal on
	// failure - the app still boots with just the built-in toys.
	try {
		await registerInstalledPlugins();
	} catch (e) {
		console.warn('Plugin registration failed; continuing with built-ins only:', e);
	}

	// now we'll create the main window, so the socketRefs use the correct port
	const app = createApp(MainWindow);

	// Global-register the help-system's content primitives so topic
	// SFCs can use <HelpSection>, <HelpLink>, <HelpTip>, etc. without
	// importing each one in every file. There are likely 50+ topic
	// files - the savings outweighs the small global-namespace cost
	// (all primitives are Help-prefixed).
	installHelpPrimitives(app);

	app.mount('#app');
}

// start up
startMain();
