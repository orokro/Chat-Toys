/*
	assetFsAPI.js
	-------------

	Express routes implementing the n1crack/vuefinder 4.x backend
	contract on top of our virtual asset_paths table (plus the on-disk
	custom_assets folder and the bundled built-in assets).

	Vuefinder 4.x uses REST-style endpoints, not a single `?q=` dispatcher.
	Routes (relative to mountPath, default `/api/files`):

	  GET    /                  list directory (query: ?path=...)
	  GET    /preview           stream a file (query: ?path=...)
	  GET    /download          stream a file w/ Content-Disposition
	  GET    /search            recursive search (query: ?path&filter)
	  POST   /upload            multipart upload, fieldName 'file'
	  POST   /delete            { path, items: [{path, type}] }
	  POST   /rename            { path, item, name }
	  POST   /move              { sources: [path], destination, path? }
	  POST   /create-folder     { path, name }

	Not implemented (return 405 - vuefinder will just show an error when
	users try these): /copy, /archive, /unarchive, /create-file, /save.

	Response envelope (FsData):
	    { storages: string[], dirname: string, files: DirEntry[], read_only?: boolean }

	DirEntry shape (one row per file / folder):
	    {
	      dir, basename, extension, path, storage, type ('file'|'dir'),
	      file_size, last_modified, mime_type, visibility, previewUrl?,
	      // Our extras (ignored by vuefinder but useful to the AssetBrowser):
	      asset_ref, is_internal, asset_kind
	    }
*/

const { app } = require('electron');
const path = require('path');
const fs   = require('fs');

// Tiny MIME-lookup. The deps we'd add for a "real" mime package aren't
// worth it given how narrow our file types are.
const MIME_MAP = {
	'.png':  'image/png',
	'.jpg':  'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.gif':  'image/gif',
	'.webp': 'image/webp',
	'.svg':  'image/svg+xml',
	'.mp3':  'audio/mpeg',
	'.wav':  'audio/wav',
	'.ogg':  'audio/ogg',
	'.m4a':  'audio/mp4',
	'.glb':  'model/gltf-binary',
	'.gltf': 'model/gltf+json',
	'.fbx':  'model/fbx',
};
function mimeOf(name) {
	return MIME_MAP[path.extname(name).toLowerCase()] || 'application/octet-stream';
}

// Bundled built-ins ship with the renderer code. AssetPath rows for
// built-ins carry the numeric id as `asset_ref`; we look the row up
// here to find the filename on disk under `renderer/builtin/<name>`.
const builtInAssets = require(path.join(__dirname, '..', '..', 'shared', 'builtInAssets.json'));
const builtInById = new Map(builtInAssets.map(a => [String(a.id), a]));

// Single storage prefix - matches what the database.js seeder uses.
// Declared here (above the built-in virtual FS) because the module-load
// tree build below references STORAGE_PREFIX.
const STORAGE = 'assets';
const STORAGE_PREFIX = `${STORAGE}://`;

// ---------------------------------------------------------------------------
// Built-in virtual filesystem (derived entirely from builtInAssets.json).
//
// Built-ins are NEVER stored in the database. They're mixed into directory
// listings / search / preview on the fly from the JSON catalog, so a new
// built-in can ship in a release and appear immediately with no DB migration.
// Built-in rows that an OLDER version seeded into asset_paths are ignored by
// the list/search handlers (we drop is_internal file rows), so there are no
// duplicates and the JSON stays the single source of truth.
// ---------------------------------------------------------------------------

const BUILTIN_FILE_BY_PATH   = new Map();   // full file path -> built-in asset
const BUILTIN_FILES_BY_PARENT = new Map();  // folder path    -> [built-in asset, ...]
const BUILTIN_CHILD_FOLDERS  = new Map();   // folder path    -> Set(child folder path)

/**
 * Parent folder of a virtual path (one segment up). The storage root for
 * top-level entries.
 *
 * @param {string} p - e.g. 'assets://Built-in/Claw Game'
 * @returns {string}
 */
function builtinParentOf(p) {
	const rest = p.slice(STORAGE_PREFIX.length);
	const idx = rest.lastIndexOf('/');
	return idx < 0 ? STORAGE_PREFIX : STORAGE_PREFIX + rest.slice(0, idx);
}

