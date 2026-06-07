/*
	ChatThemeManager.js  (main / node side)
	---------------------------------------

	The filesystem + serving half of the Chat "compatibility mode" (Mode 3),
	which ingests a third-party Streamlabs chat theme and renders it natively
	inside a nested iframe served from the localhost widget server.

	Mirrors PluginManager's shape on purpose:
	  - own an app-data dir (chat-themes/) holding one folder per imported theme
	  - import a theme from a folder OR a .zip (the 4 Streamlabs parts -
	    HTML / CSS / Fields / JS - plus any bundled asset files)
	  - parse the Streamlabs `Fields` blob and stash metadata in theme.json
	  - mount Express routes on the widget server:
	      GET /chat-themes/installed.json        -> the imported-theme list
	      GET /chat-themes/:id/index.html        -> a GENERATED harness page that
	                                                pairs the theme's markup + CSS
	                                                with OUR message-loop harness
	      GET /chat-themes/:id/<file>            -> the theme's raw asset files

	Per the chat-theming spec we DELIBERATELY do not execute the theme's own JS;
	the harness (chatThemeHarness.js) owns the message loop. js.txt is kept only
	for reference / debugging.
*/

const fs = require('fs');
const os = require('os');
const path = require('path');
const extract = require('extract-zip');


class ChatThemeManager {

	/**
	 * @param {import('electron').App} electronApp - the Electron app (for paths)
	 * @param {Object} [options]
	 * @param {Function} [options.log] - optional logger (msg:string)=>void
	 */
	constructor(electronApp, options = {}) {

		this.app = electronApp;
		this.log = options.log || (() => {});

		// app-data dir: one subfolder per imported theme
		const userData = electronApp.getPath('userData');
		this.themesDir = path.join(userData, 'chat-themes');
		this._ensureDirs();

		// the harness source (inlined into each generated page) + its pure API
		this._harness = this._loadHarness();
	}


	/**
	 * Ensure the chat-themes app-data dir exists.
	 */
	_ensureDirs() {
		try { fs.mkdirSync(this.themesDir, { recursive: true }); }
		catch (e) { /* noop */ }
	}


	/**
	 * Locate + load the harness module: returns { source, api }. The source
	 * text is inlined into each served page; the api gives us the pure
	 * extractTemplate/extractLog helpers in the main process. Tries a few
	 * candidate paths so it works both in dev (source tree) and packaged.
	 *
	 * @returns {{source:string, api:Object}}
	 */
	_loadHarness() {

		const candidates = [
			path.join(this.app.getAppPath(), 'renderer', 'compat', 'chatThemeHarness.js'),
			path.join(__dirname, '..', '..', 'renderer', 'toys', 'Chat2', 'compat', 'chatThemeHarness.js'),
			path.join(process.cwd(), 'src', 'renderer', 'toys', 'Chat2', 'compat', 'chatThemeHarness.js'),
		];

		for (const c of candidates) {
			try {
				if (fs.existsSync(c)) {
					const source = fs.readFileSync(c, 'utf8');
					// require for the pure API (UMD; no auto-start without window)
					let api = {};
					try { api = require(c); } catch (e) { /* fall back to minimal */ }
					return { source, api };
				}
			} catch (e) { /* try next */ }
		}

		this.log('[ChatThemeManager] harness source not found; compat pages will be minimal');
		return { source: '', api: {} };
	}


	// ---- ingest -----------------------------------------------------------

