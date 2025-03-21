/*
	AssetsManager.js
	----------------

	This will handle custom imported and built-in files for the extension,
	that the user can access as 'assets' in the extension.

	IMPORTANT NOTE:
	---------------

	I 100% realize that the methods used in this file are not the best way to handle
	a database of files.

	In practical reality, I highly doubt any users are going to have more than a few
	assets loaded in. Maybe a couple hundred at most, so running a .map() over the
	assets array is not going to be a performance bottleneck.

	However, this is basically a super scuffed database in essence, and I'm sure
	there's probably a better solution. At the time of writing this works for now,
	and since it's not a bottleneck yet, I'm not going to worry about it.

	But yeah, if you're reading this and you're like "wtf is this guy doing",
	just know that I know it's not the best way, but it works for now.
*/

// vue
import { chromeRef, chromeShallowRef } from "../chromeRef";

// lib/misc
import { v4 as uuidv4 } from 'uuid';
import { openDB } from 'idb';

// AssetManager class
export class AssetManager {

	/**
	 * Constructor
	 */
	constructor() {

		// w'll use chromeRef to store the assets in the chrome storage / local storage
		this.assets = chromeShallowRef('assets', this.preprocessAssets(builtInAssets));

		window.am = this;
	}


	/**
	 * Adds some default values to the hard-coded assets list
	 * 
	 * @param {Array<Object>} assets - the hard coded assets list
	 * @returns {Array<Object>} - the preprocessed assets list
	 */
	preprocessAssets(assets) {

		// map over the assets and add an internal flag to them
		return assets.map(asset => (
			{
				...asset,
				id: asset.id.toString(),
				internal: true,
				file_path: null,
			}));
	}


	/**
	 * Search for assets
	 * 
	 * @param {object} options - either a string or an object with query, tag, kind, sortKey, desc
	 * @returns {array} - array of assets
	 */
	search(options) {

		// start with all assets
		let results = [...this.assets.value];

		// if we got a string, do a simple name filter only
		if (typeof options === 'string') {
			results = results.filter(asset => asset.name.includes(options));

			// otherwise, run a gauntlet of filters based on the various options
		} else {
			if (options.query)
				results = results.filter(asset => asset.name.includes(options.query));

			if (options.tag)
				results = results.filter(asset => asset.tags.includes(options.tag));

			if (options.kind)
				results = results.filter(asset => asset.kind === options.kind);

			if (options.sortKey) {
				results.sort((a, b) => (a[options.sortKey] > b[options.sortKey] ? 1 : -1));
				if (options.desc) results.reverse();
			}
		}
		return results;
	}


	/**
	 * Removes an asset from the asset list, by id
	 * 
	 * @param {Any} id - the ID of the asset to remove
	 */
	remove(id) {
		this.assets.value = this.assets.value.filter(asset => asset.id !== id);
	}


	/**
	 * Edit an asset in the asset list
	 * 
	 * @param {Any} id - the ID of the asset to edit
	 * @param {Any} keyOrChanges - either a key to change, or an object of changes
	 * @param {Any} newValue - if keyOrChanges is a key, the new value to set
	 */
	edit(id, keyOrChanges, newValue) {

		// map over the assets, and if we find the one we're looking for, update it
		this.assets.value = this.assets.value.map(asset => {

			// if we found the asset, update it
			if (asset.id === id) {

				if (typeof keyOrChanges === 'object') {
					return { ...asset, ...keyOrChanges };

				} else if (newValue !== undefined) {
					return { ...asset, [keyOrChanges]: newValue };
				}
				return keyOrChanges;
			}
			return asset;
		});
	}


	/**
	 * gets a persistent file handle
	 * 
	 * @param {Any} filePath - the path to the file
	 * @returns {Any|null} - the file handle, or null if not found
	 */
	async _getPersistentFileHandle(filePath) {

		// Fallback for browsers that don't support it
		if (!window.showOpenFilePicker)
			return null;

		try {
			const [fileHandle] = await window.showOpenFilePicker();
			return await fileHandle.getFile();

		} catch (error) {
			console.error('Error retrieving file handle:', error);
			return null;
		}
	}


