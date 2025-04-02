/*
	preload.ts
	----------

	Bridge between the main process and the renderer process.
*/

// Import the necessary modules
import { contextBridge, ipcRenderer } from 'electron';
const path = require("path");
const { DatabaseManager } = require(path.join(__dirname, "../system/database"));

// Expose the electronAPI object to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
	sendMessage: (message) => ipcRenderer.send('message', message),
	onChatMessage: (callback) => ipcRenderer.on('chat-message', (event, data) => callback(data)),
	tick: (callback) => ipcRenderer.on('tick', (event) => callback()),
});

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
	updateUser: (id, data) => db.updateUser(id, data),
	ban: (id) => db.ban(id),
	unBan: (id) => db.unBan(id),
	dbPath: dbPath
});
