/*
	TwitchAuthWindow.js
	-------------------

	This file defines a factory function to create the Twitch OAuth modal window.
	It is used by TwitchManager when the user clicks "Login with Twitch".

	The window:
	- Opens as a modal child of the main window (if provided)
	- Uses Electron security best practices (no node integration, isolated context)
	- Loads the Twitch OAuth URL provided by TwitchManager
	- Closes automatically when the auth flow finishes (the redirect hits localhost)
*/

// Electron imports
import { BrowserWindow } from 'electron';
import path from 'path';

/**
 * Create the Twitch OAuth modal window.
 * 
 * @param {BrowserWindow} parentWindow - The main Electron window to act as parent.
 * @param {Object} [options] - Optional configuration.
 * @param {boolean} [options.modal=true] - Whether to show as a modal.
 * @returns {BrowserWindow} A configured (but not yet destroyed) BrowserWindow.
 */
export function createTwitchAuthWindow(parentWindow, options = {}) {

	const modal = options.modal !== false; // defaults to true

	// Create a new BrowserWindow with secure defaults
	const win = new BrowserWindow({
		width: 520,
		height: 680,
		parent: parentWindow || null,
		modal: modal,
		show: false,
		resizable: true,
		minimizable: false,
		maximizable: false,
		autoHideMenuBar: true,
		title: 'Twitch Login',
		backgroundColor: '#1e1e1e',
		webPreferences: {
			nodeIntegration: false,			// never needed for OAuth
			contextIsolation: true,			// isolate from Electron internals
			sandbox: true,					// restrict renderer privileges
			devTools: true,					// allow devtools during development
		}
	});

	// Optional: show loading text while Twitch loads
	win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(`
		<!DOCTYPE html>
		<html>
		<head>
			<meta charset="utf-8">
			<title>Connecting to Twitch...</title>
			<style>
				body {
					font-family: system-ui, sans-serif;
					background: #18181b;
					color: #fafafa;
					display: flex;
					align-items: center;
					justify-content: center;
					height: 100vh;
					margin: 0;
				}
			</style>
		</head>
		<body>
			<div>Connecting to Twitch...</div>
		</body>
		</html>
	`));

	// Once ready to show, reveal the window
	win.once('ready-to-show', () => {
		win.show();
	});

	// Safety: if user manually closes window, just log and continue
	win.on('closed', () => {
		console.log('[TwitchAutoWindow] Closed by user.');
	});

	return win;
}
