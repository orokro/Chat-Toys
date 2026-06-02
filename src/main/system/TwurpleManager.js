/*
	TwurpleManager.js
	-----------------

	The new Twitch integration manager, built on Twurple.

	Lives side-by-side with the legacy `TwitchManager` (TMI + implicit
	grant) during the migration. Uses its own:
	  - electron-store key:  'twurple'   (legacy uses 'twitch')
	  - IPC channel prefix:  'twurple-*'  (legacy uses 'twitch-*')
	  - express callback:    '/auth/twurple/callback'
	  - Twitch app:          "Chat Toys v2" (Confidential client; legacy is Public)

	Scope of THIS file (Phase 1 Task #6): the OAuth code-grant flow only.
	  - Build the Twitch authorize URL with response_type=code + state
	  - Open the popup, intercept the callback
	  - Exchange the code for {access_token, refresh_token, scope, expires_in}
	  - Resolve the user via Helix /users
	  - Persist to electron-store under 'twurple'
	  - IPC handlers + status broadcast to renderer

	Out of scope (covered by later tasks):
	  - RefreshingAuthProvider wiring             - Task #7
	  - ChatClient (Twurple chat)                  - Task #9
	  - EventSubWsListener                          - Task #11
	  - TwitchEvents bus                            - Task #12
*/

import { BrowserWindow, ipcMain } from 'electron';
const Store = require('electron-store');
const store = new Store();
import { createTwitchAuthWindow } from '../windows/TwitchAuthWindow.js';
import express from 'express';
import crypto from 'crypto';

// Twurple - handles refresh + Helix API on top of our stored tokens.
import { RefreshingAuthProvider } from '@twurple/auth';
import { ApiClient } from '@twurple/api';
import { EventSubWsListener } from '@twurple/eventsub-ws';

// Chat reader is its own class so we can mount/dismount it cleanly on
// login / logout. Same pattern the legacy TwitchManager uses with
// TwitchChatReader.
const TwurpleChatReader = require('./TwurpleChatReader.js');

// Pull the new app's credentials from the gitignored secrets file. See
// src/main/secrets.example.js for the template / rationale.
const { TWURPLE_CLIENT_ID, TWURPLE_CLIENT_SECRET } = require('../secrets.js');

// Universal fetch shim - main process is Node, modern Node has it natively
// but some older Electron-bundled Node versions need a fallback.
let _fetch = globalThis.fetch;
if (typeof _fetch !== 'function') {
	try {
		_fetch = require('node-fetch');
	} catch {
		throw new Error('Fetch API not available and node-fetch not installed.');
	}
}

/**
 * The scopes the TwurpleManager requests on auth. Mirrors the comment
 * block in secrets.js. Order doesn't matter to Twitch, but kept stable
 * here so the consent screen always lists them the same way.
 *
 * @type {string[]}
 */
const TWURPLE_SCOPES = [
	'chat:read',
	'chat:edit',
	'channel:read:redemptions',
	'channel:manage:redemptions',
	'bits:read',
	'channel:read:subscriptions',
	'moderator:read:followers',
];

/**
 * @typedef {Object} TwurpleCreds
 * @property {string} accessToken
 * @property {string} refreshToken
 * @property {string[]} scopes
 * @property {{id:string, login:string, display_name:string}} user
 * @property {number} obtainedAt - ms epoch when this token batch was issued
 * @property {number} expiresIn  - lifetime in seconds (typically ~14400 for code-grant)
 */

/**
 * TwurpleManager handles the new Twurple-based Twitch integration:
 * code-grant OAuth, refreshable tokens, and (later) chat + EventSub.
 */
class TwurpleManager {

