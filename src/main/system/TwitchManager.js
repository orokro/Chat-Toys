/*
	TwitchManager.js
	----------------

	Handles Twitch OAuth (implicit flow) and lightweight chat setup
	for each local user, entirely client-side within Electron.

	- Owns its own IPC channels.
	- Uses electron-store to persist auth tokens.
	- Spawns a modal OAuth window handled by TwitchAutoWindow.js.
	- Injects /auth/twitch/callback + /twitch/token endpoints into OBSViewServer.
	- Notifies renderer via 'twitch-update' channel.

	IPC Channels:
	--------------
	Main → Renderer:
		'twitch-update'		→ status changes or logs

	Renderer → Main:
		'twitch-connect'	→ begin Twitch OAuth flow
		'twitch-disconnect'	→ logout & clear credentials
		'twitch-get-status'	→ return current status
		'twitch-set-config'	→ set client ID & scopes
*/

import { BrowserWindow, ipcMain } from 'electron';
import { join } from 'path';
const Store = require('electron-store');
const store = new Store();
import { createTwitchAuthWindow } from '../windows/TwitchAuthWindow.js';
import express from 'express';
const TwitchChatReader = require('./TwitchChatReader.js');

let _fetch = globalThis.fetch;
if (typeof _fetch !== 'function') {
	try {
		_fetch = require('node-fetch');
	} catch {
		throw new Error('Fetch API not available and node-fetch not installed.');
	}
}


/**
 * @typedef {Object} TwitchCredentials
 * @property {string} accessToken
 * @property {string[]} scopes
 * @property {number} obtainedAt
 * @property {{id:string,login:string,display_name:string}} user
 */

class TwitchManager {

	/**
	 * @param {BrowserWindow} mainWindow - The primary app window.
	 * @param {Object} obsViewServer - The OBSViewServer instance (must expose .server).
	 */
	constructor(mainWindow, obsViewServer) {

		this.mainWindow = mainWindow;
		this.obsViewServer = obsViewServer;

		this.chatReader = new TwitchChatReader(mainWindow, obsViewServer);

		this.clientConfig = {
			clientId: null,
			scopes: ['chat:read', 'chat:edit']
		};

		this._authWindow = null;
		this._routesAttached = false;

		console.log('[TwitchManager] initializing');
		this._attachServerRoutes();
		this._registerIPC();
	}


	// ------------------------------------------------------------------------
	// Public API methods (used internally or via IPC)
	// ------------------------------------------------------------------------

	async setClientConfig(cfg) {
		if (cfg?.clientId) this.clientConfig.clientId = cfg.clientId;
		if (Array.isArray(cfg?.scopes)) this.clientConfig.scopes = cfg.scopes;
		const creds = this._getCreds();
		if (creds?.accessToken) await this._hydrateUser(creds.accessToken);
	}


	beginLogin() {
		
		if (!this.clientConfig.clientId)
			throw new Error('TwitchManager: clientId not set.');

		const port = store.get('port', 3001);
		const redirectUri = `http://localhost:${port}/auth/twitch/callback`;
		const scopeParam = encodeURIComponent(this.clientConfig.scopes.join(' '));
		const authUrl =
			`https://id.twitch.tv/oauth2/authorize` +
			`?client_id=${encodeURIComponent(this.clientConfig.clientId)}` +
			`&redirect_uri=${encodeURIComponent(redirectUri)}` +
			`&response_type=token` +
			`&scope=${scopeParam}` +
			`&force_verify=true`;

		this._ensureAuthWindow();
		this._authWindow.loadURL(authUrl);
		this._authWindow.show();
	}


	async logout() {

		store.delete('twitch');
		if (this.chatReader)
			await this.chatReader.disconnect();

		this._sendStatusToRenderer();
	}


	getStatus() {
		const creds = this._getCreds();
		if (!creds?.accessToken || !creds?.user)
			return { authed: false };
		return {
			authed: true,
			user: creds.user,
			scopes: creds.scopes || []
		};
	}


	// ------------------------------------------------------------------------
	// Internal HTTP route integration with OBSViewServer
	// ------------------------------------------------------------------------

	/**
	 * Attach Twitch OAuth routes to the OBSViewServer's Express app.
	 * This avoids double-handling requests by using Express middleware
	 * instead of the low-level server.on('request') listener.
	 */
	_attachServerRoutes() {
		if (this._routesAttached) return;

		const obsServer = this.obsViewServer;
		if (!obsServer) {
			console.warn('[TwitchManager] OBSViewServer not ready.');
			return;
		}

		// ✅ OBSViewServer internally creates `expressApp`
		// You can access it safely before listen()
		const expressApp = obsServer.server?._events?.request;
		if (!expressApp || typeof expressApp.use !== 'function') {
			console.warn('[TwitchManager] Could not locate Express app from OBSViewServer.');
			return;
		}

		// Add GET callback for Twitch redirect
		expressApp.get('/auth/twitch/callback', (req, res) => {
			this._serveCallbackHTML(res);
		});

		// Add POST callback for token reception
		expressApp.post('/twitch/token', express.json(), async (req, res) => {
			await this._handleTokenPost(req, res);
		});

		this._routesAttached = true;
		console.log('[TwitchManager] Attached Twitch OAuth routes.');
	}


	_isPath(urlStr, pathName) {
		try {
			const u = new URL(urlStr, 'http://localhost');
			return u.pathname === pathName;
		} catch {
			return (urlStr || '').split('?')[0] === pathName;
		}
	}


