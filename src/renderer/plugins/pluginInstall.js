/*
	pluginInstall.js
	----------------

	Shared install/update + permission-consent flow, used by both the store and
	a plugin's settings page (so they can't drift). Downloads the zip via the
	main process, registers/replaces the class, gates on consent (delta-only for
	updates), enables + restarts the toy, and optionally routes to it.
*/

import { registerOrUpdatePlugin } from './PluginManager';
import { getGrantedPerms, grantPerms } from './pluginPerms';
import { promptModal } from 'jenesius-vue-modal';
import PluginPermsModal from '../components/options/PluginPermsModal.vue';


/**
 * Ensure the user has consented to a plugin's permissions. Prompts only for
 * not-yet-granted permissions (so updates only ask about NEW ones). On allow,
 * records the full set. Returns true to proceed.
 *
 * @param {Object} opts - { slug, name, icon, perms, isUpdate }
 * @returns {Promise<boolean>}
 */
export async function ensurePluginConsent({ slug, name, icon, perms, isUpdate }) {

	const list = perms || [];
	const granted = getGrantedPerms(slug);
	const needed = list.filter((p) => !granted.includes(p));

	if (needed.length === 0) {
		if (list.length) grantPerms(slug, list);
		return true;
	}

	const ok = await promptModal(PluginPermsModal, {
		name: name || slug,
		icon: icon || '',
		perms: needed,
		isUpdate: !!isUpdate,
	});
	if (!ok)
		return false;

	grantPerms(slug, list);
	return true;
}


/**
 * Download + install (or update) a remote plugin, register it, gate on consent,
 * then enable + restart it. Returns true if it ended up enabled.
 *
 * @param {Object} ctApp
 * @param {Object} opts - { slug, zip, zipFilename, name, icon, permissions, isUpdate, navigate }
 * @returns {Promise<boolean>}
 */
export async function installAndActivate(ctApp, opts) {

	const { slug, zip, zipFilename, name, icon, permissions, isUpdate, navigate = true } = opts;

	const manifests = await window.electronAPI.invoke('install-remote-plugin', { url: zip, filename: zipFilename });

	const manifest = (manifests || []).find((m) => m && m.slug === slug);
	if (manifest)
		registerOrUpdatePlugin(manifest);

	const perms = (manifest && manifest.permissions) || permissions || [];
	const allowed = await ensurePluginConsent({ slug, name, icon, perms, isUpdate });

	// a declined FRESH install stays installed-but-disabled; a declined update
	// still applies the new files but keeps the old granted perms.
	if (!allowed && !isUpdate)
		return false;

	ctApp.addToy(slug);
	ctApp.toyManager.restartToy(slug);
	if (navigate)
		ctApp.navigateToToy(slug);
	return true;
}