	/**
	 * @param {BrowserWindow} mainWindow - the app's main window for IPC
	 * @param {Object} obsViewServer - the OBSViewServer instance, so we can hook into its express app
	 */
	constructor(mainWindow, obsViewServer) {

		this.mainWindow = mainWindow;
		this.obsViewServer = obsViewServer;

		/** @type {string} */
		this.clientId = TWURPLE_CLIENT_ID;

		/** @type {string} */
		this.clientSecret = TWURPLE_CLIENT_SECRET;

		/** @type {string[]} */
		this.scopes = TWURPLE_SCOPES;

		/** @type {BrowserWindow|null} */
		this._authWindow = null;

		/** @type {boolean} */
		this._routesAttached = false;

		/**
		 * Random nonce sent with the auth request and verified on the
		 * callback. Prevents CSRF / a malicious tab from completing an
		 * auth flow we didn't start.
		 *
		 * @type {string|null}
		 */
		this._pendingState = null;

		/**
		 * Twurple auth provider - handles silent token refresh. Built
		 * lazily once we have stored credentials. After app restart it
		 * gets rebuilt from electron-store; after a fresh OAuth login it
		 * gets rebuilt from the newly-issued tokens.
		 *
		 * @type {RefreshingAuthProvider|null}
		 */
		this.authProvider = null;

		/**
		 * Twurple Helix API client. Built alongside `authProvider`.
		 * Exposed for downstream consumers (TwitchRedeems toy in Phase 3
		 * uses it for subscriber lookup + refund calls).
		 *
		 * @type {ApiClient|null}
		 */
		this.apiClient = null;

		/**
		 * The Twitch userId that the auth provider is currently bound to.
		 * Cached so we don't have to dig it out of the auth provider on
		 * every call. Null until init succeeds.
		 *
		 * @type {string|null}
		 */
		this.userId = null;

		/**
		 * In-memory subscriber-status cache for member-only enforcement on
		 * redeem-triggered commands (Task #16). EventSub redemption events
		 * don't carry subscriber status, so we look it up via Helix on
		 * demand and cache the result with a short TTL.
		 *
		 * Deliberately ephemeral: a Map, not SQLite/electron-store. Stale
		 * "is subscribed" data is worse than no data, so it never persists
		 * across restarts. Entries auto-expire after TTL; rapid-fire redeems
		 * from the same user hit the cache instead of thrashing Helix.
		 *
		 * @type {Map<string, {isSubbed:boolean, expiresAt:number}>}
		 */
		this._subscriberCache = new Map();

		/**
		 * The Twurple-backed chat reader. Replaces the legacy TMI reader
		 * once this manager is connected.
		 *
		 * @type {TwurpleChatReader|null}
		 */
		this.chatReader = null;

		/**
		 * Twurple EventSub WebSocket listener. Subscribes to channel
		 * events (redemptions, cheers, subs, follows, raids) over a single
		 * outbound WebSocket - no public callback URL needed. Started
		 * alongside the chat reader; stopped on logout.
		 *
		 * @type {EventSubWsListener|null}
		 */
		this.eventSubListener = null;

		/**
		 * Unsubscribe functions for the per-event handlers we register on
		 * the EventSubWsListener. Called in stopEventSub() to detach
		 * cleanly before stopping the listener.
		 *
		 * @type {Function[]}
		 */
		this._eventSubUnsubs = [];

		console.log('[TwurpleManager] initializing');

		this._registerIPC();
		this._attachToOBSViewServer(obsViewServer);

		// If we already have stored creds from a previous session, rehydrate
		// the auth provider now so chat / EventSub / Helix can come up
		// immediately on boot without waiting for the user to re-auth.
		const existing = this._getCreds();
		if (existing?.accessToken && existing?.refreshToken) {
			console.log('[TwurpleManager] Found existing creds, rehydrating clients...');
			this._initTwurpleClients(existing).catch((err) => {
				console.error('[TwurpleManager] Failed to rehydrate Twurple clients:', err);
				// We deliberately do NOT wipe the store here; the user may
				// just be offline. A failed call later will surface the
				// real issue (e.g. invalid refresh token => re-auth).
			});
		}
	}


	/* ====================================================================== */
	/*                          Server / Route Wiring                         */
	/* ====================================================================== */


	/**
	 * Hooks our routes into the shared OBSViewServer express app via the
	 * same setup-hook pattern TwitchManager uses. The server calls
	 * setupTwurple(expressApp) before listening.
	 *
	 * @param {Object} obsViewServer
	 */
	_attachToOBSViewServer(obsViewServer) {

		if (!obsViewServer) {
			console.warn('[TwurpleManager] OBSViewServer missing; cannot attach setup hook.');
			return;
		}

		obsViewServer.setupTwurple = (expressApp) => {
			if (this._routesAttached) return;
			this._attachRoutes(expressApp);
			this._routesAttached = true;
			console.log('[TwurpleManager] ✅ Twurple routes attached via OBSViewServer setup hook.');
		};
	}