/**
 * Leaf name of a virtual path.
 *
 * @param {string} p
 * @returns {string}
 */
function builtinBasenameOf(p) {
	const rest = p.slice(STORAGE_PREFIX.length);
	const idx = rest.lastIndexOf('/');
	return idx < 0 ? rest : rest.slice(idx + 1);
}

// Build the virtual tree once at module load.
for (const a of builtInAssets) {
	const folder = a.canonicalPath;            // 'assets://Built-in/Claw Game'
	const filePath = `${folder}/${a.name}`;

	BUILTIN_FILE_BY_PATH.set(filePath, a);
	if (!BUILTIN_FILES_BY_PARENT.has(folder)) BUILTIN_FILES_BY_PARENT.set(folder, []);
	BUILTIN_FILES_BY_PARENT.get(folder).push(a);

	// register every ancestor folder -> child-folder relationship up to root
	let cur = folder;
	while (cur && cur !== STORAGE_PREFIX) {
		const parent = builtinParentOf(cur);
		if (!BUILTIN_CHILD_FOLDERS.has(parent)) BUILTIN_CHILD_FOLDERS.set(parent, new Set());
		BUILTIN_CHILD_FOLDERS.get(parent).add(cur);
		cur = parent;
	}
}

/**
 * Synthesize an asset_paths-shaped folder row for a virtual built-in folder.
 *
 * @param {string} folderPath
 * @returns {Object}
 */
function builtinFolderRow(folderPath) {
	return {
		path: folderPath,
		parent_path: builtinParentOf(folderPath),
		basename: builtinBasenameOf(folderPath),
		is_folder: 1,
		asset_ref: null,
		is_internal: 0,
		asset_kind: null,
		created_at: null,
	};
}

/**
 * Synthesize an asset_paths-shaped file row for a built-in asset.
 *
 * @param {Object} asset - a builtInAssets entry
 * @returns {Object}
 */
function builtinFileRow(asset) {
	const folder = asset.canonicalPath;
	return {
		path: `${folder}/${asset.name}`,
		parent_path: folder,
		basename: asset.name,
		is_folder: 0,
		asset_ref: String(asset.id),
		is_internal: 1,
		asset_kind: asset.kind || null,
		created_at: null,
	};
}

/**
 * Resolve a virtual path to a built-in file row, or null.
 *
 * @param {string} p
 * @returns {Object|null}
 */
function builtinRowForPath(p) {
	const a = BUILTIN_FILE_BY_PATH.get(p);
	return a ? builtinFileRow(a) : null;
}

/**
 * Merge DB rows with the built-in virtual FS for a directory listing. Drops
 * DB built-in FILE rows (JSON is the single source of truth) and dedupes
 * virtual folders against DB folder rows by path.
 *
 * @param {string} dir
 * @param {Array<Object>} dbRows
 * @returns {Array<Object>}
 */
function mergeBuiltinChildren(dir, dbRows) {

	// keep folders + custom files; drop any previously-seeded built-in files
	const kept = dbRows.filter(r => !(r.is_internal && !r.is_folder));
	const dbFolderPaths = new Set(kept.filter(r => r.is_folder).map(r => r.path));

	const folders = [...(BUILTIN_CHILD_FOLDERS.get(dir) || [])]
		.filter(fp => !dbFolderPaths.has(fp))
		.map(builtinFolderRow);
	const files = (BUILTIN_FILES_BY_PARENT.get(dir) || []).map(builtinFileRow);

	return [...kept, ...folders, ...files];
}

/**
 * Built-in file rows under `dir` (recursive) whose basename matches `filter`.
 *
 * @param {string} dir
 * @param {string} filter - case-insensitive substring
 * @returns {Array<Object>}
 */
function searchBuiltinRows(dir, filter) {
	const needle = filter.toLowerCase();
	const under = (p) => (dir === STORAGE_PREFIX ? p.startsWith(STORAGE_PREFIX) : p.startsWith(`${dir}/`));
	const out = [];
	for (const [filePath, asset] of BUILTIN_FILE_BY_PATH) {
		if (under(filePath) && asset.name.toLowerCase().includes(needle))
			out.push(builtinFileRow(asset));
	}
	return out;
}

