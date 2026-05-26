/*
	preload.js
	----------

	Bridge between the main process and the renderer process.
*/

// Import the necessary modules
import { contextBridge, ipcRenderer, shell, clipboard  } from 'electron';
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
	getTopUsers: (limit) => db.getTopUsers(limit),
	updateUser: (id, data) => db.updateUser(id, data),
	ban: (id) => db.ban(id),
	unBan: (id) => db.unBan(id),
	setUserPoints: (id, points) => db.setUserPoints(id, points),
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
	onShowHelp: (callback) => ipcRenderer.on('show-help', (event, data) => callback(data)),
	tick: (callback) => ipcRenderer.on('tick', callback),
	clearTick: (callback) => ipcRenderer.off('tick', callback),
	invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
	openExternal: (url) => shell.openExternal(url),
	writeToClipboard: (text) => clipboard.writeText(text),
	toggleDevTools: () => ipcRenderer.send('toggle-devtools'),
});


// Expose just the asset stuff as separate object
contextBridge.exposeInMainWorld("assetDB", {
	addAsset: (meta) => db.addAsset(meta),
	getAllAssets: () => db.getAllAssets(),
	getAssetByID: (id) => db.getAssetByID(id),
	getAssetsByType: (type) => db.getAssetsByType(type),
	removeAsset: (id) => db.removeAsset(id),

	// asset_paths (virtual filesystem) operations - most of these are
	// also driven by the express vuefinder endpoint, but the renderer
	// needs direct DB access for the "Restore Defaults" button and for
	// resolving an asset_ref from a path in the picker's save handler.
	getAssetPathRow: (path) => db.getAssetPathRow(path),
	listAssetPathChildren: (parent) => db.listAssetPathChildren(parent),
	restoreAssetDefaultLayout: () => db.restoreAssetDefaultLayout(),

	// Diagnostic for spotting broken references after a data hiccup.
	// Run from devtools: `await window.assetDB.inspectAssetPaths()`.
	// The builtInExists check is patched here because the built-in
	// catalog lives on the renderer side.
	inspectAssetPaths: () => {
		// Lazy-require to avoid loading renderer-side modules at preload
		// boot. The JSON is plain data, safe to require here.
		const builtInAssets = require(path.join(__dirname, '..', '..', 'shared', 'builtInAssets.json'));
		const builtInIds = new Set(builtInAssets.map(a => String(a.id)));
		return db.inspectAssetPaths((id) => builtInIds.has(String(id)));
	},
});


// stuff for interacting with the chat source manager
contextBridge.exposeInMainWorld('chatSourceAPI', {
	add: (id) => ipcRenderer.invoke('CSM-add-chat', id),
	show: (id) => ipcRenderer.invoke('CSM-show-chat', id),
	remove: (id) => ipcRenderer.invoke('CSM-remove-chat', id),
	enable: (id) => ipcRenderer.invoke('CSM-enable-chat', id),
	disable: (id) => ipcRenderer.invoke('CSM-disable-chat', id),
	getAll: () => ipcRenderer.invoke('CSM-get-chats'),
	onUpdate: (cb) => ipcRenderer.on('chat-source-updated', (e, data) => cb(data)),
});


// stuff for moving files into VTube Studio StreamingAssets folder
contextBridge.exposeInMainWorld('vtsBridge', {
	copyAssetToStreaming: (payload) => ipcRenderer.invoke('vts-copy-asset', payload),
});


// ---------------------------------------------------------------------------
// Twitch Manager Bridge (Twitch-specific naming)
// ---------------------------------------------------------------------------

/**
 * Exposes Twitch-specific bridge to the renderer.
 * Uses explicit method names so future platforms (YouTube, Kick, etc.)
 * can coexist cleanly under their own APIs.
 */
contextBridge.exposeInMainWorld('twitchAPI', {
	/**
	 * Start Twitch OAuth flow.
	 */
	connect: () => ipcRenderer.invoke('twitch-connect'),

	/**
	 * Disconnect Twitch and clear credentials.
	 */
	disconnect: () => ipcRenderer.invoke('twitch-disconnect'),

	/**
	 * Get current Twitch auth/user status.
	 * @returns {Promise<object>}
	 */
	getStatus: () => ipcRenderer.invoke('twitch-get-status'),

	/**
	 * Configure Twitch application (client ID, scopes).
	 * @param {{ clientId: string, scopes?: string[] }} cfg
	 */
	setClientConfig: (cfg) => ipcRenderer.invoke('twitch-set-config', cfg),

	/**
	 * Listen for Twitch updates (status or messages).
	 * @param {(data:any)=>void} cb
	 */
	onUpdate: (cb) => ipcRenderer.on('twitch-update', (e, data) => cb(data)),
});


// ---------------------------------------------------------------------------
// Twurple Manager Bridge (the new Twitch integration via Twurple)
// ---------------------------------------------------------------------------

/**
 * Exposes the Twurple-specific bridge to the renderer. Lives side-by-side
 * with the legacy twitchAPI during the Phase 1 migration. The new
 * Connection Settings sub-tab uses this; the existing Twitch sub-tab
 * keeps using twitchAPI. After cutover (Phase 4), the legacy bridge can
 * be hidden but left in place.
 */
contextBridge.exposeInMainWorld('twurpleAPI', {

	/**
	 * Start the Twurple OAuth code-grant flow (opens the popup).
	 * @returns {Promise<{ok:boolean, error?:string}>}
	 */
	connect: () => ipcRenderer.invoke('twurple-connect'),

	/**
	 * Disconnect Twurple and clear stored credentials.
	 * @returns {Promise<{ok:boolean, error?:string}>}
	 */
	disconnect: () => ipcRenderer.invoke('twurple-disconnect'),

	/**
	 * Get current Twurple auth/user status.
	 * @returns {Promise<{authed:boolean, user?:object, scopes?:string[]}>}
	 */
	getStatus: () => ipcRenderer.invoke('twurple-get-status'),

	/**
	 * Listen for Twurple status/notification updates from the main process.
	 * @param {(data:any)=>void} cb
	 */
	onUpdate: (cb) => ipcRenderer.on('twurple-update', (e, data) => cb(data)),
});