	/**
	 * Registers the OAuth callback route on the shared express app.
	 *
	 * @param {import('express').Express} expressApp
	 */
	_attachRoutes(expressApp) {

		if (!expressApp || typeof expressApp.use !== 'function') {
			console.warn('[TwurpleManager] Invalid expressApp passed to _attachRoutes.');
			return;
		}

		// Single GET endpoint - unlike the implicit flow (which had to
		// serve HTML + JS to extract the token from the URL hash), code
		// grant gets the code as a query param directly on the server.
		expressApp.get('/auth/twurple/callback', (req, res) => {
			this._handleCallback(req, res);
		});
	}


	/* ====================================================================== */
	/*                              OAuth Flow                                */
	/* ====================================================================== */


	/**
	 * Start the OAuth code-grant flow: open the popup pointed at Twitch's
	 * authorize endpoint with response_type=code. Twitch will redirect
	 * back to our /auth/twurple/callback with a `code` query param.
	 */
	beginLogin() {

		if (!this.clientId || !this.clientSecret) {
			throw new Error('TwurpleManager: client ID / secret not configured. See src/main/secrets.example.js.');
		}

		const port = store.get('port', 3001);
		const redirectUri = `http://localhost:${port}/auth/twurple/callback`;

		// CSRF nonce - we'll verify this matches in the callback before
		// trusting the code we receive. Twitch echoes ?state back to us.
		this._pendingState = crypto.randomBytes(16).toString('hex');

		const scopeParam = encodeURIComponent(this.scopes.join(' '));
		const authUrl =
			`https://id.twitch.tv/oauth2/authorize` +
			`?client_id=${encodeURIComponent(this.clientId)}` +
			`&redirect_uri=${encodeURIComponent(redirectUri)}` +
			`&response_type=code` +
			`&scope=${scopeParam}` +
			`&state=${encodeURIComponent(this._pendingState)}` +
			`&force_verify=true`;

		this._ensureAuthWindow();
		this._authWindow.loadURL(authUrl);
		this._authWindow.show();
	}


	/**
	 * Handle the GET /auth/twurple/callback request. Twitch sends one of:
	 *   ?code=<code>&scope=<scopes>&state=<state>
	 *   ?error=<error>&error_description=<msg>&state=<state>
	 *
	 * On success, we exchange the code at /oauth2/token and persist the
	 * resulting tokens.
	 *
	 * @param {import('express').Request} req
	 * @param {import('express').Response} res
	 */
	async _handleCallback(req, res) {

		console.log('[TwurpleManager] /auth/twurple/callback hit');

		const { code, state, error, error_description } = req.query;

		// Error path - the user denied consent, or Twitch barfed
		if (error) {
			console.warn('[TwurpleManager] OAuth error:', error, error_description);
			this._serveCallbackHTML(res, false, String(error_description || error));
			this._closeAuthWindow();
			return;
		}

		// CSRF check - state must match what we sent
		if (!this._pendingState || state !== this._pendingState) {
			console.warn('[TwurpleManager] state mismatch on callback; rejecting.');
			this._serveCallbackHTML(res, false, 'State mismatch (possible CSRF). Try again.');
			this._closeAuthWindow();
			return;
		}
		this._pendingState = null;

		if (!code) {
			this._serveCallbackHTML(res, false, 'Missing authorization code in callback.');
			this._closeAuthWindow();
			return;
		}

		// Exchange the authorization code for tokens. We do this server-
		// side from the Electron main process, which is fine because the
		// client_secret never leaves the user's machine.
		try {
			const tokens = await this._exchangeCodeForTokens(String(code));
			const user = await this._fetchUser(tokens.access_token);

			/** @type {TwurpleCreds} */
			const creds = {
				accessToken: tokens.access_token,
				refreshToken: tokens.refresh_token,
				scopes: Array.isArray(tokens.scope) ? tokens.scope : (tokens.scope || '').split(' '),
				user: user ? { id: user.id, login: user.login, display_name: user.display_name } : null,
				obtainedAt: Date.now(),
				expiresIn: tokens.expires_in,
			};
			store.set('twurple', creds);

			console.log('[TwurpleManager] Saved Twurple credentials for', user?.login);

			// Stand up the Twurple auth provider + Helix client right away
			// so downstream consumers (chat, EventSub, redeems toy) can
			// pick them up without waiting for the next app restart.
			try {
				await this._initTwurpleClients(creds);
			} catch (initErr) {
				console.error('[TwurpleManager] Post-login client init failed:', initErr);
				// Auth itself succeeded - tokens are stored. Surface the
				// init failure but don't roll back the login; user can
				// retry without re-OAuthing.
			}

			this._notifyRenderer(`✅ Twurple connected as @${user?.display_name}`);
			this._sendStatusToRenderer();

			this._serveCallbackHTML(res, true);
			this._closeAuthWindow();

		} catch (e) {
			console.error('[TwurpleManager] Token exchange failed:', e);
			this._serveCallbackHTML(res, false, e.message || 'Token exchange failed.');
			this._closeAuthWindow();
		}
	}