/**
 * True when a directory path is the Built-in tree (or inside it). Used to
 * mark those listings read-only in the vuefinder UI, since built-ins are
 * shipped defaults that can't be renamed / moved / deleted.
 *
 * @param {string} dir
 * @returns {boolean}
 */
function isBuiltinDir(dir) {
	const root = `${STORAGE_PREFIX}Built-in`;
	return dir === root || dir.startsWith(`${root}/`);
}

// Public mount path. Both the AssetBrowser's `baseURL` and these routes
// have to agree on this string.
const MOUNT_PATH = '/api/files';


/**
 * Inject the asset filesystem routes into an existing express app.
 *
 * @param {import('express').Express} expressApp
 * @param {Object} ctx
 * @param {Object} ctx.db    - the DatabaseManager instance
 * @param {Function} ctx.log - log-to-frontend callback (msg) => void
 */
function mountAssetFsAPI(expressApp, ctx) {

	const { db, log } = ctx;
	const express = require('express');

	// userData/custom_assets - the on-disk home for user-imported files.
	const customAssetsDir = path.join(app.getPath('userData'), 'custom_assets');
	if (!fs.existsSync(customAssetsDir)) fs.mkdirSync(customAssetsDir, { recursive: true });

	// The bundled built-in assets live at different locations depending
	// on how the app is being run. Try each in priority order; the
	// first one that exists wins:
	//   1. Production / packaged: <appPath>/renderer/builtin/
	//   2. `npm run build` output:  <projectRoot>/build/renderer/builtin/
	//   3. Dev (vite serving src): <projectRoot>/src/renderer/public/builtin/
	// In dev `app.getAppPath()` is `<projectRoot>/build/main`, so the
	// dev/build fallbacks walk up two levels.
	const builtinDir = (() => {
		const candidates = [
			path.join(app.getAppPath(), 'renderer', 'builtin'),
			path.join(app.getAppPath(), '..', 'renderer', 'builtin'),
			path.join(app.getAppPath(), '..', '..', 'build', 'renderer', 'builtin'),
			path.join(app.getAppPath(), '..', '..', 'src', 'renderer', 'public', 'builtin'),
		];
		for (const c of candidates) {
			if (fs.existsSync(c)) return c;
		}
		return candidates[0]; // give up; preview endpoints will 404 with the prod path in error
	})();
	if (log) log(`[assetFsAPI] built-in dir resolved to: ${builtinDir}`);

	// JSON parser shared by all mutating routes.
	const jsonParser = express.json({ limit: '5mb' });

	// ---- GET / (list) -----------------------------------------------------
	expressApp.get(MOUNT_PATH, (req, res) => {
		try {
			const dir = normalizePath(req.query.path);
			const rows = mergeBuiltinChildren(dir, db.listAssetPathChildren(dir));
			res.json(buildEnvelope(dir, rows, req));
		} catch (err) { sendError(res, err); }
	});

	// ---- GET /preview -----------------------------------------------------
	expressApp.get(`${MOUNT_PATH}/preview`, (req, res) => {
		try { streamFile(req, res, db, customAssetsDir, builtinDir, false); }
		catch (err) { sendError(res, err); }
	});

	// ---- GET /download ----------------------------------------------------
	expressApp.get(`${MOUNT_PATH}/download`, (req, res) => {
		try { streamFile(req, res, db, customAssetsDir, builtinDir, true); }
		catch (err) { sendError(res, err); }
	});

	// ---- GET /search ------------------------------------------------------
	expressApp.get(`${MOUNT_PATH}/search`, (req, res) => {
		try {
			const dir = normalizePath(req.query.path);
			const filter = (req.query.filter || '').toString();
			let rows = [];
			if (filter) {
				const dbRows = db.searchAssetPaths(dir, filter).filter(r => !(r.is_internal && !r.is_folder));
				rows = [...dbRows, ...searchBuiltinRows(dir, filter)];
			}
			res.json(buildEnvelope(dir, rows, req));
		} catch (err) { sendError(res, err); }
	});

	// ---- POST /upload (multipart) -----------------------------------------
	expressApp.post(`${MOUNT_PATH}/upload`, (req, res) => {
		handleUpload(req, res, db, customAssetsDir).catch(err => sendError(res, err));
	});

	// ---- POST /delete -----------------------------------------------------
	expressApp.post(`${MOUNT_PATH}/delete`, jsonParser, (req, res) => {
		try {
			const body = req.body || {};
			const items = Array.isArray(body.items) ? body.items : [];
			if (items.length === 0) throw new Error('No items to delete');

			let firstParent = STORAGE_PREFIX;
			const customUuidsToWipe = [];

			for (const it of items) {
				if (!it || !it.path) continue;
				const row = db.getAssetPathRow(it.path);
				if (!row) continue;
				if (firstParent === STORAGE_PREFIX) firstParent = row.parent_path;
				const { removedCustomUuids } = db.deleteAssetPath(it.path);
				for (const uuid of removedCustomUuids) customUuidsToWipe.push(uuid);
			}

			// Wipe the on-disk file + custom_assets row for a uuid only
			// when there's NOTHING ELSE pointing at it. Other asset_paths
			// rows referencing the same uuid (legitimate copies, or
			// historical dupes that we want to keep functional) would
			// otherwise be left holding a dangling reference. Deduping
			// the list first means we hit the refcount check once per
			// unique uuid, not once per row deleted.
			const uniqueUuids = Array.from(new Set(customUuidsToWipe));
			for (const uuid of uniqueUuids) {
				const remaining = db.countAssetPathsByRef(uuid);
				if (remaining > 0) {
					// Other rows still reference this asset - leave the
					// underlying file alone. They'd render broken if we
					// wiped it now.
					continue;
				}
				try {
					const file = path.join(customAssetsDir, uuid);
					if (fs.existsSync(file)) fs.unlinkSync(file);
				} catch (e) {
					console.warn('[assetFsAPI] failed to unlink', uuid, e.message);
				}
				try { db.removeAsset(uuid); } catch (e) { /* swallow */ }
			}

			res.json(buildEnvelope(firstParent, db.listAssetPathChildren(firstParent), req));
		} catch (err) { sendError(res, err); }
	});

	// ---- POST /rename -----------------------------------------------------
	expressApp.post(`${MOUNT_PATH}/rename`, jsonParser, (req, res) => {
		try {
			const body = req.body || {};
			const item = (body.item || '').toString();
			const name = (body.name || '').toString().trim();
			if (!item) throw new Error('Item path is required');
			if (!name) throw new Error('New name is required');
			if (name.includes('/')) throw new Error('Name cannot contain slashes');
			const renamed = db.renameAssetPath(item, name);
			res.json(buildEnvelope(renamed.parent_path, db.listAssetPathChildren(renamed.parent_path), req));
		} catch (err) { sendError(res, err); }
	});

	// ---- POST /move -------------------------------------------------------
	expressApp.post(`${MOUNT_PATH}/move`, jsonParser, (req, res) => {
		try {
			const body = req.body || {};
			const sources = Array.isArray(body.sources) ? body.sources : [];
			const destination = (body.destination || '').toString();
			if (sources.length === 0) throw new Error('No sources to move');
			if (!destination) throw new Error('Destination is required');
			for (const s of sources) {
				if (!s) continue;
				db.moveAssetPath(s, destination);
			}
			// Vuefinder sends `path` as the current directory; return its
			// updated contents so the breadcrumb stays sync'd to where
			// the user is, not where the file went.
			const currentDir = normalizePath(body.path || destination);
			res.json(buildEnvelope(currentDir, db.listAssetPathChildren(currentDir), req));
		} catch (err) { sendError(res, err); }
	});

	// ---- POST /copy -------------------------------------------------------
	expressApp.post(`${MOUNT_PATH}/copy`, jsonParser, (req, res) => {
		try {
			const body = req.body || {};
			const sources = Array.isArray(body.sources) ? body.sources : [];
			const destination = (body.destination || '').toString();
			if (sources.length === 0) throw new Error('No sources to copy');
			if (!destination) throw new Error('Destination is required');
			for (const s of sources) {
				if (!s) continue;
				db.copyAssetPath(s, destination, customAssetsDir);
			}
			// Stay at the user's current directory (the source folder)
			// so the breadcrumb doesn't surprise-jump to the destination.
			const currentDir = normalizePath(body.path || destination);
			res.json(buildEnvelope(currentDir, db.listAssetPathChildren(currentDir), req));
		} catch (err) { sendError(res, err); }
	});

	// ---- POST /create-folder ---------------------------------------------
	expressApp.post(`${MOUNT_PATH}/create-folder`, jsonParser, (req, res) => {
		try {
			const body = req.body || {};
			const parent = normalizePath(body.path);
			const name = (body.name || '').toString().trim();
			if (!name) throw new Error('Folder name is required');
			if (name.includes('/')) throw new Error('Folder name cannot contain slashes');
			db.createAssetFolder(parent, name);
			res.json(buildEnvelope(parent, db.listAssetPathChildren(parent), req));
		} catch (err) { sendError(res, err); }
	});

	// ---- 405s for actions we don't implement ------------------------------
	const notImplemented = (req, res) => res.status(405).json({
		status: false,
		message: `'${req.path.replace(MOUNT_PATH, '')}' is not supported by this driver.`,
	});
	expressApp.post(`${MOUNT_PATH}/archive`,      notImplemented);
	expressApp.post(`${MOUNT_PATH}/unarchive`,    notImplemented);
	expressApp.post(`${MOUNT_PATH}/create-file`,  notImplemented);
	expressApp.post(`${MOUNT_PATH}/save`,         notImplemented);

	if (log) log(`[assetFsAPI] mounted at ${MOUNT_PATH}`);
}


