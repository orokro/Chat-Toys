/*
	PluginToy.js
	------------

	The trusted, in-renderer half of a plugin: a Toy subclass that acts as the
	BROKER between the app and the plugin's sandboxed widget/headless code.

	One PluginToy instance exists per enabled plugin (created by the renderer
	PluginManager, not listed in ToysData). Because the existing Toy machinery
	leans on STATIC class fields (slug, name, widgetComponents, ...) and every
	plugin needs different values, we don't instantiate PluginToy directly.
	Instead `makePluginToyClass(manifest)` mints a per-plugin SUBCLASS with those
	statics filled from the manifest - so `toysData.asObject[slug].widgetComponents`
	and friends work for plugins exactly as they do for built-ins.

	Responsibilities:
	  - build settings (from manifest.settings schema) and commands
	    (from manifest.commands) so they slot into the normal config UI + DB
	  - expose a permission-gated `request()` the widget host calls for every
	    capability (points, chat, users, assets, obs). THIS is the single
	    enforcement point - the iframe is never trusted.
	  - bridge chat commands to the plugin via a token'd accept/reject handshake
	  - emit broker events (command / chat / obs) that hosts relay into iframes

	NOTE: render `state` and `settings` reads are handled by PluginWidgetHost
	inside the plugin's own namespace and never reach this broker - they need
	no permission (see protocol.REQUEST_PERMS).
*/

// vue
import { ref, shallowRef } from 'vue';

// lib
import { v4 as uuidv4 } from 'uuid';

// our app
import Toy from '../toys/Toy';
import PluginWidgetHost from './PluginWidgetHost.vue';
import { REQUEST_PERMS } from './protocol';

// how long to wait for a plugin to accept/reject a command before we auto-reject
const COMMAND_ACK_TIMEOUT_MS = 15 * 1000;


export default class PluginToy extends Toy {

	/**
	 * @param {import('../scripts/ToyManager').ToyManager} toyManager
	 */
	constructor(toyManager) {

		// NOTE: super() runs Toy's constructor, which calls this.initSettings()
		// and this.buildCommands() below. Those read `this.constructor.manifest`,
		// which the factory set as a static - available because `this.constructor`
		// resolves to the minted subclass even during super().
		super(toyManager);

		/** @type {Object} the plugin manifest backing this instance */
		this.manifest = this.constructor.manifest;

		/** granted permission set, for O(1) checks */
		this._perms = new Set(this.manifest.permissions || []);

		// broker event listeners: name -> Set<fn>
		this._brokerListeners = new Map();

		// outstanding command handshakes keyed by token
		this._pendingHandshakes = new Map();
		this._handshakeTimers = new Map();

		// If the plugin wants to see chat, subscribe ONCE here and re-emit as a
		// broker event. Gated by perm so an ungranted plugin's host can subscribe
		// freely but will simply never receive anything.
		this._onChat = null;
		if (this._perms.has('chat:read')) {
			this._onChat = (chats) => {
				for (const c of chats)
					this._emitBroker('chat', this._sanitizeChat(c));
			};
			this.chatToysApp.chatProcessor.onNewChats(this._onChat);
		}
	}


	/**
	 * Build the reactive settings block from the manifest's declarative schema,
	 * plus one persisted box ref per declared widget (so layout positions save).
	 */
	initSettings() {

		const manifest = this.constructor.manifest;
		const block = {};

		// schema-driven fields
		for (const field of (manifest.settings || [])) {

			const def = field.default;

			// arrays/objects need a shallowRef so deep replacement stays reactive
			const isContainer = (field.type === 'array' || (def !== null && typeof def === 'object'));
			block[field.key] = isContainer ? shallowRef(def ?? (field.type === 'array' ? [] : {})) : ref(def);
		}

		// one box per widget (mirrors how built-ins store their widget box)
		for (const w of (manifest.widgets || [])) {
			block[w.key] = shallowRef(w.defaultBox || { x: 100, y: 100, width: 200, height: 200 });
		}

		this.buildSettingsBlock(block);
	}


