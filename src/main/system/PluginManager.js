/*
	PluginManager.js  (main / node side)
	------------------------------------

	The filesystem + serving half of the plugin system. Owns everything that
	touches disk and the Express widget-server; the renderer half owns the
	active toys and UI.

	Responsibilities:
	  - ensure the app-data plugin dirs exist (plugins/, plugins-extracted/)
	  - scan plugins/ for installed plugins. Two accepted forms:
	      * a .zip            -> extracted (by hash) into plugins-extracted/
	      * a plain folder     -> used in place (handy for local dev/testing)
	  - read + lightly validate each manifest.json
	  - mount Express routes on the widget server:
	      GET /plugins/installed.json   -> the manifest list (live page + shop)
	      GET /plugins/_sdk/ct-api.js   -> the hosted SDK
	      GET /plugins/:slug/<path>     -> the plugin's files; .html entries get
	                                       the SDK <script> auto-injected
	  - answer the renderer's 'get-installed-plugins' IPC (see main.js)

	Source of truth = what's in plugins/. "Installed" means present there.
	Scanning kicks off in the constructor; routes + IPC await `ready()` so there
	is no boot-order race with the renderer or the live page.
*/

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const extract = require('extract-zip');

// Where the shop fetches its remote catalog from. Override via the
// PluginManager options if you host it elsewhere.
const DEFAULT_REMOTE_INDEX_URL = 'https://reallyserious.business/chattoys/plugins/index.json';
const REMOTE_CACHE_TTL_MS = 5 * 60 * 1000;


class PluginManager {

	/**
	 * @param {import('electron').App} electronApp - the Electron app (for paths)
	 * @param {Object} [options]
	 * @param {Function} [options.log] - optional logger (msg:string)=>void
	 */
	constructor(electronApp, options = {}) {

		this.app = electronApp;
		this.log = options.log || (() => {});

		// app-data dirs
		const userData = electronApp.getPath('userData');
		this.pluginsDir = path.join(userData, 'plugins');
		this.extractedDir = path.join(userData, 'plugins-extracted');

		// slug -> { manifest, root } where root is the served directory
		this.installed = new Map();

		// the SDK source, read once and served raw to iframes
		this._sdkSource = this._loadSdkSource();

		// remote catalog (the shop) + a short-lived cache
		this.remoteIndexUrl = options.remoteIndexUrl || DEFAULT_REMOTE_INDEX_URL;
		this._remoteCache = null;

		// kick off the first scan; everything that needs data awaits this
		this._ready = this.scan();
	}


	/**
	 * Resolves once the initial scan has completed.
	 *
	 * @returns {Promise<void>}
	 */
	ready() {
		return this._ready;
	}


	/**
	 * Ensure plugin dirs exist.
	 */
	_ensureDirs() {
		for (const d of [this.pluginsDir, this.extractedDir]) {
			try { fs.mkdirSync(d, { recursive: true }); }
			catch (e) { /* already exists */ }
		}
	}


	/**
	 * Scan the plugins dir, (re)extract zips as needed, and (re)build the
	 * installed map. Safe to call repeatedly (e.g. after an install).
	 *
	 * @returns {Promise<void>}
	 */
	async scan() {

		this._ensureDirs();
		this.log(`[PluginManager] scanning ${this.pluginsDir}`);

		const next = new Map();

		let entries = [];
		try { entries = fs.readdirSync(this.pluginsDir, { withFileTypes: true }); }
		catch (e) { this.log(`[PluginManager] cannot read plugins dir: ${e.message}`); }

		for (const entry of entries) {

			try {

				let root = null;

				// a) plain folder dropped straight into plugins/ - use in place
				if (entry.isDirectory()) {
					root = this._findManifestRoot(path.join(this.pluginsDir, entry.name));
				}

				// b) a .zip -> extract (by hash) then locate the manifest root
				else if (entry.isFile() && entry.name.toLowerCase().endsWith('.zip')) {
					root = await this._ensureExtracted(path.join(this.pluginsDir, entry.name));
				}

				if (!root)
					continue;

				const manifest = this._readManifest(root);
				if (!manifest)
					continue;

				// duplicate slug (e.g. an old + new versioned zip both present):
				// keep the HIGHEST version deterministically.
				const prev = next.get(manifest.slug);
				if (prev && this._semverCmp(manifest.version, prev.manifest.version) <= 0) {
					this.log(`[PluginManager] "${manifest.slug}" v${manifest.version} <= kept v${prev.manifest.version}; skipping`);
					continue;
				}

				next.set(manifest.slug, { manifest, root });
				this.log(`[PluginManager] loaded plugin "${manifest.slug}" v${manifest.version || '?'}`);

			} catch (e) {
				this.log(`[PluginManager] failed on "${entry.name}": ${e.message}`);
			}
		}

		this.installed = next;

		// GC: drop extracted dirs that no longer have a backing zip
		this._gcExtracted();
	}