	_serveCallbackHTML(res) {
		const html = `
<!DOCTYPE html><html><head><meta charset="utf-8"><title>Twitch Auth</title>
<style>
	body{font-family:system-ui,sans-serif;text-align:center;margin-top:10%;color:white;}
</style></head><body>
	<h2>✅ Twitch authorization complete</h2>
	<p>You can close this window now.</p>
	<script>
	(function(){
		function get(name){var m=location.hash.match(new RegExp(name+'=([^&]+)'));return m?decodeURIComponent(m[1]):null;}
		var token=get('access_token');
		var scopes=(get('scope')||'').split('%20').map(decodeURIComponent);
		if(!token)return;
		fetch('/twitch/token',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({accessToken:token,scopes})});
	})();
	</script>
</body></html>`;
		res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
		res.end(html);
	}

	/**
 * Handles POST /twitch/token after OAuth redirect.
 * Saves the token, fetches user info, and notifies renderer.
 */
	async _handleTokenPost(req, res) {
		console.log('[TwitchManager] /twitch/token route hit');

		try {
			const body = req.body || {};
			const token = body.accessToken;
			const scopes = body.scopes || [];

			if (!token) {
				res.writeHead(400, { 'Content-Type': 'text/plain' });
				res.end('Missing token');
				return;
			}

			// ✅ Fetch the user data using Twitch Helix API
			const user = await this._fetchUser(token);
			if (!user) {
				console.warn('[TwitchManager] No user info returned from Twitch');
			}

			// ✅ Save credentials persistently
			const creds = {
				accessToken: token,
				scopes,
				user,
				obtainedAt: Date.now(),
			};
			store.set('twitch', creds);
			console.log('[TwitchManager] Saved Twitch credentials for', user?.login);

			if (this.chatReader)
				this.chatReader.restart();


			// ✅ Notify renderer of success
			this._notifyRenderer(`✅ Twitch connected as @${user?.display_name}`);
			this._sendStatusToRenderer();

			// ✅ Close the auth popup
			if (this._authWindow && !this._authWindow.isDestroyed()) {
				this._authWindow.close();
			}

			res.writeHead(200, { 'Content-Type': 'text/plain' });
			res.end('OK');
		} catch (e) {
			console.error('[TwitchManager] Token finalize error:', e);
			if (!res.headersSent) {
				res.writeHead(500, { 'Content-Type': 'text/plain' });
				res.end('Error saving token');
			}
		}
	}



	// ------------------------------------------------------------------------
	// Helpers
	// ------------------------------------------------------------------------

	_ensureAuthWindow() {
		if (this._authWindow && !this._authWindow.isDestroyed()) return this._authWindow;
		this._authWindow = createTwitchAuthWindow(this.mainWindow, { modal: true });
		this._authWindow.on('closed', () => (this._authWindow = null));
		return this._authWindow;
	}


	_notifyRenderer(msg) {
		if (!this.mainWindow || this.mainWindow.isDestroyed()) return;
		try {
			this.mainWindow.webContents.send('twitch-update', { message: msg });
		} catch { }
	}


	_sendStatusToRenderer() {
		try {
			const creds = store.get('twitch');
			const status = {
				authed: !!(creds && creds.accessToken),
				user: creds?.user || null,
				scopes: creds?.scopes || [],
			};
			this.mainWindow.webContents.send('twitch-update', { status });
			console.log('[TwitchManager] Sent twitch-update to renderer:', status);
		} catch (e) {
			console.error('[TwitchManager] Failed to send status:', e);
		}
	}


	_readJson(req) {
		return new Promise((resolve) => {
			let data = '';
			req.on('data', (c) => (data += c));
			req.on('end', () => {
				try {
					resolve(JSON.parse(data || '{}'));
				} catch {
					resolve(null);
				}
			});
			req.on('error', () => resolve(null));
		});
	}


	async _fetchUser(accessToken) {
		if (!this.clientConfig.clientId) throw new Error('Client ID not set.');
		const r = await _fetch('https://api.twitch.tv/helix/users', {
			headers: {
				Authorization: `Bearer ${accessToken}`,
				'Client-Id': this.clientConfig.clientId
			}
		});
		if (!r.ok) throw new Error(`Helix /users failed: ${r.status}`);
		const j = await r.json();
		if (!j?.data?.[0]) throw new Error('No user returned');
		return j.data[0];
	}


	async _hydrateUser(accessToken) {
		const u = await this._fetchUser(accessToken);
		const creds = this._getCreds() || {};
		creds.user = { id: u.id, login: u.login, display_name: u.display_name };
		store.set('twitch', creds);
		this._sendStatusToRenderer();
	}


	_getCreds() {
		return store.get('twitch', null);
	}


	// ------------------------------------------------------------------------
	// Internal IPC wiring (self-contained)
	// ------------------------------------------------------------------------

	_registerIPC() {

		console.log('[TwitchManager] registering IPC handlers');
		ipcMain.handle('twitch-connect', async () => {
			try {
				this.beginLogin();
				return { ok: true };
			} catch (e) {
				return { ok: false, error: e.message };
			}
		});

		ipcMain.handle('twitch-disconnect', async () => {
			try {
				this.logout();
				return { ok: true };
			} catch (e) {
				return { ok: false, error: e.message };
			}
		});

		ipcMain.handle('twitch-get-status', async () => {
			try {
				return this.getStatus();
			} catch (e) {
				return { ok: false, error: e.message };
			}
		});

		ipcMain.handle('twitch-set-config', async (event, cfg) => {
			try {
				await this.setClientConfig(cfg);
				return { ok: true };
			} catch (e) {
				return { ok: false, error: e.message };
			}
		});
		console.log('[TwitchManager] IPC handlers registered');
	}
}

module.exports = { TwitchManager };