	/**
	 * POST to Twitch's token endpoint to trade an authorization code for
	 * access + refresh tokens. This is the step that requires the
	 * client_secret and cannot be done from a Public client.
	 *
	 * @param {string} code - the one-time authorization code from the callback
	 * @returns {Promise<{access_token:string, refresh_token:string, expires_in:number, scope:string[]|string, token_type:string}>}
	 */
	async _exchangeCodeForTokens(code) {

		const port = store.get('port', 3001);
		const redirectUri = `http://localhost:${port}/auth/twurple/callback`;

		const body = new URLSearchParams({
			client_id: this.clientId,
			client_secret: this.clientSecret,
			code,
			grant_type: 'authorization_code',
			redirect_uri: redirectUri,
		});

		const r = await _fetch('https://id.twitch.tv/oauth2/token', {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: body.toString(),
		});

		const j = await r.json();
		if (!r.ok)
			throw new Error(`Twitch token exchange failed (${r.status}): ${JSON.stringify(j)}`);

		return j;
	}


	/**
	 * Renders the in-popup confirmation HTML. The popup closes itself
	 * shortly after, but this gives the user a visual breadcrumb.
	 *
	 * @param {import('express').Response} res
	 * @param {boolean} ok
	 * @param {string} [errorMessage]
	 */
	_serveCallbackHTML(res, ok, errorMessage = '') {

		const html = ok
			? `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Twitch Auth</title>
<style>body{font-family:system-ui,sans-serif;text-align:center;margin-top:10%;color:white;background:#18181b;}</style>
</head><body><h2>✅ Twitch authorization complete</h2><p>You can close this window now.</p></body></html>`
			: `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Twitch Auth Error</title>
<style>body{font-family:system-ui,sans-serif;text-align:center;margin-top:10%;color:white;background:#18181b;}</style>
</head><body><h2>⚠️ Twitch authorization failed</h2><p>${escapeHtml(errorMessage)}</p></body></html>`;

		res.writeHead(ok ? 200 : 400, { 'Content-Type': 'text/html; charset=utf-8' });
		res.end(html);
	}


	/* ====================================================================== */
	/*                            Auth Lifecycle                              */
	/* ====================================================================== */


