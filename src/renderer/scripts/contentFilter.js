/*
	contentFilter.js
	----------------

	Central content-hardening pass for incoming chat.

	Every chat message from every source (Twitch, YouTube, ...) converges in
	ChatProcessor before it fans out to the toys/widgets. This module is the
	one place that scrubs that converged stream as a defense-in-depth layer:

	  - strips dangerous invisible characters (control codes, bidi overrides,
	    zero-width space / BOM) that enable spoofing or layout attacks, WITHOUT
	    touching the zero-width joiners / variation selectors that legitimate
	    emoji sequences depend on;
	  - clamps absurd lengths as a cheap overlay-DoS backstop (limits sit far
	    above any real message, so legitimate content is never truncated);
	  - drops emote image URLs that aren't from an allow-listed image CDN, and
	    avatar URLs whose scheme isn't a plain http(s) / local path, so nothing
	    hostile can reach an <img src>.

	This is a SECOND checkpoint, not the primary defense: the widgets already
	escape at the render sink (see toys/Chat2/compat/emoteHtml.js and
	toys/Chat/sub_components/ParsedMessage.vue). It deliberately does NOT
	html-escape message text - escaping belongs at the sink, and doing it here
	would double-escape AND break the &code; emote encoding this same pipeline
	just produced.

	Toggleable from the dev-only Debug page via `contentFilterEnabled`; on by
	default, so production builds simply run with it enabled.
*/

// our app
import { chromeRef } from './chromeRef';


/**
 * Master on/off switch. Default true, so it is active in production (which has
 * no UI to change it). The dev Debug page binds a checkbox to this ref to A/B
 * test the layer against raw chat.
 *
 * @type {import('vue').Ref<Boolean>}
 */
export const contentFilterEnabled = chromeRef('dev_contentFilterEnabled', true);


/**
 * Image-CDN hosts we accept emote URLs from. Base domains (matched together
 * with their subdomains) so every Twitch / BTTV / FFZ / 7TV / YouTube emote +
 * avatar subdomain is covered. This is a superset of the dev emote-proxy list
 * in vite.config.js / OBSViewServer.js, broadened to base domains so we don't
 * drop legit emotes served from sibling subdomains (e.g. yt4.ggpht.com,
 * lh5.googleusercontent.com).
 *
 * @type {Array<String>}
 */
const EMOTE_HOSTS = [
	'jtvnw.net',             // Twitch
	'betterttv.net',         // BTTV
	'frankerfacez.com',      // FFZ
	'7tv.app',               // 7TV
	'ggpht.com',             // YouTube emoji / avatars
	'googleusercontent.com', // YouTube emoji / avatars
];

/** Generous upper bounds - a DoS backstop, never hit by real chat. */
const MAX_MESSAGE_LEN = 4000;
const MAX_AUTHOR_LEN = 200;


/**
 * Remove invisible characters that enable spoofing / layout attacks, while
 * preserving newlines, tabs, and the zero-width joiners + variation selectors
 * that compound emoji (e.g. the family glyph, a red heart) legitimately need.
 *
 * Stripped: C0/C1 control codes (except \t and \n), zero-width space
 * (U+200B), BOM / zero-width no-break space (U+FEFF), and the bidirectional
 * overrides (U+202A-202E, U+2066-2069).
 *
 * @param {String} s
 * @returns {String}
 */
export function stripInvisibles(s) {
	return String(s == null ? '' : s)
		.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '')
		.replace(/[​﻿‪-‮⁦-⁩]/g, '');
}


/**
 * Clamp a string to a maximum length.
 *
 * @param {String} s
 * @param {Number} max
 * @returns {String}
 */
function clamp(s, max) {
	const str = String(s == null ? '' : s);
	return str.length > max ? str.slice(0, max) : str;
}


/**
 * True if `url` is an https URL whose host is (a subdomain of) an allow-listed
 * image CDN. Emote images end up in an <img src>, so anything else is dropped.
 *
 * @param {String} url
 * @returns {Boolean}
 */
export function isAllowedEmoteUrl(url) {
	let parsed;
	try {
		parsed = new URL(String(url), 'http://localhost');
	} catch (e) {
		return false;
	}
	if (parsed.protocol !== 'https:')
		return false;
	const host = parsed.hostname.toLowerCase();
	return EMOTE_HOSTS.some((h) => host === h || host.endsWith('.' + h));
}


/**
 * True if `url` is safe to hand to an avatar <img src>: a plain local path, or
 * an http(s) URL. Blocks javascript:/data:/vbscript: and other odd schemes.
 * Deliberately lenient on host (avatars come from many sources - jtvnw, ggpht,
 * decapi, local builtins) since the value is also escaped at render; this only
 * rejects genuinely dangerous schemes.
 *
 * @param {String} url
 * @returns {Boolean}
 */
export function isSafeAvatarUrl(url) {
	const s = String(url == null ? '' : url).trim();
	if (s === '')
		return false;
	// local / relative asset paths (e.g. /live/builtin/ct_pfp.jpg) are fine
	if (s.startsWith('/'))
		return true;
	let parsed;
	try {
		parsed = new URL(s, 'http://localhost');
	} catch (e) {
		return false;
	}
	return parsed.protocol === 'https:' || parsed.protocol === 'http:';
}


/**
 * Scrub one formatted chat message in place and return it. Safe on any message
 * shape ChatProcessor produces; missing fields are simply left alone.
 *
 * @param {Object} msg - a formatted message (see ChatProcessor parsers)
 * @returns {Object} the same message, hardened
 */
export function sanitizeMessage(msg) {

	if (!msg || typeof msg !== 'object')
		return msg;

	// display name: strip invisibles + clamp (rendered escaped downstream)
	if (typeof msg.author === 'string')
		msg.author = clamp(stripInvisibles(msg.author), MAX_AUTHOR_LEN);

	// message text: strip invisibles (keeps \n and the &code; emote tokens),
	// clamp. NOT html-escaped here - that happens at the render sink.
	if (typeof msg.messageText === 'string')
		msg.messageText = clamp(stripInvisibles(msg.messageText), MAX_MESSAGE_LEN);

	// emotes render as <img src> - keep only allow-listed CDN https URLs. A
	// dropped emote just falls back to its literal &code; text (harmless).
	if (Array.isArray(msg.emojis))
		msg.emojis = msg.emojis.filter(
			(e) => e && typeof e.url === 'string' && isAllowedEmoteUrl(e.url)
		);

	// avatar renders as <img src> - null out anything with an unsafe scheme so
	// the widget falls back to its default avatar.
	if (msg.authorPFPUrl != null && !isSafeAvatarUrl(msg.authorPFPUrl))
		msg.authorPFPUrl = undefined;

	return msg;
}