	/**
	 * Extract a zip into plugins-extracted/<basename>, skipping the work if the
	 * existing extraction matches the zip's hash. Returns the manifest root.
	 *
	 * @param {string} zipPath - absolute path to the .zip
	 * @returns {Promise<?string>} the served root dir, or null on failure
	 */
	async _ensureExtracted(zipPath) {

		const base = path.basename(zipPath).replace(/\.zip$/i, '');
		const dest = path.join(this.extractedDir, base);
		const hashFile = path.join(dest, '.plugin-zip-hash');
		const hash = this._hashFile(zipPath);

		// up to date?
		let needExtract = true;
		if (fs.existsSync(hashFile)) {
			try { needExtract = (fs.readFileSync(hashFile, 'utf8').trim() !== hash); }
			catch (e) { needExtract = true; }
		}

		if (needExtract) {
			this.log(`[PluginManager] extracting ${path.basename(zipPath)}`);
			try { fs.rmSync(dest, { recursive: true, force: true }); } catch (e) { /* noop */ }
			fs.mkdirSync(dest, { recursive: true });
			await extract(zipPath, { dir: dest });
			try { fs.writeFileSync(hashFile, hash); } catch (e) { /* noop */ }
		}

		return this._findManifestRoot(dest);
	}


	/**
	 * Find the directory that actually contains manifest.json: either `dir`
	 * itself or a single nested folder one level down (zips often wrap their
	 * contents in a top folder).
	 *
	 * @param {string} dir
	 * @returns {?string}
	 */
	_findManifestRoot(dir) {

		if (fs.existsSync(path.join(dir, 'manifest.json')))
			return dir;

		let children = [];
		try { children = fs.readdirSync(dir, { withFileTypes: true }); }
		catch (e) { return null; }

		for (const c of children) {
			if (c.isDirectory() && fs.existsSync(path.join(dir, c.name, 'manifest.json')))
				return path.join(dir, c.name);
		}
		return null;
	}


	/**
	 * Read + lightly validate a manifest.json from a plugin root.
	 *
	 * @param {string} root
	 * @returns {?Object} the manifest, or null if invalid
	 */
	_readManifest(root) {

		let manifest;
		try {
			manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
		} catch (e) {
			this.log(`[PluginManager] bad manifest in ${root}: ${e.message}`);
			return null;
		}

		if (!manifest || typeof manifest.slug !== 'string' || !manifest.slug) {
			this.log(`[PluginManager] manifest missing slug in ${root}`);
			return null;
		}
		if (!Array.isArray(manifest.widgets)) {
			manifest.widgets = [];
		}
		return manifest;
	}


	/**
	 * Remove extracted dirs whose source zip is gone (boot GC). Folder-form
	 * plugins live under plugins/ and are never copied here, so this only
	 * touches zip extractions.
	 */
	_gcExtracted() {

		let zipBases = new Set();
		try {
			for (const e of fs.readdirSync(this.pluginsDir, { withFileTypes: true })) {
				if (e.isFile() && e.name.toLowerCase().endsWith('.zip'))
					zipBases.add(e.name.replace(/\.zip$/i, ''));
			}
		} catch (e) { return; }

		let extracted = [];
		try { extracted = fs.readdirSync(this.extractedDir, { withFileTypes: true }); }
		catch (e) { return; }

		for (const e of extracted) {
			if (e.isDirectory() && !zipBases.has(e.name)) {
				this.log(`[PluginManager] GC orphaned extraction: ${e.name}`);
				try { fs.rmSync(path.join(this.extractedDir, e.name), { recursive: true, force: true }); }
				catch (err) { /* noop */ }
			}
		}
	}


	/**
	 * The manifest list handed to the renderer (IPC) and the live page (HTTP).
	 *
	 * @returns {Array<Object>}
	 */
	getManifests() {
		return Array.from(this.installed.values()).map(p => p.manifest);
	}


	/**
	 * Fetch the remote shop catalog. Relative icon/thumbnail/zip paths in the
	 * index are resolved to absolute URLs against the index URL, so the client
	 * never configures a base URL. Short-lived in-memory cache. Network errors
	 * resolve to an empty list (shop just shows local items).
	 *
	 * @param {boolean} [force]
	 * @returns {Promise<Array<Object>>}
	 */
	async getRemoteIndex(force = false) {

		if (!force && this._remoteCache && (Date.now() - this._remoteCache.at) < REMOTE_CACHE_TTL_MS)
			return this._remoteCache.data;

		try {
			const res = await fetch(this.remoteIndexUrl);
			if (!res.ok) throw new Error(`status ${res.status}`);
			const data = await res.json();
			const base = this.remoteIndexUrl;

			const abs = (rel) => (rel ? new URL(rel, base).toString() : null);
			const plugins = (data.plugins || []).map((p) => ({
				...p,
				icon: abs(p.icon),
				thumbnails: (p.thumbnails || []).map(abs),
				zip: abs(p.zip),
			}));

			this._remoteCache = { at: Date.now(), data: plugins };
			return plugins;

		} catch (e) {
			this.log(`[PluginManager] remote index fetch failed: ${e.message}`);
			return [];
		}
	}