	/**
	 * Build (or rebuild) the Twurple auth provider + api client from a
	 * set of credentials. Idempotent - safe to call after every login or
	 * on app boot.
	 *
	 * The auth provider hooks an onRefresh callback that persists the new
	 * token batch back to electron-store whenever Twurple silently
	 * refreshes (which is every ~4 hours by default for code-grant). That
	 * way the next app start picks up the freshest tokens, not stale ones
	 * that would force a re-auth.
	 *
	 * @param {TwurpleCreds} creds - the credentials to seed the auth provider with
	 * @returns {Promise<void>}
	 */
	async _initTwurpleClients(creds) {

		if (!creds?.accessToken || !creds?.refreshToken) {
			throw new Error('Cannot init Twurple clients without access+refresh tokens.');
		}

		// Fresh provider on each call. Cheap to build; avoids carrying
		// stale internal state across logout / re-login.
		this.authProvider = new RefreshingAuthProvider({
			clientId: this.clientId,
			clientSecret: this.clientSecret,
		});

		// onRefresh fires whenever Twurple silently rotates the access
		// token (every ~4 hours). Persist the new batch so we restart
		// with fresh tokens next boot. The refreshToken itself can also
		// rotate in this callback - Twitch may issue a new one.
		this.authProvider.onRefresh((userId, newTokenData) => {
			try {
				const existing = this._getCreds() || {};
				const updated = {
					...existing,
					accessToken: newTokenData.accessToken,
					refreshToken: newTokenData.refreshToken,
					expiresIn: newTokenData.expiresIn,
					obtainedAt: newTokenData.obtainmentTimestamp ?? Date.now(),
					scopes: newTokenData.scope || existing.scopes || [],
				};
				store.set('twurple', updated);
				console.log('[TwurpleManager] 🔄 Token refreshed for user', userId);
			} catch (e) {
				console.error('[TwurpleManager] onRefresh persist failed:', e);
			}
		});

		// Hand the auth provider the current token batch. Returns the
		// userId Twurple resolved from the token. Intents are ceremonial
		// for a single-user app but we tag with both 'chat' and 'eventsub'
		// so the later ChatClient + EventSubWsListener pick this token up.
		this.userId = await this.authProvider.addUserForToken(
			{
				accessToken: creds.accessToken,
				refreshToken: creds.refreshToken,
				expiresIn: creds.expiresIn ?? 0,
				obtainmentTimestamp: creds.obtainedAt ?? 0,
				scope: Array.isArray(creds.scopes) ? creds.scopes : [],
			},
			['chat', 'eventsub'],
		);

		this.apiClient = new ApiClient({ authProvider: this.authProvider });

		console.log('[TwurpleManager] ✅ Twurple clients ready for userId', this.userId);

		// Bring up the chat reader against the broadcaster's own channel.
		// During the migration window this runs ALONGSIDE the legacy
		// TMI reader - any duplicate messages downstream are expected and
		// are the test signal for Task #10. After cutover (Phase 4), the
		// legacy reader is disabled and only this one feeds chat.
		await this._startChatReader(creds);

		// Bring up EventSub for non-chat events (redeems, etc). Separate
		// from chat so a failure in one doesn't take the other down.
		await this._startEventSub();
	}


	/**
	 * Stand up the EventSubWsListener and subscribe to the events we
	 * care about. Phase 2 wires redemption; future phases (5+) add
	 * cheers / subs / follows / raids on top of the same listener.
	 *
	 * @returns {Promise<void>}
	 */
	async _startEventSub() {

		if (!this.apiClient || !this.userId) {
			console.warn('[TwurpleManager] Cannot start EventSub - apiClient or userId missing.');
			return;
		}

		// Tear down any prior listener first.
		await this._stopEventSub();

		console.log('[TwurpleManager] Starting EventSub WebSocket listener...');

		this.eventSubListener = new EventSubWsListener({ apiClient: this.apiClient });

		// Lifecycle observability. These methods exist on the listener in
		// Twurple 7.x and fire as the underlying WebSocket comes up,
		// reconnects, or fails. Useful breadcrumbs when debugging "why
		// did redeems stop firing mid-stream?" reports later.
		try {
			this.eventSubListener.onUserSocketConnect?.((userId) => {
				console.log('[TwurpleManager] EventSub socket connected for', userId);
			});
			this.eventSubListener.onUserSocketDisconnect?.((userId, err) => {
				console.warn('[TwurpleManager] EventSub socket disconnected for', userId, err || '');
			});
		} catch (e) {
			// Lifecycle hooks aren't strictly required; if Twurple ever
			// renames them between versions, don't take the listener down.
			console.warn('[TwurpleManager] Could not bind EventSub lifecycle hooks:', e?.message);
		}

		// Channel point redemption (the headline event for Phase 3).
		// Forward to renderer with our normalized shape so the future
		// TwitchEvents bus can dispatch to subscribing toys.
		try {
			const unsub = this.eventSubListener.onChannelRedemptionAdd(this.userId, (event) => {
				this._forwardTwurpleEvent('redemption', {
					id: event.id,
					userId: event.userId,
					userName: event.userName,
					userDisplayName: event.userDisplayName,
					rewardId: event.rewardId,
					rewardTitle: event.rewardTitle,
					rewardCost: event.rewardCost,
					rewardPrompt: event.rewardPrompt,
					input: event.input,
					status: event.status,
					redemptionDate: event.redemptionDate?.toISOString?.() || null,
					broadcasterId: this.userId,
				});
			});
			// Twurple's subscribe methods return a handle with .stop();
			// we store a small unsubscribe closure for uniform teardown.
			if (unsub && typeof unsub.stop === 'function') {
				this._eventSubUnsubs.push(() => unsub.stop());
			}
		} catch (e) {
			console.error('[TwurpleManager] Failed to subscribe to redemption events:', e);
		}

		// Start the listener (opens the outbound WebSocket).
		try {
			this.eventSubListener.start();
			console.log('[TwurpleManager] ✅ EventSub listener started.');
		} catch (e) {
			console.error('[TwurpleManager] EventSub start() failed:', e);
		}
	}


