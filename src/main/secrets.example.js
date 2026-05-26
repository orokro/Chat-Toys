/*
	secrets.example.js
	------------------

	Template for src/main/secrets.js (which is gitignored).

	To set up your local dev environment:
	1. Copy this file to `secrets.js` in the same directory.
	2. Fill in the real values from your Twitch dev console
	   (https://dev.twitch.tv/console/apps).
	3. Never commit `secrets.js`.

	For production builds, the real `secrets.js` is bundled into the
	Electron asar package at build time. Since the asar is extractable, the
	secret is technically discoverable by a determined attacker - this is
	the standard tradeoff for desktop OAuth apps (Streamlabs, Firebot, etc.
	all do the same). The secret being public would let someone register
	auth popups under your app's name; it does NOT give them access to any
	user's data on its own.
*/

module.exports = {

	/**
	 * Legacy Twitch app (Public client type) used by the original
	 * TwitchManager + TMI flow. Implicit grant - no secret needed.
	 *
	 * @type {string}
	 */
	TWITCH_CLIENT_ID: 'x4po2in358dfq7c2jeuek5uh85qhoh',

	/**
	 * New Twitch app (Confidential client type) used by TwurpleManager.
	 * Authorization Code Grant - requires the secret below.
	 *
	 * @type {string}
	 */
	TWURPLE_CLIENT_ID: 'PASTE_TWURPLE_CLIENT_ID_HERE',

	/**
	 * Secret for the Twurple app. Generated in the Twitch dev console
	 * (click "New Secret" - Twitch only shows the value once). Used to
	 * exchange the authorization code for access + refresh tokens at
	 * https://id.twitch.tv/oauth2/token.
	 *
	 * @type {string}
	 */
	TWURPLE_CLIENT_SECRET: 'PASTE_TWURPLE_CLIENT_SECRET_HERE',

};