	/**
	 * Build commands from the manifest. Command TEXT collisions are resolved by
	 * the PluginManager BEFORE this runs (it rewrites manifest.commands[].default
	 * to a free name and persists it), so we can trust the names here.
	 */
	buildCommands() {

		const manifest = this.constructor.manifest;

		super.buildCommands((manifest.commands || []).map(c => ({
			command: c.default,
			slug: `${manifest.slug}__${c.key}`,
			description: c.description,
			userDesc: c.userDesc,
			params: c.params || [],
			cost: c.cost ?? 0,
			coolDown: c.coolDown ?? 0,
			groupCoolDown: c.groupCoolDown ?? 0,
		})));
	}


	// =====================================================================
	// Command bridge (app command system -> plugin -> accept/reject)
	// =====================================================================

	/**
	 * A chat command for this plugin fired. We can't run the plugin's logic here
	 * (it lives in the sandboxed widget), so we hand the command across the
	 * bridge with a token and hold the handshake until the plugin acks. The
	 * widget's CT.onCommand(...).accept()/reject() drives resolveCommandAck().
	 *
	 * @param {string} commandSlug - full slug, e.g. 'coinflip__flip'
	 * @param {Object} msg - the chat message
	 * @param {Object} user - the invoking user
	 * @param {Array<string>} params - parsed params
	 * @param {Object} handshake - { accept, reject } from CommandProcessor
	 */
	onCommand(commandSlug, msg, user, params, handshake) {

		if (!this._perms.has('commands:hook')) {
			handshake.reject('Plugin lacks commands:hook permission');
			return;
		}

		const token = uuidv4();
		this._pendingHandshakes.set(token, handshake);

		// auto-reject if the plugin never answers (widget closed, crashed, etc.)
		const timer = window.setElectronTimeout(() => {
			this._handshakeTimers.delete(token);
			const hs = this._pendingHandshakes.get(token);
			if (hs) {
				this._pendingHandshakes.delete(token);
				hs.reject('Plugin did not respond');
			}
		}, COMMAND_ACK_TIMEOUT_MS);
		this._handshakeTimers.set(token, timer);

		// bare command key for author ergonomics ('flip', not 'coinflip__flip')
		const command = commandSlug.startsWith(`${this.manifest.slug}__`)
			? commandSlug.slice(this.manifest.slug.length + 2)
			: commandSlug;

		// Build the user object the plugin sees. The DB-usable id is the
		// message's authorUniqueID (what window.ytctDB keys on), NOT the `user`
		// param (which may be a not-yet-persisted dummy). points.* calls from
		// the plugin pass user.id straight back to the broker.
		this._emitBroker('command', {
			token,
			command,
			user: {
				id: msg.authorUniqueID ?? null,
				displayName: msg.author ?? (user && (user.display_name ?? user.displayName)) ?? null,
				points: (user && (user.points ?? 0)) || 0,
			},
			params,
		});
	}


	/**
	 * Resolve a pending command handshake from a plugin's accept/reject ack.
	 * Idempotent - a second ack for the same token is ignored.
	 *
	 * @param {string} token - the token issued in onCommand
	 * @param {boolean} ok - true to accept (deduct points), false to reject
	 * @param {string} [reason] - optional rejection reason
	 */
	resolveCommandAck(token, ok, reason) {

		const hs = this._pendingHandshakes.get(token);
		if (!hs) return;

		this._pendingHandshakes.delete(token);

		const timer = this._handshakeTimers.get(token);
		if (timer) {
			window.clearElectronTimeout(timer);
			this._handshakeTimers.delete(token);
		}

		if (ok)
			hs.accept();
		else
			hs.reject(reason || 'Rejected by plugin');
	}


	// =====================================================================
	// Broker event bus (PluginWidgetHost subscribes; we push)
	// =====================================================================

