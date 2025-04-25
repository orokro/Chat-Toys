/*
	ChatSourceManager.js
	--------------------

	This file defines two classes
	- ChatSource
	- ChatSourceManager

	these classes are used to manage the chat sources for the app including building the window	
	for them to read the chat, and managing the state of the chat sources.
*/

// electron/node imports
const { BrowserWindow, ipcMain } = require('electron');
const { join } = require('path');
const Store = require('electron-store');
const store = new Store();

// the script to inject into chat windows to read chat
const chatReaderScript = `console.log("reading chat")`;


/**
 * Manages one of of our chat sources
 */
class ChatSource {

	/**
	 * Builds a new chat source
	 * 
	 * @param {String} youtube_id - the YouTube video ID for this chat
	 * @param {ChatSourceManager} manager - reference to the manager
	 * @param {Function} testFn - function to test a URL if a chat is live/available
	 * @param {Boolean} isNew - OPTIONAL; true if this was newly added by the user
	 */
	constructor(youtube_id, manager, testFn, isNew = false) {

		// save our refs
		this.youtube_id = youtube_id;
		this.manager = manager;
		this.testFn = testFn;
		
		// build our YouTube chat ID
		this.chatURL = `https://www.youtube.com/live_chat?is_popout=1&v=${this.youtube_id}`;
		
		// true when the user wants this chat source enabled
		this.enabled = false;

		// true by default, while we check if the chat source is available
		// (i.e. the stream is live and chat is not disabled)
		this.status_pending = true;

		// true if the chat source is live * and * available
		this.available = false;

		// the electron window that will be used to read the chat
		this.window = null;

		// kick off our logic tto see if we're available and all that,
		// we need a async function to do this
		this.init(isNew);
	}


	/**
	 * Continues the constructor, in async fn
	 * 
	 * @param {Boolean} autoEnable - true if we should auto-enable this chat source (if available)	
	 */
	async init(autoEnable) {

		// use our WindowTester method (see WindowTests.js) to check if this chat is live
		try {
			this.available = await this.testFn(this.chatURL, 'chatIsLive');
		} catch (err) {
			console.error(`Error checking availability for ${this.youtube_id}:`, err);
		}

		// we're no longer pending
		this.status_pending = false;

		// if we're available, & we have autoEnable true, we can enable the chat source
		if (autoEnable && this.available)
			this.enable();
		
		// let the FE note when the status changes
		this.manager.notifyRenderer(); // always push update when status changes
	}


	/**
	 * Enables the chat source for reading
	 */
	async enable() {

		// GTFO if we're not available, or we're pending, or already enabled
		if (!this.available || this.status_pending || this.enabled) return;

		// build a new browser window for this chat source
		this.window = new BrowserWindow({
			width: 500,
			height: 700,
			webPreferences: {
				preload: join(__dirname, 'chatPreload.js'),
				nodeIntegration: false,
				contextIsolation: true,
				sandbox: false
			},
			show: false,
			autoHideMenuBar: true
		});

		// never let it close fully - that would stop the chat reading
		this.window.on('close', (e) => {
			e.preventDefault();
			this.window.hide();
		});

		// load the YouTube chat ID & inject the script to read the chat
		await this.window.loadURL(this.chatURL);
		await this.window.webContents.executeJavaScript(chatReaderScript);

		// we gucci
		this.enabled = true;
		this.manager.notifyRenderer();
	}


	/**
	 * Closes the window reading the chat, which stops it effectively
	 */
	disable() {

		// destroy potentially open window
		if (this.window) {
			this.window.destroy();
			this.window = null;
		}

		// we're no longer enabled
		this.enabled = false;
		this.manager.notifyRenderer();
	}


	/**
	 * When app is closing, we gotta close windows to clean up
	 */
	destroy() {
		if (this.window) {
			this.window.destroy();
			this.window = null;
		}
	}

	
	/**
	 * For serialization, so ChatSourceManager can send the state to the FE.
	 * 
	 * @returns {Object} - a JSON object with the chat source data
	 */
	toJSON() {
		return {
			youtube_id: this.youtube_id,
			enabled: this.enabled,
			status_pending: this.status_pending,
			available: this.available
		};
	}
}


/**
 * Manages all the chat sources for the app
 */
class ChatSourceManager {

	/**
	 * Makes a new chat source manager
	 * 
	 * @param {BrowserWindow} mainWindow - main window from the app
	 * @param {Function} testFn - our testURL function from WindowTests.js
	 */
	constructor(mainWindow, testFn) {

		// save our refs
		this.mainWindow = mainWindow;
		this.testFn = testFn;

		// we'll store the unique chat sources in this map, via the youtube ID
		this.chatSources = new Map();

		// when the app starts, we need to load the saved chat sources from last time we ran
		this.restoreSources();

		// set up communication with the renderer process
		this.setupIPC();
	}

