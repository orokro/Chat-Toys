/*
	importAsset.js
	--------------

	This file sets up the code to show a file picker we can invoke
	from the front end so the user can import assets.
*/
const { dialog, app, ipcMain, BrowserWindow } = require('electron');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');

// make a folder for our assets in the user data directory
const ASSET_DIR = path.join(app.getPath('userData'), 'custom_assets');
if (!fs.existsSync(ASSET_DIR)) fs.mkdirSync(ASSET_DIR, { recursive: true });

/**
 * Sets up the IPC handler for importing assets.
 * This will show a file picker dialog
 * and return the selected file's data.
 * 
 * @param {BrowserWindow} win - window to show the dialog in
 */
function setupAssetImportHandler(win) {

	// listen for the import-asset event
	ipcMain.handle('import-asset', async () => {

		// show the file picker dialog with the supported file types
		const { canceled, filePaths } = await dialog.showOpenDialog(win, {
			filters: [{ name: 'Supported Files', extensions: ['png', 'gif', 'mp3', 'wav', 'glb', 'fbx'] }],
			properties: ['openFile']
		});

		// if the user canceled or no files were selected, GTFO
		if (canceled || !filePaths.length)
			return null;

		// break out the data from the first file & give it a unique UUID
		const originalPath = filePaths[0];
		const ext = path.extname(originalPath).slice(1);
		const uuid = `${uuidv4()}.${ext}`;
		const targetPath = path.join(ASSET_DIR, uuid);

		console.log('importing asset', originalPath, '->', targetPath);
		
		// move file to the assets directory
		// if the file already exists, we'll overwrite it
		fs.copyFileSync(originalPath, targetPath);

		// return the packaged data to the renderer
		return {
			uuid,
			originalName: path.basename(originalPath),
			extension: ext,
			type: ['png', 'gif'].includes(ext) ? 'image' :
				['mp3', 'wav'].includes(ext) ? 'sound' :
					'3d',
		};
	});
}

module.exports = { setupAssetImportHandler, ASSET_DIR };