	/**
	 * Subscribe a host to a broker event ('command' | 'chat' | 'obs').
	 *
	 * @param {string} name
	 * @param {Function} fn
	 * @returns {Function} unsubscribe
	 */
	onBroker(name, fn) {
		if (!this._brokerListeners.has(name))
			this._brokerListeners.set(name, new Set());
		this._brokerListeners.get(name).add(fn);
		return () => {
			const set = this._brokerListeners.get(name);
			if (set) set.delete(fn);
		};
	}


	/**
	 * Emit a broker event to all subscribed hosts.
	 *
	 * @param {string} name
	 * @param {*} detail
	 */
	_emitBroker(name, detail) {
		const set = this._brokerListeners.get(name);
		if (!set) return;
		for (const fn of set) {
			try { fn(detail); }
			catch (e) { console.error(`[PluginToy:${this.manifest.slug}] broker listener "${name}" threw`, e); }
		}
	}


	// =====================================================================
	// Capability requests (THE permission gate)
	// =====================================================================

	/**
	 * Handle a brokered capability request from the widget host. Every request
	 * passes through here and is rejected unless its type maps to a granted
	 * permission. Adding a capability = add a case AND a REQUEST_PERMS entry.
	 *
	 * @param {string} type - e.g. 'points.adjust'
	 * @param {Object} [payload] - method args
	 * @returns {Promise<*>} the result (rejects on denial/failure)
	 */
	async request(type, payload = {}) {

		// deny-unknown + permission check
		const needed = REQUEST_PERMS[type];
		if (!needed)
			throw new Error(`Unknown or unpermitted request "${type}"`);
		if (!this._perms.has(needed))
			throw new Error(`Permission denied: "${type}" requires ${needed}`);

		switch (type) {

			case 'points.get': {
				const u = window.ytctDB.getUser(payload.user);
				return u ? u.points : 0;
			}

			case 'points.adjust': {
				const delta = Number(payload.delta) || 0;
				window.ytctDB.updateUser(payload.user, { relativePoints: delta });
				const u = window.ytctDB.getUser(payload.user);
				return u ? u.points : 0;
			}

			case 'points.set': {
				const target = Number(payload.amount) || 0;
				const current = window.ytctDB.getUser(payload.user)?.points || 0;
				window.ytctDB.updateUser(payload.user, { relativePoints: target - current });
				return target;
			}

			case 'users.get':
				return this._sanitizeUser(window.ytctDB.getUser(payload.user));

			case 'chat.send':
				// V1: surface as an on-screen system message via the app logger.
				// (Sending to the real Twitch/YT chat needs auth scopes - later.)
				this.chatToysApp.log.msg(String(payload.text ?? ''));
				return true;

			case 'assets.url':
				return this._resolveAssetUrl(payload.ref);

			case 'obs.isLive':
				// OBSConnectionManager exposes a reactive live flag; fall back false.
				return !!(this.chatToysApp.obsConnMgr && this.chatToysApp.obsConnMgr.isLive
					? this.chatToysApp.obsConnMgr.isLive.value
					: false);

			default:
				throw new Error(`Unhandled request "${type}"`);
		}
	}


	// =====================================================================
	// Helpers
	// =====================================================================

	/**
	 * Resolve an asset ref to a fetchable URL. A ref containing a slash is
	 * treated as a plugin-relative path under this plugin's served folder;
	 * otherwise it's treated as an asset id and routed through Toy.getAssetPath.
	 *
	 * @param {string} ref
	 * @returns {string}
	 */
	_resolveAssetUrl(ref) {
		if (typeof ref !== 'string' || ref === '')
			return '';
		if (ref.includes('/')) {
			const port = this.chatToysApp.serverPort.value;
			return `http://localhost:${port}/plugins/${this.manifest.slug}/${ref.replace(/^\/+/, '')}`;
		}
		return this.getAssetPath(ref);
	}


	/**
	 * Reduce a DB user row to a safe subset for the sandbox.
	 *
	 * @param {?Object} user
	 * @returns {?Object}
	 */
	_sanitizeUser(user) {
		if (!user) return null;
		return {
			id: user.youtube_id ?? user.id ?? null,
			displayName: user.display_name ?? user.displayName ?? null,
			points: user.points ?? 0,
		};
	}