	/**
	 * Download a remote plugin zip into the plugins dir (the canonical install
	 * surface) and rescan so it becomes "installed".
	 *
	 * @param {string} zipUrl - absolute URL to the .zip
	 * @param {string} [filename] - target filename in plugins/ (defaults to the URL basename)
	 * @returns {Promise<Array<Object>>} the refreshed manifest list
	 */
	async installRemotePlugin(zipUrl, filename) {

		if (!zipUrl)
			throw new Error('installRemotePlugin: no zip url');

		const fallbackName = path.basename(new URL(zipUrl).pathname) || 'plugin.zip';
		const safe = String(filename || fallbackName).replace(/[^a-zA-Z0-9._-]/g, '_');

		const res = await fetch(zipUrl);
		if (!res.ok)
			throw new Error(`download failed: status ${res.status}`);
		const bytes = Buffer.from(await res.arrayBuffer());

		this._ensureDirs();
		fs.writeFileSync(path.join(this.pluginsDir, safe), bytes);

		await this.scan();
		return this.getManifests();
	}


	// =====================================================================
	// Express serving
	// =====================================================================

	/**
	 * Mount the plugin routes onto the widget server's express app. Registered
	 * before the /live block in OBSViewServer; the specific routes (installed
	 * .json, _sdk) are registered before the catch-all file route so they win.
	 *
	 * @param {import('express').Express} expressApp
	 */
	mountRoutes(expressApp) {

		// installed manifest list
		expressApp.get('/plugins/installed.json', async (req, res) => {
			await this._ready;
			res.json({ schemaVersion: 1, plugins: this.getManifests() });
		});

		// the hosted SDK
		expressApp.get('/plugins/_sdk/ct-api.js', (req, res) => {
			res.type('application/javascript').send(this._sdkSource);
		});

		// per-plugin files: /plugins/<slug>/<relative path>
		expressApp.get(/^\/plugins\/([^/]+)\/(.+)$/, async (req, res) => {

			await this._ready;

			const slug = req.params[0];
			const rel = req.params[1];

			const plugin = this.installed.get(slug);
			if (!plugin) {
				res.status(404).send('plugin not found');
				return;
			}

			// resolve + guard against path traversal
			const full = path.normalize(path.join(plugin.root, rel));
			if (!full.startsWith(path.normalize(plugin.root))) {
				res.status(403).send('forbidden');
				return;
			}
			if (!fs.existsSync(full) || !fs.statSync(full).isFile()) {
				res.status(404).send('not found');
				return;
			}

			// .html entries get the SDK auto-injected; everything else served raw
			if (full.toLowerCase().endsWith('.html')) {
				let html = fs.readFileSync(full, 'utf8');
				html = this._injectSdk(html);
				res.type('html').send(html);
				return;
			}

			res.sendFile(full);
		});
	}


	/**
	 * Inject the SDK <script> into a widget HTML document so authors never ship
	 * or reference it. Prefers right after <head>, falls back to prepending.
	 *
	 * @param {string} html
	 * @returns {string}
	 */
	_injectSdk(html) {
		const tag = '<script src="/plugins/_sdk/ct-api.js"></script>';
		if (/<head[^>]*>/i.test(html))
			return html.replace(/<head[^>]*>/i, (m) => `${m}\n\t${tag}`);
		if (/<html[^>]*>/i.test(html))
			return html.replace(/<html[^>]*>/i, (m) => `${m}\n${tag}`);
		return `${tag}\n${html}`;
	}


	/**
	 * Locate + read the ct-api.js SDK from the renderer tree (dev or prod).
	 *
	 * @returns {string} the SDK source (or a stub that logs an error)
	 */
	_loadSdkSource() {

		const candidates = [
			path.join(this.app.getAppPath(), 'renderer', 'plugins', 'ct-api.js'),
			path.join(__dirname, '..', '..', 'renderer', 'plugins', 'ct-api.js'),
			path.join(process.cwd(), 'src', 'renderer', 'plugins', 'ct-api.js'),
		];

		for (const c of candidates) {
			try {
				if (fs.existsSync(c))
					return fs.readFileSync(c, 'utf8');
			} catch (e) { /* try next */ }
		}

		this.log('[PluginManager] WARNING: ct-api.js not found; plugins will not get the SDK');
		return 'console.error("[CT] ct-api.js could not be located by the app");';
	}


	/**
	 * sha256 of a file's bytes.
	 *
	 * @param {string} file
	 * @returns {string}
	 */
	_hashFile(file) {
		return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
	}


	/**
	 * Numeric semver compare (ignores pre-release tags).
	 *
	 * @param {string} a
	 * @param {string} b
	 * @returns {number} >0 if a>b, <0 if a<b, 0 if equal
	 */
	_semverCmp(a, b) {
		const pa = String(a || '0').split('.').map((x) => parseInt(x, 10) || 0);
		const pb = String(b || '0').split('.').map((x) => parseInt(x, 10) || 0);
		for (let i = 0; i < 3; i++) {
			if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0);
		}
		return 0;
	}

}

module.exports = { PluginManager };
