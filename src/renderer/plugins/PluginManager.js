/*
	PluginManager.js  (renderer side)
	---------------------------------

	The renderer half of the plugin system. The main-process PluginManager owns
	the filesystem + serving; THIS half turns the installed manifests into live
	toys the rest of the app already knows how to handle.

	Called once from the renderer bootstrap (index.js) BEFORE ChatToysApp is
	constructed, because ChatToysApp's constructor and ToyManager read
	`toysData.asObject[slug]` for every enabled slug - so plugin classes must be
	registered first or an enabled plugin would crash the boot.

	What it does, in order:
	  1. fetch the installed manifests over IPC (get-installed-plugins)
	  2. resolve command-name (the typed `!name`) collisions, stably
	  3. mint a per-plugin Toy subclass per manifest and register it into
	     the shared `toysData` array + asObject
	  4. purge settings/commands/enabled entries for plugins whose zip is gone
	     (boot GC for the renderer-owned localStorage state)
*/

import { toysData } from '../toys/ToysData';
import { makePluginToyClass } from './PluginToy';
import PluginSettingsPage from './PluginSettingsPage.vue';

// localStorage keys (chromeRef stores raw key -> JSON; see chromeRef.js)
const LS_COMMANDS = 'commands';
const LS_ENABLED = 'enabledToys';
const LS_RESOLVED_CMD_NAMES = 'plugin-command-names';   // { 'slug__key': resolvedName }
const LS_KNOWN_PLUGINS = 'installed-plugin-slugs';      // [ slug, ... ]


/**
 * Read + JSON-parse a localStorage key.
 *
 * @param {string} key
 * @param {*} fallback
 * @returns {*}
 */
function readLS(key, fallback) {
	try {
		const raw = localStorage.getItem(key);
		return raw == null ? fallback : JSON.parse(raw);
	} catch (e) {
		return fallback;
	}
}


/**
 * JSON-stringify + write a localStorage key.
 *
 * @param {string} key
 * @param {*} value
 */
function writeLS(key, value) {
	try { localStorage.setItem(key, JSON.stringify(value)); }
	catch (e) { /* quota / serialization - non-fatal */ }
}


/**
 * Slug -> kebab settings key, matching Toy.buildSettingsBlock.
 *
 * @param {string} slug
 * @returns {string}
 */
function settingsKey(slug) {
	return slug.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase() + '-settings';
}


/**
 * Collect the set of command names (the typed text, lowercased) already in use,
 * so plugin commands can avoid colliding with them.
 *
 * @returns {Set<string>}
 */
function collectTakenCommandNames() {
	const taken = new Set();
	const commands = readLS(LS_COMMANDS, {});
	for (const slug in commands) {
		const c = commands[slug];
		if (c && typeof c.command === 'string')
			taken.add(c.command.toLowerCase());
	}
	return taken;
}


/**
 * Pick a free command name by suffixing a number if needed.
 *
 * @param {string} desired
 * @param {Set<string>} taken - lowercased names already in use (mutated)
 * @returns {string} a name not in `taken`
 */
function uniqueCommandName(desired, taken) {
	let name = desired;
	let n = 2;
	while (taken.has(name.toLowerCase()))
		name = `${desired}${n++}`;
	taken.add(name.toLowerCase());
	return name;
}


/**
 * Remove the renderer-owned state for plugins that are no longer installed:
 * their settings blob, their commands in the global store, and any stale
 * enabled-list / known-list entries.
 *
 * @param {Set<string>} installedSlugs - slugs present this boot
 */
function purgeOrphans(installedSlugs) {

	const known = readLS(LS_KNOWN_PLUGINS, []);
	const orphans = known.filter(s => !installedSlugs.has(s));

	if (orphans.length > 0) {

		// drop each orphan's settings blob
		for (const slug of orphans) {
			try { localStorage.removeItem(settingsKey(slug)); } catch (e) { /* noop */ }
		}

		// drop their commands from the global command store
		const commands = readLS(LS_COMMANDS, {});
		let mutated = false;
		for (const cmdSlug of Object.keys(commands)) {
			if (orphans.some(s => cmdSlug.startsWith(`${s}__`))) {
				delete commands[cmdSlug];
				mutated = true;
			}
		}
		if (mutated)
			writeLS(LS_COMMANDS, commands);

		// drop resolved-name entries for orphans
		const resolved = readLS(LS_RESOLVED_CMD_NAMES, {});
		let rMutated = false;
		for (const id of Object.keys(resolved)) {
			if (orphans.some(s => id.startsWith(`${s}__`))) {
				delete resolved[id];
				rMutated = true;
			}
		}
		if (rMutated)
			writeLS(LS_RESOLVED_CMD_NAMES, resolved);
	}

	// defensively prune the enabled list of any slug we can't resolve to a
	// known toy (built-in or installed plugin) - prevents a boot crash.
	const enabled = readLS(LS_ENABLED, []);
	const valid = enabled.filter(s => toysData.asObject[s] || installedSlugs.has(s));
	if (valid.length !== enabled.length)
		writeLS(LS_ENABLED, valid);

	// remember this boot's installed set for next time's GC
	writeLS(LS_KNOWN_PLUGINS, Array.from(installedSlugs));
}


/**
 * Fetch installed plugin manifests, register them as toys, and reconcile
 * renderer-owned storage. Resolves when registration is complete.
 *
 * @returns {Promise<Array<Object>>} the registered manifests
 */
export async function registerInstalledPlugins() {

	let manifests = [];
	try {
		manifests = (await window.electronAPI.invoke('get-installed-plugins')) || [];
	} catch (e) {
		console.warn('[PluginManager] failed to load installed plugins:', e);
		return [];
	}

	const taken = collectTakenCommandNames();
	const resolvedNames = readLS(LS_RESOLVED_CMD_NAMES, {});
	const installedSlugs = new Set();

	for (const manifest of manifests) {

		if (!manifest || typeof manifest.slug !== 'string')
			continue;

		// guard against colliding with a built-in toy slug
		const existing = toysData.asObject[manifest.slug];
		if (existing && !existing.manifest) {
			console.warn(`[PluginManager] plugin slug "${manifest.slug}" collides with a built-in; skipping`);
			continue;
		}

		// resolve command-name collisions, stably (persist the choice)
		for (const cmd of (manifest.commands || [])) {
			const id = `${manifest.slug}__${cmd.key}`;
			let name = resolvedNames[id];
			if (!name) {
				name = uniqueCommandName(cmd.default, taken);
				resolvedNames[id] = name;
			} else {
				taken.add(name.toLowerCase());
			}
			if (name !== cmd.default) {
				console.warn(`[PluginManager] command "${cmd.default}" for ${manifest.slug} renamed to "${name}" (collision)`);
				cmd.default = name;
			}
		}

		// mint + register the per-plugin Toy class
		const cls = makePluginToyClass(manifest, { optionsPageComponent: PluginSettingsPage });
		if (!toysData.asObject[manifest.slug])
			toysData.push(cls);
		toysData.asObject[manifest.slug] = cls;

		installedSlugs.add(manifest.slug);
	}

	writeLS(LS_RESOLVED_CMD_NAMES, resolvedNames);
	purgeOrphans(installedSlugs);

	console.log(`[PluginManager] registered ${installedSlugs.size} plugin(s):`, Array.from(installedSlugs));
	return manifests;
}