	/**
	 * Reduce a chat message to a safe subset for the sandbox.
	 *
	 * @param {Object} c
	 * @returns {Object}
	 */
	_sanitizeChat(c) {
		return {
			id: c.id ?? null,
			user: c.author ?? null,
			userId: c.authorUniqueID ?? null,
			text: c.messageText ?? '',
			emojis: c.emojis ?? [],
			platform: c.source ?? null,
		};
	}


	/**
	 * Tear down chat hook, pending handshakes, and timers.
	 */
	end() {

		super.end();

		if (this._onChat) {
			this.chatToysApp.chatProcessor.removeNewChatsListener(this._onChat);
			this._onChat = null;
		}

		for (const timer of this._handshakeTimers.values())
			window.clearElectronTimeout(timer);
		this._handshakeTimers.clear();

		for (const hs of this._pendingHandshakes.values()) {
			try { hs.reject('Plugin disabled'); } catch (e) { /* noop */ }
		}
		this._pendingHandshakes.clear();
		this._brokerListeners.clear();
	}

}


/**
 * Mint a per-plugin Toy subclass with statics filled from a manifest. The
 * returned class plugs into ToyManager / ToysData / LiveLayout exactly like a
 * built-in toy constructor.
 *
 * @param {Object} manifest - the plugin manifest (already validated)
 * @param {Object} [options]
 * @param {import('vue').Component} [options.optionsPageComponent] - generic
 *   PluginSettingsPage (passed in to avoid a hard import cycle during drafting)
 * @returns {typeof PluginToy} a ready-to-instantiate subclass
 */
export function makePluginToyClass(manifest, options = {}) {

	const widgetComponents = (manifest.widgets || []).map(w => ({
		component: PluginWidgetHost,
		key: w.key,
		slug: w.slug,
		description: w.description || w.name || '',
		allowResize: w.allowResize !== false,
		lockAspectRatio: !!w.lockAspectRatio,

		// plugin-specific extras PluginWidgetHost reads off `widgetInfo`.
		// `widgetSlug` is a stable copy of the widget slug because LiveLayout
		// overwrites `slug` with the TOY slug when it builds its widget list.
		pluginSlug: manifest.slug,
		widgetSlug: w.slug,
		entry: w.entry,
		permissions: manifest.permissions || [],
		defaultBox: w.defaultBox || null,
	}));

	class MintedPluginToy extends PluginToy {}

	// identity + presentation
	MintedPluginToy.manifest = manifest;
	MintedPluginToy.slug = manifest.slug;
	// NOTE: a function's `.name` is non-writable, so a plain assignment throws
	// a TypeError in strict mode (ES modules). Built-in toys get away with
	// `static name = '...'` (define-property semantics); we must do the same
	// explicitly or registration blows up and the plugin silently never loads.
	Object.defineProperty(MintedPluginToy, 'name', { value: manifest.name, configurable: true });
	MintedPluginToy.desc = manifest.description || '';
	MintedPluginToy.themeColor = manifest.themeColor || '#888888';

	// classification → tab routing (tool vs toy/game). Mirrors built-in isTool.
	MintedPluginToy.pluginClass = manifest.class || 'toy';
	MintedPluginToy.isTool = (manifest.class === 'tool');

	// Served icon URL (if the manifest declares one). Built-in toys resolve
	// their icon from assets/icons/<slug>.png; plugins have no such bundled
	// asset, so we point at the plugin's own served icon. Icon render sites
	// (the add modal, the vertical strip) fall back to `iconURL` when present.
	const iconPort = (typeof window !== 'undefined' && window.initPort) || 3001;
	MintedPluginToy.iconURL = manifest.icon
		? `http://localhost:${iconPort}/plugins/${manifest.slug}/${String(manifest.icon).replace(/^\/+/, '')}`
		: null;

	// surfaces consumed by Toy machinery / live page
	MintedPluginToy.widgetComponents = widgetComponents;
	MintedPluginToy.optionsPageComponent = options.optionsPageComponent || null;

	return MintedPluginToy;
}