	/**
	 * Stop the EventSub listener and detach handlers. Idempotent.
	 *
	 * @returns {Promise<void>}
	 */
	async _stopEventSub() {

		// Detach all our per-event handlers first.
		for (const unsub of this._eventSubUnsubs) {
			try { unsub(); } catch { /* swallow */ }
		}
		this._eventSubUnsubs = [];

		if (this.eventSubListener) {
			try {
				this.eventSubListener.stop();
				console.log('[TwurpleManager] EventSub listener stopped.');
			} catch (e) {
				console.warn('[TwurpleManager] EventSub stop() warning:', e?.message);
			}
			this.eventSubListener = null;
		}
	}


	/**
	 * Forward a Twurple event up to the renderer over IPC. The
	 * renderer-side TwitchEvents bus (Phase 2 Task #12) listens on
	 * `twurple-event` and dispatches to subscribing toys by `type`.
	 *
	 * @param {string} type - 'redemption' (Phase 3), 'cheer'/'subscribe'/etc (future)
	 * @param {object} payload - normalized event data
	 */
	_forwardTwurpleEvent(type, payload) {

		if (!this.mainWindow?.webContents) return;

		try {
			this.mainWindow.webContents.send('twurple-event', { type, payload });
			console.log('[TwurpleManager] 📡 twurple-event', type, payload?.rewardTitle || payload?.userName || '');
		} catch (e) {
			console.error('[TwurpleManager] Failed to forward twurple-event:', e);
		}
	}


	/**
	 * Spin up a fresh TwurpleChatReader and join the broadcaster's
	 * channel. Tears down any prior reader first so back-to-back logins
	 * don't leak websockets.
	 *
	 * @param {TwurpleCreds} creds
	 * @returns {Promise<void>}
	 */
	async _startChatReader(creds) {

		if (this.chatReader) {
			try { await this.chatReader.disconnect(); } catch { /* swallow */ }
			this.chatReader = null;
		}

		const channelLogin = creds?.user?.login;
		if (!channelLogin) {
			console.warn('[TwurpleManager] Cannot start chat reader - no user.login in creds.');
			return;
		}

		this.chatReader = new TwurpleChatReader(
			this.mainWindow,
			this.authProvider,
			channelLogin,
			this.userId,
		);
		await this.chatReader.connect();
	}


	/**
	 * Disconnect: clear credentials and tear down Twurple clients.
	 */
	async logout() {

		// Stop the chat reader BEFORE clearing creds - quitting the
		// ChatClient cleanly avoids a "websocket auth failure" log spam
		// if Twurple tries to reconnect after we wipe the auth provider.
		if (this.chatReader) {
			try { await this.chatReader.disconnect(); } catch { /* swallow */ }
			this.chatReader = null;
		}

		// Stop EventSub for the same reason.
		await this._stopEventSub();

		store.delete('twurple');
		this.authProvider = null;
		this.apiClient = null;
		this.userId = null;
		this._sendStatusToRenderer();
		console.log('[TwurpleManager] Logged out (credentials cleared).');
	}


	/**
	 * Read the current auth/user status from the store. Used by the
	 * renderer's settings page to show "Connected as @foo" or similar.
	 *
	 * @returns {{authed:boolean, user?:object, scopes?:string[]}}
	 */
	getStatus() {

		const creds = this._getCreds();
		if (!creds?.accessToken || !creds?.user)
			return { authed: false };
		return { authed: true, user: creds.user, scopes: creds.scopes || [] };
	}


	/* ====================================================================== */
	/*                                Helix                                   */
	/* ====================================================================== */


	/**
	 * Fetch the authenticated user's profile from Helix.
	 *
	 * @param {string} accessToken
	 * @returns {Promise<{id:string, login:string, display_name:string}|null>}
	 */
	async _fetchUser(accessToken) {

		if (!this.clientId) throw new Error('Client ID not set.');

		const r = await _fetch('https://api.twitch.tv/helix/users', {
			headers: {
				Authorization: `Bearer ${accessToken}`,
				'Client-Id': this.clientId,
			},
		});

		if (!r.ok) {
			console.warn('[TwurpleManager] /helix/users non-OK:', r.status);
			return null;
		}

		const j = await r.json();
		return j.data?.[0] || null;
	}