	/**
	 * Slugify a name into a filesystem-safe id fragment.
	 *
	 * @param {string} name
	 * @returns {string}
	 */
	_slug(name) {
		return String(name || 'theme')
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '')
			.slice(0, 40) || 'theme';
	}


	/**
	 * Pick an id that isn't already taken (appends -2, -3, ... on collision).
	 *
	 * @param {string} base
	 * @returns {string}
	 */
	_uniqueId(base) {
		let id = base;
		let n = 1;
		while (fs.existsSync(path.join(this.themesDir, id))) {
			n++;
			id = `${base}-${n}`;
		}
		return id;
	}


	/**
	 * Classify a source file by name into one of the theme parts (or 'asset').
	 *
	 * @param {string} name - file basename
	 * @returns {('html'|'css'|'fields'|'js'|'asset')}
	 */
	_classify(name) {
		const n = name.toLowerCase();
		if (n.includes('field')) return 'fields';
		if (n.endsWith('.html') || n.endsWith('.htm') || n === 'html.txt' || n.includes('html')) return 'html';
		if (n.endsWith('.css') || n === 'css.txt' || (n.includes('css') && n.endsWith('.txt'))) return 'css';
		if (n.endsWith('.js') || n === 'js.txt' || (n.includes('js') && n.endsWith('.txt'))) return 'js';
		return 'asset';
	}


	/**
	 * Collect the theme parts + asset files from a source directory.
	 *
	 * @param {string} dir
	 * @returns {{html:string, css:string, fields:string, js:string, assets:Array<{name:string, abs:string}>}}
	 */
	_collectThemeFiles(dir) {

		const out = { html: '', css: '', fields: '', js: '', assets: [] };

		let entries = [];
		try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
		catch (e) { return out; }

		for (const e of entries) {
			if (!e.isFile()) continue;
			const abs = path.join(dir, e.name);
			const kind = this._classify(e.name);
			if (kind === 'asset') {
				out.assets.push({ name: e.name, abs });
			} else if (!out[kind]) {
				try { out[kind] = fs.readFileSync(abs, 'utf8'); }
				catch (err) { /* skip unreadable */ }
			} else {
				// already have this part; treat extras as assets
				out.assets.push({ name: e.name, abs });
			}
		}
		return out;
	}


	/**
	 * Find the real theme root inside an extracted/zipped tree: either `dir`
	 * itself (if it holds theme parts) or a single nested folder.
	 *
	 * @param {string} dir
	 * @returns {string}
	 */
	_findThemeRoot(dir) {
		const here = this._collectThemeFiles(dir);
		if (here.html || here.css || here.fields) return dir;

		let children = [];
		try { children = fs.readdirSync(dir, { withFileTypes: true }); }
		catch (e) { return dir; }

		for (const c of children) {
			if (c.isDirectory()) {
				const sub = path.join(dir, c.name);
				const parts = this._collectThemeFiles(sub);
				if (parts.html || parts.css || parts.fields) return sub;
			}
		}
		return dir;
	}


	/**
	 * Import a Streamlabs theme from a folder OR a .zip. Normalizes the parts
	 * into chat-themes/<id>/ (html.txt/css.txt/fields.txt/js.txt + assets +
	 * theme.json) and returns the new theme's metadata.
	 *
	 * @param {string} srcPath - absolute path to a folder or .zip
	 * @returns {Promise<Object>} the theme metadata
	 */
	async importLocal(srcPath) {

		if (!srcPath || !fs.existsSync(srcPath))
			throw new Error('importLocal: source not found');

		const stat = fs.statSync(srcPath);

		// resolve a source directory (extract zips to a temp dir first)
		let srcDir;
		let tmp = null;
		if (stat.isDirectory()) {
			srcDir = srcPath;
		} else if (/\.zip$/i.test(srcPath)) {
			tmp = path.join(os.tmpdir(), 'ct-theme-' + Date.now());
			fs.mkdirSync(tmp, { recursive: true });
			await extract(srcPath, { dir: tmp });
			srcDir = this._findThemeRoot(tmp);
		} else {
			throw new Error('importLocal: expected a folder or .zip');
		}

		// gather the parts
		const parts = this._collectThemeFiles(srcDir);
		if (!parts.html && !parts.css && !parts.fields) {
			if (tmp) { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) { /* noop */ } }
			throw new Error('importLocal: no Streamlabs theme files (HTML/CSS/Fields) found');
		}

		// derive an id + name
		const rawName = path.basename(stat.isDirectory() ? srcPath : srcPath.replace(/\.zip$/i, '')) || 'theme';
		const id = this._uniqueId(this._slug(rawName));
		const dest = path.join(this.themesDir, id);
		fs.mkdirSync(dest, { recursive: true });

		// write the normalized parts
		fs.writeFileSync(path.join(dest, 'html.txt'), parts.html || '');
		fs.writeFileSync(path.join(dest, 'css.txt'), parts.css || '');
		fs.writeFileSync(path.join(dest, 'fields.txt'), parts.fields || '');
		fs.writeFileSync(path.join(dest, 'js.txt'), parts.js || '');

		// copy any bundled assets so relative URLs resolve under the served root
		for (const a of parts.assets) {
			try { fs.copyFileSync(a.abs, path.join(dest, path.basename(a.name))); }
			catch (e) { /* skip */ }
		}

		// parse Fields for metadata (lenient)
		let fields = {};
		try { fields = JSON.parse(parts.fields || '{}'); }
		catch (e) { this.log(`[ChatThemeManager] bad Fields in ${rawName}: ${e.message}`); }

		const meta = {
			id,
			name: rawName,
			createdAt: Date.now(),
			fields,
		};
		fs.writeFileSync(path.join(dest, 'theme.json'), JSON.stringify(meta, null, 2));

		if (tmp) { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) { /* noop */ } }

		this.log(`[ChatThemeManager] imported theme "${rawName}" as ${id}`);
		return meta;
	}


	/**
	 * Validate + resolve a theme id to its directory (guards traversal).
	 *
	 * @param {string} id
	 * @returns {?string} absolute dir, or null if invalid/missing
	 */
	_themeDir(id) {
		if (!id || /[\\/]/.test(id) || id.includes('..')) return null;
		const dir = path.join(this.themesDir, id);
		return fs.existsSync(dir) ? dir : null;
	}


	/**
	 * Read a theme's parts + metadata from disk.
	 *
	 * @param {string} id
	 * @returns {?Object} { id, name, fields, html, css, js }
	 */
	get(id) {
		const dir = this._themeDir(id);
		if (!dir) return null;

		const read = (f) => { try { return fs.readFileSync(path.join(dir, f), 'utf8'); } catch (e) { return ''; } };
		let meta = {};
		try { meta = JSON.parse(read('theme.json') || '{}'); } catch (e) { meta = {}; }

		return {
			id,
			name: meta.name || id,
			fields: meta.fields || {},
			html: read('html.txt'),
			css: read('css.txt'),
			js: read('js.txt'),
		};
	}


	/**
	 * List all imported themes (metadata only).
	 *
	 * @returns {Array<Object>} [{ id, name, fields, createdAt }]
	 */
	list() {
		let entries = [];
		try { entries = fs.readdirSync(this.themesDir, { withFileTypes: true }); }
		catch (e) { return []; }

		const out = [];
		for (const e of entries) {
			if (!e.isDirectory()) continue;
			try {
				const meta = JSON.parse(fs.readFileSync(path.join(this.themesDir, e.name, 'theme.json'), 'utf8'));
				out.push({ id: meta.id || e.name, name: meta.name || e.name, fields: meta.fields || {}, createdAt: meta.createdAt || 0 });
			} catch (err) { /* skip non-themes */ }
		}
		out.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
		return out;
	}


	/**
	 * Remove an imported theme.
	 *
	 * @param {string} id
	 * @returns {boolean} true if removed
	 */
	remove(id) {
		const dir = this._themeDir(id);
		if (!dir) return false;
		try { fs.rmSync(dir, { recursive: true, force: true }); return true; }
		catch (e) { return false; }
	}


	// ---- serving ----------------------------------------------------------

	/**
	 * Build the default field-value map from a parsed Streamlabs Fields object.
	 *
	 * @param {Object} fields
	 * @returns {Object} { fieldName: defaultValue }
	 */
	_fieldDefaults(fields) {
		const out = {};
		for (const k in (fields || {})) {
			if (Object.prototype.hasOwnProperty.call(fields, k))
				out[k] = (fields[k] && fields[k].value !== undefined) ? fields[k].value : '';
		}
		return out;
	}


	/**
	 * Generate the harness HTML page for a theme: the theme's markup (minus its
	 * template script) + an inlined theme payload + the harness script. The
	 * harness self-inits from window.__CT_THEME and then takes field/chat
	 * updates from the parent (or runs demo mode with ?demo=1).
	 *
	 * @param {string} id
	 * @returns {string} the page HTML
	 */
	_buildPage(id) {

		const theme = this.get(id);
		if (!theme) return '<!doctype html><meta charset="utf-8"><title>Not found</title>theme not found';

		const api = this._harness.api || {};
		const template = (typeof api.extractTemplate === 'function') ? api.extractTemplate(theme.html) : '';
		const logHtml = (typeof api.extractLog === 'function') ? api.extractLog(theme.html) : theme.html;

		const payload = {
			css: theme.css || '',
			template: template || '',
			fields: this._fieldDefaults(theme.fields),
			options: {},
		};

		// JSON for inline <script>; escape </ to avoid breaking out of the tag
		const payloadJson = JSON.stringify(payload).replace(/<\//g, '<\\/');

		return '<!doctype html>\n'
			+ '<html><head><meta charset="utf-8">\n'
			+ '<meta name="viewport" content="width=device-width, initial-scale=1">\n'
			+ '<style>html,body{margin:0;padding:0;height:100%;background:transparent;overflow:hidden;}</style>\n'
			+ '</head><body>\n'
			+ logHtml + '\n'
			+ '<script>window.__CT_THEME = ' + payloadJson + ';</' + 'script>\n'
			+ '<script>\n' + (this._harness.source || '') + '\n</' + 'script>\n'
			+ '</body></html>';
	}


	/**
	 * Mount the chat-theme routes on the widget Express app.
	 *
	 * @param {Object} expressApp - the Express application
	 */
	mountRoutes(expressApp) {

		// the imported-theme list (for the live page if it needs it)
		expressApp.get('/chat-themes/installed.json', (req, res) => {
			res.json({ schemaVersion: 1, themes: this.list() });
		});

		// the generated harness page
		expressApp.get('/chat-themes/:id/index.html', (req, res) => {
			const html = this._buildPage(req.params.id);
			res.type('html').send(html);
		});

		// trailing-slash convenience -> index.html
		expressApp.get('/chat-themes/:id/', (req, res) => {
			res.redirect(`/chat-themes/${encodeURIComponent(req.params.id)}/index.html`);
		});

		// raw theme asset files (path-traversal guarded)
		expressApp.get('/chat-themes/:id/*', (req, res) => {
			const dir = this._themeDir(req.params.id);
			if (!dir) { res.status(404).send('theme not found'); return; }

			const rel = req.params[0] || '';
			const full = path.normalize(path.join(dir, rel));
			if (!full.startsWith(path.normalize(dir))) { res.status(403).send('forbidden'); return; }
			if (!fs.existsSync(full) || !fs.statSync(full).isFile()) { res.status(404).send('not found'); return; }

			res.sendFile(full);
		});
	}

}

module.exports = { ChatThemeManager };