	/**
	 * For debug, reset the files to the built-in assets
	 */
	resetFiles() {
		this.assets.value = this.preprocessAssets(builtInAssets);
	}


	/**
	 * Stores file handle to DB
	 * 
	 * @param {String} id - the ID of the file handle to store	
	 * @param {*} fileHandle - the file handle to store
	 */
	async storeFileHandle(id, fileHandle) {
		const db = await this.openDB();
		const tx = db.transaction("fileHandles", "readwrite");
		tx.objectStore("fileHandles").put(fileHandle, id);
		await tx.done;
	}


	/**
	 * IndexedDB utility function to retrieve file handles
	 * 
	 * @param {String} id - ID of file to recover
	 * @returns File handle
	 */
	async getFileHandle(id) {
		const db = await this.openDB();
		const tx = db.transaction("fileHandles", "readonly");
		return await tx.objectStore("fileHandles").get(id);
	}


	/**
	 * Opens database for files
	 * 
	 * @returns {Promise<IDBDatabase>} - the opened database
	 */
	async openDB() {
		return await openDB("AssetManagerDB", 1, {
			upgrade(db) {
				if (!db.objectStoreNames.contains("fileHandles")) {
					db.createObjectStore("fileHandles");
				}
			},
		});
	}


	/**
	 * Imports files from the user's system.
	 * 
	 * @param {string} kind - One of 'image', '3d', 'sound', or 'any'
	 * @param {boolean} [multi=false] - Whether multiple files can be selected
	 * @returns {Promise<Array<string>|null>} - Array of new asset IDs, or null if cancelled
	 */
	async importFiles(kind, multi = false) {

		if (!window.showOpenFilePicker) {
			console.error('File picker API not supported.');
			return null;
		}

		const fileTypes = {
			'image': ['image/png', 'image/gif'],
			'3d': ['model/gltf-binary'],
			'sound': ['audio/mpeg', 'audio/wav'],
			'any': ['image/png', 'image/gif', 'model/gltf-binary', 'audio/mpeg', 'audio/wav']
		};


		const options = {
			types: [{
				description: kind.charAt(0).toUpperCase() + kind.slice(1) + ' Files',
				accept: fileTypes[kind] ? fileTypes[kind].reduce((acc, type) => { acc[type] = []; return acc; }, {}) : {}
			}],
			multiple: multi
		};


		try {
			const fileHandles = await window.showOpenFilePicker(options);
			const newAssets = await Promise.all(fileHandles.map(async fileHandle => {
				const file = await fileHandle.getFile();
				const id = uuidv4();

				// Store file handle in IndexedDB
				await this.storeFileHandle(id, fileHandle);

				return {
					id,
					name: file.name,
					kind: kind,
					tags: [],
					internal: false,
					file_path: id // Store only the ID reference in localStorage
				};
			}));

			this.assets.value = [...this.assets.value, ...newAssets];
			return newAssets.map(asset => asset.id);
		} catch (error) {
			console.error('File selection cancelled or failed:', error);
			return null;
		}
	}


	/**
	 * Retrieves the data for a given asset ID.
	 * 
	 * @param {string} id - The asset ID
	 * @returns {Object|null} - The asset data, or null if not found
	 */
	getFileData(id){
		return this.assets.value.find(asset => asset.id === id);			
	}


