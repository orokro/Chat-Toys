/*
	protocol.js
	-----------

	Shared definitions for the plugin <-> app message bridge.

	A plugin's widget HTML runs inside an opaque-origin sandboxed iframe
	(sandbox="allow-scripts", NO allow-same-origin). The ONLY channel out of
	that frame is a private MessagePort handed over at load time. This module
	is the single source of truth for the message shapes, the permission
	names, and the socket-key namespacing that both ends agree on.

	Two consumers:
	  - the trusted host (PluginWidgetHost.vue) imports this directly
	  - the in-frame SDK (ct-api.js) DELIBERATELY inlines the same constants
	    rather than importing, so it stays a zero-dependency file we can serve
	    raw to any iframe. If you change a `kind` string here, mirror it there.

	Transport framing (the handshake, outside the port):
	  host  -> iframe : window.postMessage('CT_PORT_HANDSHAKE', '*', [port2])
	  iframe keeps the port; all further traffic flows over it.

	Over the port:
	  iframe -> host : { kind:'hello' }
	                   { kind:'req',  id, type, payload }
	                   { kind:'ack',  token, ok, reason }
	                   { kind:'log',  args }
	  host  -> iframe : { kind:'init', info }
	                    { kind:'res',  id, result }      // success
	                    { kind:'res',  id, error }       // failure / denied
	                    { kind:'evt',  name, detail }    // pushed events
*/

/**
 * The literal string the host posts (with a transferred MessagePort) to begin
 * the handshake. Kept distinct/unguessable-ish so stray postMessages from
 * other scripts don't get mistaken for the port transfer.
 *
 * @type {string}
 */
export const PORT_HANDSHAKE = 'CT_PORT_HANDSHAKE';

/**
 * Message `kind` discriminators carried over the MessagePort.
 *
 * @type {Object<string,string>}
 */
export const KIND = {
	HELLO: 'hello',   // iframe -> host: SDK is alive, please send init + load
	INIT:  'init',    // host -> iframe: static info (slug/id/version/widget)
	REQ:   'req',     // iframe -> host: brokered capability request
	RES:   'res',     // host -> iframe: reply to a req (result | error)
	EVT:   'evt',     // host -> iframe: pushed event (load/chat/command/...)
	ACK:   'ack',     // iframe -> host: command accept/reject (by token)
	LOG:   'log',     // iframe -> host: route a log line to the app logger
};

/**
 * Event names the host may push to the iframe via {kind:'evt', name}.
 *
 * @type {Object<string,string>}
 */
export const EVT = {
	LOAD:     'load',      // detail: { settings, info, obsLive } (mirrors SE onWidgetLoad)
	SETTINGS: 'settings',  // detail: the new settings object
	CHAT:     'chat',      // detail: a chat message object        (perm: chat:read)
	COMMAND:  'command',   // detail: { token, command, user, params } (perm: commands:hook)
	OBS:      'obs',       // detail: { live:boolean }              (perm: obs:status)
	STATE:    'state',     // detail: { key, value } namespaced render state
};

/**
 * All permission strings recognised in V1. Names are `category:action` so
 * future additions stay additive. Anything not in this set is rejected at
 * manifest-validation time.
 *
 * @type {Array<string>}
 */
export const PERMISSIONS = [
	'chat:read',
	'chat:send',
	'commands:hook',
	'points:read',
	'points:adjust',
	'users:read',
	'assets:read',
	'obs:status',
	// future (reserved, not yet honoured): 'events:*', 'net:fetch', 'storage:user'
];

/**
 * Maps a brokered request `type` to the permission it requires. Requests whose
 * type is absent here are denied by default (deny-unknown). `state.*` and the
 * settings/load reads are intentionally NOT here - they're handled by the host
 * inside the plugin's own namespace and need no grant.
 *
 * @type {Object<string,string>}
 */
export const REQUEST_PERMS = {
	'chat.send':     'chat:send',
	'points.get':    'points:read',
	'points.adjust': 'points:adjust',
	'points.set':    'points:adjust',
	'users.get':     'users:read',
	'assets.url':    'assets:read',
	'obs.isLive':    'obs:status',
	// 'state.get' / 'state.set' -> handled by host, no perm (own namespace)
};

/**
 * Build the namespaced socket-ref key a plugin's render-state value lives under.
 * Every state key is forced beneath `plugin:<slug>:state:` so a plugin can never
 * read or clobber another toy's socket keys. THIS is the enforced sandbox for
 * state - it must only ever be constructed on the trusted host side.
 *
 * @param {string} slug - the plugin's slug
 * @param {string} key - the author-chosen state key
 * @returns {string} the fully-namespaced socket key
 */
export function stateSocketKey(slug, key) {
	return `plugin:${slug}:state:${String(key)}`;
}

/**
 * The socket key a plugin's settings are broadcast on. Mirrors the kebab-case
 * convention `Toy.buildSettingsBlock()` uses (`<slug-kebab>-settings`) so the
 * host can subscribe read-only to exactly what the options page publishes.
 *
 * @param {string} slug - the plugin's slug
 * @returns {string} the settings socket key
 */
export function settingsSocketKey(slug) {
	const kebab = slug.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
	return `${kebab}-settings`;
}
