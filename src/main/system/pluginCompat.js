/*
	pluginCompat.js
	---------------

	Plugin <-> app compatibility, kept pure (no Electron, no fs writes) so it
	can be unit-tested and shared by the scanner, the installer and the shop.

	The rule is one number. The app supports plugin API level
	PLUGIN_API_VERSION (src/shared/pluginApi.json). A manifest declares the
	level it was built against in "apiVersion" (a missing or bad value means
	1, which is every plugin written before the field existed). A plugin runs
	here if its apiVersion <= PLUGIN_API_VERSION.

	Bump pluginApiVersion when the SDK / broker gains something a plugin could
	depend on, and add a line to its "history".

	The remote shop publishes two indexes (see scripts/plugin-server):
	  index.v2.json  every version of every plugin; this app picks the newest
	                 one it can run
	  index.json     the old flat format, listing only API-1 builds, so apps
	                 from before versioning never see plugins they can't run
*/

const path = require('path');

const PLUGIN_API_VERSION = require(path.join(__dirname, '..', '..', 'shared', 'pluginApi.json')).pluginApiVersion;


/**
 * The API level a manifest (or index entry) was built against.
 *
 * @param {?Object} m
 * @returns {number} integer >= 1
 */
function manifestApiVersion(m) {
	const n = Number(m && m.apiVersion);
	return Number.isInteger(n) && n >= 1 ? n : 1;
}


/**
 * @param {?Object} m - manifest or index version entry
 * @param {number} [supported=PLUGIN_API_VERSION]
 * @returns {boolean}
 */
function isApiCompatible(m, supported = PLUGIN_API_VERSION) {
	return manifestApiVersion(m) <= supported;
}


/**
 * Numeric semver compare (ignores pre-release tags).
 *
 * @param {string} a
 * @param {string} b
 * @returns {number} >0 if a>b, <0 if a<b, 0 if equal
 */
function semverCmp(a, b) {
	const pa = String(a || '0').split('.').map((x) => parseInt(x, 10) || 0);
	const pb = String(b || '0').split('.').map((x) => parseInt(x, 10) || 0);
	for (let i = 0; i < 3; i++) {
		if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0);
	}
	return 0;
}


/**
 * Turn a fetched remote index (v2 or legacy v1) into one shop entry per
 * plugin, choosing the newest version this app can run.
 *
 * Each entry is the chosen version's metadata plus:
 *   compatible          false when no published version runs on this app
 *   requiredApiVersion  (incompatible only) the lowest API level on offer
 *   newestVersion       newest published version, runnable or not
 *   newerNeedsAppUpdate a newer version exists that needs a newer app
 * Incompatible entries show the newest version's metadata and have zip: null
 * so nothing can install them.
 *
 * Relative icon / thumbnail / zip paths are resolved against baseUrl.
 *
 * @param {Object} data - parsed index JSON
 * @param {Object} opts
 * @param {string} opts.baseUrl - the URL the index was fetched from
 * @param {number} [opts.apiVersion=PLUGIN_API_VERSION]
 * @returns {Array<Object>}
 */
function selectRemotePlugins(data, { baseUrl, apiVersion = PLUGIN_API_VERSION }) {

	const abs = (rel) => {
		if (!rel) return null;
		try { return new URL(rel, baseUrl).toString(); }
		catch (e) { return null; }
	};

	// normalize both formats to [{ top, versions: [...] }]
	const groups = [];
	for (const p of (data && Array.isArray(data.plugins)) ? data.plugins : []) {
		if (!p || !p.slug) continue;
		if (Array.isArray(p.versions)) {
			const versions = p.versions.filter((v) => v && v.version);
			if (versions.length) groups.push({ top: p, versions });
		} else if (p.version) {
			// legacy flat entry: the entry is its own single version
			groups.push({ top: p, versions: [p] });
		}
	}

	const out = [];
	for (const { top, versions } of groups) {

		const sorted = versions.slice().sort((a, b) => semverCmp(b.version, a.version));
		const newest = sorted[0];
		const best = sorted.find((v) => manifestApiVersion(v) <= apiVersion) || null;
		const chosen = best || newest;

		const entry = {
			...chosen,
			id: top.id || chosen.id,
			slug: top.slug,
			name: chosen.name || top.name || top.slug,
			apiVersion: manifestApiVersion(chosen),
			icon: abs(top.icon || chosen.icon),
			thumbnails: (top.thumbnails || chosen.thumbnails || []).map(abs).filter(Boolean),
			zip: best ? abs(best.zip) : null,
			compatible: !!best,
			newestVersion: newest.version,
			newerNeedsAppUpdate: !!best && semverCmp(newest.version, best.version) > 0,
		};
		delete entry.versions;

		if (!best)
			entry.requiredApiVersion = Math.min(...sorted.map(manifestApiVersion));

		out.push(entry);
	}
	return out;
}


module.exports = {
	PLUGIN_API_VERSION,
	manifestApiVersion,
	isApiCompatible,
	semverCmp,
	selectRemotePlugins,
};