// ============================================================================
// Helpers
// ============================================================================


/**
 * Normalize an incoming path. Empty / undefined collapse to the root.
 * Otherwise returned as-is. Always carries the prefix.
 *
 * @param {string|undefined} raw
 * @returns {string}
 */
function normalizePath(raw) {
	const v = (raw || '').toString().trim();
	if (!v || v === STORAGE_PREFIX) return STORAGE_PREFIX;
	if (!v.startsWith(STORAGE_PREFIX)) return STORAGE_PREFIX + v;
	return v;
}


/**
 * Build the FsData envelope vuefinder expects for any listing response.
 *
 * We thread `req` through so `rowToDirEntry` can build absolute preview
 * URLs (`http://localhost:<port>/...`). Otherwise an `<img src="...">`
 * would resolve the relative URL against the renderer's origin
 * (`localhost:8080` under Vite, `file://` in packaged builds), neither
 * of which match the express widget server.
 *
 * @param {string} dirname
 * @param {Array<Object>} rows - asset_paths rows
 * @param {import('express').Request} [req] - the current request (used for base URL)
 * @returns {Object} FsData
 */
function buildEnvelope(dirname, rows, req) {
	const baseUrl = absoluteBaseUrlFromReq(req);
	return {
		storages: [STORAGE],
		dirname,
		// Built-in folders are shipped defaults - present them read-only so
		// the UI suppresses rename/move/delete/upload there. Custom assets
		// (under My Assets) stay fully editable.
		read_only: isBuiltinDir(dirname),
		files: rows.map(r => rowToDirEntry(r, baseUrl)),
	};
}


