/*
	pluginPerms.js
	--------------

	Per-plugin GRANTED permission records (the consent layer). The broker
	(PluginToy) enforces the granted set, NOT the raw manifest set - so denying
	a permission actually restricts the plugin.

	Stored in localStorage under 'plugin-granted-perms' as { slug: [perm, ...] }.

	Migration / grandfathering: a plugin with NO record (one enabled before the
	consent system existed) falls back to its manifest permissions, so existing
	installs keep working. Anything enabled through the store/import flow writes
	a record first (via the consent modal), so new plugins are always gated.
*/

const LS_KEY = 'plugin-granted-perms';


/**
 * Friendly, user-facing labels for permission strings.
 *
 * @type {Object<string,string>}
 */
export const PERM_LABELS = {
	'chat:read': 'Read chat messages',
	'chat:send': 'Post on-screen messages',
	'commands:hook': 'Add chat commands',
	'points:read': 'Read viewer points',
	'points:adjust': 'Give or take viewer points',
	'users:read': 'Read viewer profiles',
	'assets:read': 'Use stream assets',
	'obs:status': 'Read OBS live status',
};


/**
 * @param {string} p
 * @returns {string}
 */
export function permLabel(p) {
	return PERM_LABELS[p] || p;
}


/**
 * @returns {Object<string, Array<string>>}
 */
function readAll() {
	try { return JSON.parse(localStorage.getItem(LS_KEY)) || {}; }
	catch (e) { return {}; }
}


/**
 * @param {Object} obj
 */
function writeAll(obj) {
	try { localStorage.setItem(LS_KEY, JSON.stringify(obj)); }
	catch (e) { /* quota - non-fatal */ }
}


/**
 * The granted permissions for a slug (empty array if a record exists but is
 * empty; empty array also if no record - use hasGrant() to distinguish).
 *
 * @param {string} slug
 * @returns {Array<string>}
 */
export function getGrantedPerms(slug) {
	return readAll()[slug] || [];
}


/**
 * Whether an explicit grant record exists for this slug.
 *
 * @param {string} slug
 * @returns {boolean}
 */
export function hasGrant(slug) {
	return slug in readAll();
}


/**
 * The permissions the broker should enforce: the granted record if one exists,
 * otherwise the manifest perms (grandfathered legacy install).
 *
 * @param {string} slug
 * @param {Array<string>} manifestPerms
 * @returns {Array<string>}
 */
export function effectivePerms(slug, manifestPerms) {
	const all = readAll();
	return (slug in all) ? all[slug] : (manifestPerms || []);
}


/**
 * Record the granted permission set for a slug (replaces any prior record).
 *
 * @param {string} slug
 * @param {Array<string>} perms
 */
export function grantPerms(slug, perms) {
	const all = readAll();
	all[slug] = Array.from(new Set(perms || []));
	writeAll(all);
}


/**
 * Drop a slug's grant record (e.g. on uninstall).
 *
 * @param {string} slug
 */
export function revokePerms(slug) {
	const all = readAll();
	if (slug in all) {
		delete all[slug];
		writeAll(all);
	}
}