	/* ====================================================================== */
	/*                          Window / Renderer                             */
	/* ====================================================================== */


	/**
	 * Make sure we have an auth popup ready. Reuses the existing
	 * TwitchAuthWindow factory - the popup is generic, just a Twitch-
	 * styled BrowserWindow that loads whatever URL we give it.
	 *
	 * @returns {BrowserWindow}
	 */
	_ensureAuthWindow() {

		if (this._authWindow && !this._authWindow.isDestroyed()) return this._authWindow;

		this._authWindow = createTwitchAuthWindow(this.mainWindow, { modal: true });
		this._authWindow.on('closed', () => (this._authWindow = null));
		return this._authWindow;
	}


	/**
	 * Close the auth popup if it's still open. Called from the callback
	 * handler once we've persisted (or rejected) the auth.
	 */
	_closeAuthWindow() {

		if (this._authWindow && !this._authWindow.isDestroyed())
			this._authWindow.close();
	}


	/**
	 * Send a transient notification message to the renderer (toast-style
	 * "Twurple connected" line).
	 *
	 * @param {string} msg
	 */
	_notifyRenderer(msg) {

		if (!this.mainWindow || this.mainWindow.isDestroyed()) return;
		this.mainWindow.webContents.send('twurple-update', { message: msg });
	}


	/**
	 * Send the latest auth status to the renderer so the new
	 * Connection Settings sub-tab can re-render its banner.
	 */
	_sendStatusToRenderer() {

		const creds = store.get('twurple');
		const status = {
			authed: !!(creds && creds.accessToken),
			user: creds?.user || null,
			scopes: creds?.scopes || [],
		};

		if (!this.mainWindow || this.mainWindow.isDestroyed()) return;
		this.mainWindow.webContents.send('twurple-update', { status });
		console.log('[TwurpleManager] Sent twurple-update to renderer:', status);
	}


	/**
	 * Helper for reading creds from the store.
	 *
	 * @returns {TwurpleCreds|null}
	 */
	_getCreds() {
		return store.get('twurple', null);
	}


	/* ====================================================================== */
	/*                                 Helix                                  */
	/* ====================================================================== */


	/**
	 * Time-to-live for cached subscriber-status lookups, in milliseconds.
	 * Five minutes: long enough to absorb rapid-fire redeems, short enough
	 * that a viewer who just subscribed isn't gated for a meaningful window.
	 *
	 * @type {number}
	 */
	static SUBSCRIBER_TTL_MS = 5 * 60 * 1000;


	/**
	 * Resolve whether a Twitch user is a subscriber of the connected
	 * broadcaster, used for member-only enforcement on redeem-triggered
	 * commands (Task #16). Reads from a 5-minute in-memory TTL cache first,
	 * falling back to a Helix `checkUserSubscription` call on a miss.
	 *
	 * Fails closed: any error (not connected, missing scope, network, or
	 * the user simply not being a subscriber) resolves to `false`. For a
	 * member-only gate, denying on uncertainty is the safe default - the
	 * worst case is a sub being asked to redeem again, never a non-sub
	 * sneaking past the gate.
	 *
	 * @param {string} userId - the redeemer's Twitch userId
	 * @returns {Promise<boolean>} true only if confirmed subscribed
	 */
	async isSubscriber(userId) {

		// No user id means nothing to look up - fail closed.
		if (!userId)
			return false;

		// Serve from cache while the entry is still fresh.
		const cached = this._subscriberCache.get(userId);
		if (cached && cached.expiresAt > Date.now())
			return cached.isSubbed;

		// Can't reach Helix without a live client + broadcaster id.
		if (!this.apiClient || !this.userId) {
			console.warn('[TwurpleManager] isSubscriber: no apiClient/userId; treating as non-subscriber.');
			return false;
		}

		let isSubbed = false;
		try {
			// Returns a UserSubscription object (truthy) when subscribed,
			// or null when the user isn't a subscriber of this channel.
			const sub = await this.apiClient.subscriptions.checkUserSubscription(this.userId, userId);
			isSubbed = sub != null;
		} catch (e) {
			// Scope/auth/network problems all land here. Keep the raw text
			// in the console for debugging but fail closed for the gate.
			console.warn('[TwurpleManager] isSubscriber lookup failed:', e?.message || String(e));
			isSubbed = false;
		}

		// Cache the result (including a confirmed "false") so we don't
		// re-hit Helix for every redeem in the TTL window.
		this._subscriberCache.set(userId, {
			isSubbed,
			expiresAt: Date.now() + TwurpleManager.SUBSCRIBER_TTL_MS,
		});

		return isSubbed;
	}