/**
 * Derive the absolute URL prefix for our own routes from a Request.
 * Falls back to an empty string when no request is available - the
 * resulting URL is then relative.
 *
 * @param {import('express').Request} [req]
 * @returns {string}
 */
function absoluteBaseUrlFromReq(req) {
	if (!req) return '';
	const proto = req.protocol || 'http';
	// req.get('host') honors X-Forwarded-Host if Express trust-proxy is
	// on; req.headers.host is the literal header. Either is fine here.
	const host = (req.get && req.get('host')) || (req.headers && req.headers.host) || 'localhost';
	return `${proto}://${host}`;
}


/**
 * Convert an asset_paths row to a vuefinder DirEntry. Extra fields
 * (`asset_ref`, `is_internal`, `asset_kind`) are appended so the
 * AssetBrowser's onSelect callback can read them without a second
 * round-trip.
 *
 * @param {Object} row
 * @param {string} [baseUrl] - absolute origin prefix for the previewUrl
 * @returns {Object} DirEntry
 */
function rowToDirEntry(row, baseUrl = '') {
	const isDir = !!row.is_folder;
	const entry = {
		dir: row.parent_path,
		basename: row.basename,
		extension: isDir ? '' : (path.extname(row.basename).slice(1) || ''),
		path: row.path,
		storage: STORAGE,
		type: isDir ? 'dir' : 'file',
		file_size: null,
		last_modified: row.created_at ? Math.floor(Date.parse(row.created_at) / 1000) : null,
		mime_type: isDir ? null : mimeOf(row.basename),
		visibility: 'public',
		// our passthrough extras - vuefinder ignores unknown fields
		asset_ref: row.asset_ref || null,
		is_internal: !!row.is_internal,
		asset_kind: row.asset_kind || null,
	};
	// previewUrl for images so vuefinder thumbnails work without us
	// having to do extra work client-side. Audio / 3D get no preview.
	// Always absolute: the renderer's origin (localhost:8080 in dev,
	// file:// in packaged builds) doesn't match the widget server.
	//
	// Belt-and-suspenders: trust either `asset_kind === 'image'` OR a
	// matching file extension. Older asset_paths rows (created before
	// we started populating asset_kind) can have NULL there and we
	// still want their thumbnails to render.
	if (!isDir) {
		const ext = path.extname(row.basename).toLowerCase();
		const isImage = row.asset_kind === 'image'
			|| ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'].includes(ext);
		if (isImage) {
			entry.previewUrl = `${baseUrl}${MOUNT_PATH}/preview?path=${encodeURIComponent(row.path)}`;
		}
	}
	return entry;
}


