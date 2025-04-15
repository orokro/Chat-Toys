/*
	preload.ts
	----------

	Bridge between the main process and the renderer process.
*/

// Import the necessary modules
import { contextBridge, ipcRenderer } from 'electron';
const path = require("path");
const isDev = process.env.NODE_ENV === 'development';

import 'electron-interval-system/preload.js'; 

contextBridge.exposeInMainWorld('env', {
	isDev,
});

// Expose the electronAPI object to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
	sendMessage: (message) => ipcRenderer.send('message', message),
	onChatMessage: (callback) => ipcRenderer.on('chat-message', (event, data) => callback(data)),
	onServerLog: (callback) => ipcRenderer.on('server-log', (event, data) => callback(data)),
	tick: (callback) => ipcRenderer.on('tick', (event) => callback()),
	invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
});