	/* ====================================================================== */
	/*                                 IPC                                    */
	/* ====================================================================== */


	/**
	 * Register the twurple-* IPC handlers. The renderer's new
	 * connection-settings sub-tab (Phase 1 Task #8) invokes these.
	 */
	_registerIPC() {

		console.log('[TwurpleManager] registering IPC handlers');

		ipcMain.handle('twurple-connect', async () => {
			try {
				this.beginLogin();
				return { ok: true };
			} catch (e) {
				return { ok: false, error: e.message };
			}
		});

		ipcMain.handle('twurple-disconnect', async () => {
			try {
				await this.logout();
				return { ok: true };
			} catch (e) {
				return { ok: false, error: e.message };
			}
		});

		ipcMain.handle('twurple-get-status', async () => {
			try {
				return this.getStatus();
			} catch (e) {
				return { ok: false, error: e.message };
			}
		});

		// Helix passthrough: fetch the broadcaster's custom channel point
		// rewards. Used by the TwitchRedeems toy's mapping UI to populate
		// the reward dropdown. Returns an empty list (with no error) when
		// the channel doesn't have Channel Points enabled, so the UI can
		// fall back to its manual-entry path cleanly.
		ipcMain.handle('twurple-get-custom-rewards', async () => {
			try {
				if (!this.apiClient || !this.userId)
					return { ok: false, error: 'Not connected via Twurple.', rewards: [] };

				const rewards = await this.apiClient.channelPoints.getCustomRewards(this.userId);
				return {
					ok: true,
					rewards: (rewards || []).map((r) => ({
						id: r.id,
						title: r.title,
						cost: r.cost,
						prompt: r.prompt,
						isEnabled: r.isEnabled,
						userInputRequired: r.userInputRequired,
					})),
				};
			} catch (e) {
				// Helix returns 403 "broadcaster must have partner or
				// affiliate status" for non-Affiliate channels. Don't
				// treat that as a hard error - the UI falls back to
				// manual entry. Translate the raw Twurple exception into
				// a human-readable message; keep the full text in console
				// logs for debugging.
				const raw = e?.message || String(e);
				console.warn('[TwurpleManager] getCustomRewards failed:', raw);

				let friendly = raw;
				if (/partner or affiliate/i.test(raw) || /403/.test(raw)) {
					friendly = 'Your channel does not have Channel Points enabled. Channel Points requires Twitch Affiliate or higher (or Monetization for All if rolled out to your account). You can still configure mappings manually below.';
				} else if (/401/.test(raw)) {
					friendly = 'Twitch rejected the request (auth issue). Try logging out and back in via the Twurple connection tab.';
				}
				return { ok: false, error: friendly, rewards: [] };
			}
		});

		// Helix passthrough: subscriber-status lookup for member-only
		// enforcement on redeem-triggered commands (Task #16). The
		// TwitchRedeems toy calls this before injecting a redeem when the
		// mapped command is member-only. Fails closed (isSubbed:false) on
		// any error - see TwurpleManager.isSubscriber.
		ipcMain.handle('twurple-is-subscriber', async (event, userId) => {
			try {
				const isSubbed = await this.isSubscriber(userId);
				return { ok: true, isSubbed };
			} catch (e) {
				// isSubscriber already swallows its own errors, so reaching
				// here is unexpected; still fail closed for the caller.
				return { ok: false, isSubbed: false, error: e?.message || String(e) };
			}
		});

		console.log('[TwurpleManager] IPC handlers registered');
	}

}


/* ====================================================================== */
/*                              Utilities                                 */
/* ====================================================================== */


/**
 * Minimal HTML-escape for error messages we render in the popup. Avoids
 * the "user sees <script> in the error message" footgun if Twitch ever
 * echoes something funky back as error_description.
 *
 * @param {string} s
 * @returns {string}
 */
function escapeHtml(s) {
	return String(s)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}


module.exports = { TwurpleManager };