/**
 * Resolve the on-disk path for a file row. Built-ins live in the bundled
 * renderer folder; user files live in userData/custom_assets.
 *
 * @param {Object} row
 * @param {string} customAssetsDir
 * @param {string} builtinDir
 * @returns {string|null}
 */
function resolveOnDiskPath(row, customAssetsDir, builtinDir) {
	if (!row || row.is_folder) return null;
	if (row.is_internal) {
		const meta = builtInById.get(String(row.asset_ref));
		if (!meta) return null;
		return path.join(builtinDir, meta.name);
	}
	return path.join(customAssetsDir, row.asset_ref);
}


/**
 * Stream a file's bytes back to the client. Used by both /preview and
 * /download - same code, different Content-Disposition.
 */
function streamFile(req, res, db, customAssetsDir, builtinDir, asDownload) {
	const p = normalizePath(req.query.path);
	// Built-ins may have no DB row (they're virtual) - fall back to the
	// JSON-derived row so previews/downloads still resolve.
	const row = db.getAssetPathRow(p) || builtinRowForPath(p);
	if (!row) return res.status(404).json({ status: false, message: 'Not found' });
	if (row.is_folder) return res.status(400).json({ status: false, message: 'Cannot preview a folder' });
	const onDisk = resolveOnDiskPath(row, customAssetsDir, builtinDir);
	if (!onDisk || !fs.existsSync(onDisk))
		return res.status(404).json({ status: false, message: 'Underlying file missing' });

	res.setHeader('Content-Type', mimeOf(row.basename));
	if (asDownload) {
		res.setHeader('Content-Disposition', `attachment; filename="${row.basename}"`);
	} else {
		res.setHeader('Cache-Control', 'public, max-age=60');
	}
	fs.createReadStream(onDisk).pipe(res);
}


/**
 * Multipart upload handler. Vuefinder (via Uppy) POSTs each file with
 * field name `file` and a separate metadata field `path` (the target
 * folder). We accept any of those, write to disk, insert into both
 * tables, and respond with the refreshed FsData for the target folder.
 */
async function handleUpload(req, res, db, customAssetsDir) {

	// Try multer first; fall back to inline parse if it isn't installed.
	let multer;
	try { multer = require('multer'); } catch (e) { multer = null; }

	const respond = (targetPath) => {
		res.json(buildEnvelope(targetPath, db.listAssetPathChildren(targetPath), req));
	};

	if (multer) {
		const upload = multer({ storage: multer.memoryStorage() }).any();
		return new Promise((resolve, reject) => {
			upload(req, res, async (err) => {
				if (err) return reject(err);
				try {
					// vuefinder sends the target folder either as the
					// `path` query string OR as a multipart field `path`.
					const target = normalizePath(
						(req.body && req.body.path) || req.query.path
					);
					await ingestUploadedFiles(req.files || [], db, customAssetsDir, target);
					respond(target);
					resolve();
				} catch (e) { reject(e); }
			});
		});
	}

	const { files, fields } = await parseMultipartManually(req);
	const target = normalizePath(fields.path || req.query.path);
	await ingestUploadedFiles(files, db, customAssetsDir, target);
	respond(target);
}


