/*
	VTSFileBridge.js
	----------------

	Main-process helper for copying ChatToys assets into
	the VTube Studio StreamingAssets/chat_toys folder.

	Renderer calls this via IPC with the asset metadata.
*/

const { ipcMain, app } = require('electron');
const path = require('path');
const fs = require('fs');

// Reuse the custom assets dir from importAsset.js
const { ASSET_DIR } = require('./importAsset'); // ASSET_DIR = app.getPath('userData')/custom_assets 

// Simple helper to detect dev vs packaged
const isDev = !app.isPackaged;

// Built-in assets folder:
// - In dev, assume: <projectRoot>/public/builtin
// - In prod, assume: <resourcesPath>/builtin
const BUILTIN_DIR = isDev
	? path.join(__dirname, '..', 'public', 'builtin')
	: path.join(process.resourcesPath, 'builtin');


/**
 * Ensure a directory exists.
 *
 * @param {string} dirPath
 */
function ensureDir(dirPath) {
	if (!fs.existsSync(dirPath)) {
		fs.mkdirSync(dirPath, { recursive: true });
	}
}


/**
 * Copies an asset into the VTS StreamingAssets/chat_toys folder.
 *
 * Renderer payload shape:
 * {
 *   asset: {
 *     id: string,        // uuid.ext for custom, string id for built-ins
 *     name: string,      // original_name or built-in filename (e.g. "tomato.glb")
 *     internal: boolean, // true = built-in, false = custom user asset
 *     file_path?: string,
 *     kind?: string,
 *   },
 *   streamingAssetsPath: string
 * }
 *
 * Returns:
 * {
 *   success: boolean,
 *   destPath?: string,
 *   relPath?: string,    // e.g. "chat_toys/<uuid.ext>"
 *   error?: string
 * }
 */
function setupVTSFileBridge(mainWindow) {

	ipcMain.handle('vts-copy-asset', async (event, payload) => {

		try {

			if (!payload || !payload.asset || !payload.streamingAssetsPath) {
				return {
					success: false,
					error: 'Missing asset metadata or StreamingAssets path.'
				};
			}

			const { asset, streamingAssetsPath } = payload;
			const { id, name, internal } = asset;

			if (!id || !name) {
				return {
					success: false,
					error: 'Asset id/name missing.'
				};
			}

			// Where we’ll copy the file into inside VTS
			const baseDir = streamingAssetsPath;
			const chatToysDir = path.join(baseDir, 'chat_toys');

			ensureDir(chatToysDir);

			// We'll use the asset.id as the filename to avoid collisions
			const destFileName = id;
			const destPath = path.join(chatToysDir, destFileName);
			const relPath = path.join('chat_toys', destFileName).replace(/\\/g, '/');

			// If it already exists, we don't need to recopy it
			if (fs.existsSync(destPath)) {
				return {
					success: true,
					destPath,
					relPath,
				};
			}

			// Resolve source path
			let sourcePath;

			if (internal) {
				// Built-in asset
				sourcePath = path.join(BUILTIN_DIR, name);
			} else {
				// Custom asset in userData/custom_assets
				// AssetManager gives id = uuid.ext and file_path = "live/custom_assets/uuid.ext" 
				sourcePath = path.join(ASSET_DIR, id);
			}

			if (!fs.existsSync(sourcePath)) {
				return {
					success: false,
					error: `Source asset not found: ${sourcePath}`,
				};
			}

			// Copy the file
			fs.copyFileSync(sourcePath, destPath);

			return {
				success: true,
				destPath,
				relPath,
			};

		} catch (err) {

			console.error('[VTSFileBridge] Failed to copy asset:', err);
			return {
				success: false,
				error: err.message || String(err),
			};
		}
	});
}

module.exports = {
	setupVTSFileBridge,
	BUILTIN_DIR,
};