	/**
	 * Retrieves a file for a given asset ID.
	 * 
	 * @param {string} id - The asset ID
	 * @returns {Promise<File|null>} - The file, or null if not found
	 */
	async getFile(id) {
		const asset = this.assets.value.find(a => a.id === id);
		if (!asset) return null;

		// If asset is internal, fetch it from the public folder
		if (asset.internal) {
			const fileUrl = `/builtin/${asset.name}`;
			try {
				const response = await fetch(fileUrl);
				if (!response.ok) throw new Error(`Failed to fetch file: ${response.statusText}`);

				const blob = await response.blob();
				return new File([blob], asset.name, { type: blob.type });
			} catch (error) {
				console.error(`Error fetching internal asset: ${error}`);
				return null;
			}
		}

		// Otherwise, proceed with retrieving a file handle for external assets
		let fileHandle = await this.getFileHandle(id);
		if (!fileHandle) return null;

		try {
			return await fileHandle.getFile();
		} catch (error) {
			console.warn('Failed to retrieve file:', error);

			// If permission is denied, request the user to reselect the file
			if (error.name === "NotAllowedError") {
				try {
					const options = {
						types: [{
							description: `${asset.kind.charAt(0).toUpperCase() + asset.kind.slice(1)} Files`,
							accept: { [`${this.getMimeType(asset.kind)}`]: [] }
						}],
						multiple: false
					};

					[fileHandle] = await window.showOpenFilePicker(options);
					await this.storeFileHandle(id, fileHandle);
					return await fileHandle.getFile();
				} catch (pickerError) {
					console.error('User did not reauthorize file access:', pickerError);
					return null;
				}
			}

			return null;
		}
	}


	/**
	 * Maps asset kind to MIME types
	 * 
	 * @param {string} kind - The asset kind
	 * @returns {string} - Corresponding MIME type
	 */
	getMimeType(kind) {

		const mimeTypes = {
			'image': 'image/png',
			'3d': 'model/gltf-binary',
			'sound': 'audio/mpeg',
			'any': '*/*'
		};

		return mimeTypes[kind] || '*/*';
	}

}


// built-in assets for the extension
const builtInAssets = [
	{
		id: 1,
		name: 'point_icon_1.png',
		kind: 'image',
		tags: ['points'],
	},
	{
		id: 2,
		name: 'point_icon_2.png',
		kind: 'image',
		tags: ['points'],
	},
	{
		id: 3,
		name: 'chat_frame_1.png',
		kind: 'image',
		tags: ['chat'],
	},
	{
		id: 4,
		name: 'chat_frame_2.png',
		kind: 'image',
		tags: ['chat'],
	},
	{
		id: 5,
		name: 'wheel_frame.png',
		kind: 'image',
		tags: ['wheel'],
	},
	{
		id: 6,
		name: 'yay.gif',
		kind: 'image',
		tags: ['media'],
	},
	{
		id: 7,
		name: 'sad.gif',
		kind: 'image',
		tags: ['media'],
	},
	{
		id: 20,
		name: 'headpat-hand.gif',
		kind: 'image',
		tags: ['media'],
	},
	{
		id: 8,
		name: 'fish_big.png',
		kind: 'image',
		tags: ['fish'],
	},
	{
		id: 9,
		name: 'fish_medium.png',
		kind: 'image',
		tags: ['fish'],
	},
	{
		id: 10,
		name: 'fish_small.png',
		kind: 'image',
		tags: ['fish'],
	},
	{
		id: 11,
		name: 'pop.mp3',
		kind: 'sound',
		tags: ['sfx'],
	},
	{
		id: 12,
		name: 'click.mp3',
		kind: 'sound',
		tags: ['sfx', 'wheel'],
	},
	{
		id: 13,
		name: 'yay.mp3',
		kind: 'sound',
		tags: ['sfx'],
	},
	{
		id: 14,
		name: 'sad.mp3',
		kind: 'sound',
		tags: ['sfx'],
	},
	{
		id: 15,
		name: 'splat.mp3',
		kind: 'sound',
		tags: ['sfx'],
	},
	{
		id: 16,
		name: 'tomato.glb',
		kind: '3d',
		tags: ['toss'],
	},
	{
		id: 17,
		name: 'pie.glb',
		kind: '3d',
		tags: ['toss'],
	},
	{
		id: 18,
		name: 'wad.glb',
		kind: '3d',
		tags: ['toss'],
	},
	{
		id: 19,
		name: 'buddy.fbx',
		kind: '3d',
		tags: ['buddies'],
	},
];
