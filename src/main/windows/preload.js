/*
	preload.js
	----------

	Bridge between the main process and the renderer process.
*/

// Import the necessary modules
import { contextBridge, ipcRenderer } from 'electron';
const path = require("path");
const { DatabaseManager } = require(path.join(__dirname, "../system/database"));
const isDev = process.env.NODE_ENV === 'development';

// sets up our electron based timeout/intervals
import 'electron-interval-system/preload.js'; 

// grab passed CLI args
const dbPathArg = process.argv.find(arg => arg.startsWith("--dbPath="));
const dbPath = dbPathArg?.replace("--dbPath=", "") ?? ".";

// Expose the DatabaseManager object to the renderer process
const db = new DatabaseManager(dbPath);
contextBridge.exposeInMainWorld("ytctDB", {
	getUser: (id) => db.getUser(id),
	getUsers: (ids) => db.getUsers(ids),
	getUserFull: (id) => db.getUserFull(id),
	getUserByDisplayName: (name) => db.getUserByDisplayName(name),
	getUserFullByDisplayName: (name) => db.getUserFullByDisplayName(name),
	getAllUsersFull: () => db.getAllUsersFull(),
	updateUser: (id, data) => db.updateUser(id, data),
	ban: (id) => db.ban(id),
	unBan: (id) => db.unBan(id),
	dbPath: dbPath
});


// Expose our environment variable to the renderer process
contextBridge.exposeInMainWorld('env', {
	isDev,
});


// Expose the electronAPI object to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
	sendMessage: (message) => ipcRenderer.send('message', message),
	onChatMessage: (callback) => ipcRenderer.on('chat-message', (event, data) => callback(data)),
	onServerLog: (callback) => ipcRenderer.on('server-log', (event, data) => callback(data)),
	tick: (callback) => ipcRenderer.on('tick', callback),
	clearTick: (callback) => ipcRenderer.off('tick', callback),
	invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
});


// Expose just the asset stuff as separate object
contextBridge.exposeInMainWorld("assetDB", {
	addAsset: (meta) => db.addAsset(meta),
	getAllAssets: () => db.getAllAssets(),
	getAssetByID: (id) => db.getAssetByID(id),
	getAssetsByType: (type) => db.getAssetsByType(type),
	removeAsset: (id) => db.removeAsset(id),
});


// stuff for interacting with the chat source manager
contextBridge.exposeInMainWorld('chatSourceAPI', {
	add: (id) => ipcRenderer.invoke('CSM-add-chat', id),
	remove: (id) => ipcRenderer.invoke('CSM-remove-chat', id),
	enable: (id) => ipcRenderer.invoke('CSM-enable-chat', id),
	disable: (id) => ipcRenderer.invoke('CSM-disable-chat', id),
	getAll: () => ipcRenderer.invoke('CSM-get-chats'),
	onUpdate: (cb) => ipcRenderer.on('chat-source-updated', (e, data) => cb(data)),
});
