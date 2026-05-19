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
const STORAGE = 'assets';
const STORAGE_PREFIX = `${STORAGE}://`;

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

	// renderer/builtin - the on-disk home for bundled built-ins.
	const builtinDir = path.join(app.getAppPath(), 'renderer', 'builtin');

	// JSON parser shared by all mutating routes.
	const jsonParser = express.json({ limit: '5mb' });

	// ---- GET / (list) -----------------------------------------------------
	expressApp.get(MOUNT_PATH, (req, res) => {
		try {
			const dir = normalizePath(req.query.path);
			const rows = db.listAssetPathChildren(dir);
			res.json(buildEnvelope(dir, rows));
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
			const rows = filter ? db.searchAssetPaths(dir, filter) : [];
			res.json(buildEnvelope(dir, rows));
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

			// wipe on-disk files + custom_assets rows for any user assets
			// that were removed. Done outside the per-row transaction so a
			// missing on-disk file doesn't roll back the whole delete.
			for (const uuid of customUuidsToWipe) {
				try {
					const file = path.join(customAssetsDir, uuid);
					if (fs.existsSync(file)) fs.unlinkSync(file);
				} catch (e) {
					console.warn('[assetFsAPI] failed to unlink', uuid, e.message);
				}
				try { db.removeAsset(uuid); } catch (e) { /* swallow */ }
			}

			res.json(buildEnvelope(firstParent, db.listAssetPathChildren(firstParent)));
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
			res.json(buildEnvelope(renamed.parent_path, db.listAssetPathChildren(renamed.parent_path)));
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
			res.json(buildEnvelope(destination, db.listAssetPathChildren(destination)));
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
			res.json(buildEnvelope(parent, db.listAssetPathChildren(parent)));
		} catch (err) { sendError(res, err); }
	});

	// ---- 405s for actions we don't implement ------------------------------
	const notImplemented = (req, res) => res.status(405).json({
		status: false,
		message: `'${req.path.replace(MOUNT_PATH, '')}' is not supported by this driver.`,
	});
	expressApp.post(`${MOUNT_PATH}/copy`,         notImplemented);
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
 * @param {string} dirname
 * @param {Array<Object>} rows - asset_paths rows
 * @returns {Object} FsData
 */
function buildEnvelope(dirname, rows) {
	return {
		storages: [STORAGE],
		dirname,
		read_only: false,
		files: rows.map(rowToDirEntry),
	};
}


/**
 * Convert an asset_paths row to a vuefinder DirEntry. Extra fields
 * (`asset_ref`, `is_internal`, `asset_kind`) are appended so the
 * AssetBrowser's onSelect callback can read them without a second
 * round-trip.
 *
 * @param {Object} row
 * @returns {Object} DirEntry
 */
function rowToDirEntry(row) {
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
	if (!isDir && row.asset_kind === 'image') {
		entry.previewUrl = `${MOUNT_PATH}/preview?path=${encodeURIComponent(row.path)}`;
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
	const row = db.getAssetPathRow(p);
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
		res.json(buildEnvelope(targetPath, db.listAssetPathChildren(targetPath)));
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