	/**
	 * Restores the chat sources from the store
	 */
	restoreSources() {

		// get the stored list of chatSources from our store & initialize a new ChatSource for each
		const savedIDs = store.get('chatSources', []);
		for (const id of savedIDs)
			this.chatSources.set(id, new ChatSource(id, this, this.testFn, false));	
	}


	/**
	 * Saves the chat sources to the store
	 */
	saveSources() {

		// our map uses the youtube_id as keys, so we can simply get the keys and save that array
		store.set('chatSources', [...this.chatSources.keys()]);
	}


	/**
	 * Adds a new YouTube chat source
	 * @param {String} youtube_id - youtube video id
	 * @returns {Boolean} - true if the chat source was added, false if it already exists
	 */
	addChatSource(youtube_id) {

		// GTFO if we already have this one
		if (this.chatSources.has(youtube_id))
			return false;

		// make a new chat source and add it to our map
		const chatSource = new ChatSource(youtube_id, this, this.testFn, true);
		this.chatSources.set(youtube_id, chatSource);

		// update our store
		this.saveSources();
		this.notifyRenderer();
		return true;
	}


	/**
	 * Removes a chat source from the manager
	 * 
	 * @param {String} youtube_id - the youtube id of the chat source to remove
	 * @returns {Boolean} - true if the chat source was removed, false if it didn't exist
	 */
	removeChatSource(youtube_id) {

		// GTFO if we don't have this one
		const chat = this.chatSources.get(youtube_id);
		if (!chat)
			return false;

		// destroy the chat source, which closes the window and cleans up
		chat.disable();

		// remove & update our store
		this.chatSources.delete(youtube_id);
		this.saveSources();
		this.notifyRenderer();
		return true;
	}


	/**
	 * Enables one of our chat sources via ID
	 * 
	 * @param {String} youtube_id - the youtube id of the chat source to enable
	 */
	enableChatSource(youtube_id) {
		const chat = this.chatSources.get(youtube_id);
		if (chat) chat.enable();
	}


	/**
	 * Disables one of our chat sources via ID
	 * 
	 * @param {String} youtube_id - the youtube id of the chat source to disable
	 */
	disableChatSource(youtube_id) {
		const chat = this.chatSources.get(youtube_id);
		if (chat) chat.disable();
	}


	/**
	 * Generates a JSON object with all the chat sources
	 * 
	 * @returns {Array} - an array of all the chat sources, serialized to JSON
	 */
	getSerializedChatSources() {
		return [...this.chatSources.values()].map(cs => cs.toJSON());
	}


	/**
	 * Destroys all the chat sources and their windows
	 * 
	 * (Call this when the app is closing)
	 */
	destroyAll() {

		for (const source of this.chatSources.values())
			source.destroy();
	}


	/**
	 * Shows the chat window for a specific chat source
	 * 
	 * @param {String} youtube_id - the youtube id of the chat source to show
	 */
	showChatWindow(youtube_id){

		// GTFO if we don't have this one
		const chat = this.chatSources.get(youtube_id);
		if (!chat)
			return false;

		// show the window
		if (chat.window) {
			chat.window.show();
			chat.window.focus();
		}
	}


	/**
	 * Tell the main window with our FE Renderer about the status of our ChatSources
	 */
	notifyRenderer() {

		// make sure main window & it's webContents are valid / ready
		if (this.mainWindow && this.mainWindow.webContents)

			// send the updated chat sources to the renderer
			this.mainWindow.webContents.send('chat-source-updated', this.getSerializedChatSources());
	}

	
	/**
	 * Set up a bunch of things we can invoke via the FE/preload
	 */
	setupIPC() {
		ipcMain.handle('CSM-add-chat', async (e, youtube_id) => this.addChatSource(youtube_id));
		ipcMain.handle('CSM-remove-chat', async (e, youtube_id) => this.removeChatSource(youtube_id));
		ipcMain.handle('CSM-enable-chat', async (e, youtube_id) => this.enableChatSource(youtube_id));
		ipcMain.handle('CSM-disable-chat', async (e, youtube_id) => this.disableChatSource(youtube_id));
		ipcMain.handle('CSM-get-chats', async () => this.getSerializedChatSources());
		ipcMain.handle('CSM-show-chat', (e, youtube_id) => this.showChatWindow(youtube_id));
	}
}


// export stuffs
module.exports = ChatSourceManager;