/**
 * Persist each uploaded buffer to disk and insert the metadata rows.
 *
 * @param {Array<{ originalname:string, buffer:Buffer, mimetype?:string }>} files
 * @param {Object} db
 * @param {string} customAssetsDir
 * @param {string} parentPath
 */
async function ingestUploadedFiles(files, db, customAssetsDir, parentPath) {

	const { v4: uuidv4 } = require('uuid');

	for (const f of files) {
		if (!f || !f.buffer) continue;
		const originalName = f.originalname || 'untitled';
		const ext = (path.extname(originalName) || '').replace(/^\./, '');
		const uuid = `${uuidv4()}${ext ? '.' + ext : ''}`;
		const targetDisk = path.join(customAssetsDir, uuid);

		fs.writeFileSync(targetDisk, f.buffer);

		const lc = ext.toLowerCase();
		const kind = ['png', 'gif', 'jpg', 'jpeg', 'webp', 'svg'].includes(lc) ? 'image'
		           : ['mp3', 'wav', 'ogg', 'm4a'].includes(lc) ? 'sound'
		           : ['glb', 'gltf', 'fbx'].includes(lc) ? '3d'
		           : 'any';

		db.addAsset({ uuid, originalName, extension: ext, type: kind });

		db.insertAssetFile({
			parentPath,
			basename: originalName,
			assetRef: uuid,
			isInternal: false,
			assetKind: kind,
		});
	}
}


/**
 * Hand-rolled multipart parser fallback (only used when multer isn't
 * installed). Drains the body and splits on the boundary. Good enough
 * for images/sounds/3D models we're realistically going to import.
 *
 * @param {import('http').IncomingMessage} req
 * @returns {Promise<{ files:Array, fields:Object }>}
 */
async function parseMultipartManually(req) {

	const contentType = req.headers['content-type'] || '';
	const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
	if (!boundaryMatch) throw new Error('Missing multipart boundary');
	const boundary = boundaryMatch[1] || boundaryMatch[2];

	const chunks = [];
	await new Promise((resolve, reject) => {
		req.on('data', (c) => chunks.push(c));
		req.on('end', resolve);
		req.on('error', reject);
	});
	const body = Buffer.concat(chunks);

	const sep    = Buffer.from(`--${boundary}`);
	const endSep = Buffer.from(`--${boundary}--`);

	const files = [];
	const fields = {};
	let pos = 0;
	while (true) {
		const start = body.indexOf(sep, pos);
		if (start < 0) break;
		if (body.subarray(start, start + endSep.length).equals(endSep)) break;
		const headerStart = start + sep.length + 2;
		const headerEnd = body.indexOf(Buffer.from('\r\n\r\n'), headerStart);
		if (headerEnd < 0) break;
		const headersRaw = body.subarray(headerStart, headerEnd).toString('utf8');
		const bodyStart = headerEnd + 4;
		const nextBoundary = body.indexOf(sep, bodyStart);
		if (nextBoundary < 0) break;
		const bytes = body.subarray(bodyStart, nextBoundary - 2);

		const nameMatch = headersRaw.match(/name="([^"]+)"/i);
		const fileMatch = headersRaw.match(/filename="([^"]+)"/i);
		const typeMatch = headersRaw.match(/Content-Type:\s*([^\r\n]+)/i);

		if (fileMatch) {
			files.push({
				originalname: fileMatch[1],
				buffer: Buffer.from(bytes),
				mimetype: typeMatch ? typeMatch[1].trim() : 'application/octet-stream',
			});
		} else if (nameMatch) {
			fields[nameMatch[1]] = bytes.toString('utf8');
		}
		pos = nextBoundary;
	}
	return { files, fields };
}


/**
 * Common error responder. Vuefinder reads `message` from the JSON body.
 */
function sendError(res, err) {
	const msg = err && err.message ? err.message : String(err);
	console.error('[assetFsAPI]', msg);
	res.status(400).json({ status: false, message: msg });
}


module.exports = { mountAssetFsAPI };
