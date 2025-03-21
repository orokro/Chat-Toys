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

// AssetManager class
export class AssetManager {

	/**
	 * Constructor
	 */
	constructor() {

		// w'll use chromeRef to store the assets in the chrome storage / local storage
		this.assets = chromeShallowRef('assets', this.preprocessAssets(builtInAssets));
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
			
			if (options.sortKey){
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
	 * Gets File for a specific asset ID
	 * 
	 * @param {Any} id - the ID of the asset to get the file for
	 * @returns {Any} - the file, if found
	 */
	getFile(id) {

		const asset = this.assets.value.find(asset => asset.id === id);
		if (!asset) return null;
		
		if (asset.internal) {
			return `/assets/${asset.kind}/${asset.name}.${asset.kind === 'sound' ? 'mp3' : asset.kind === 'image' ? 'png' : 'glb'}`;
		}
		
		if (asset.file_path) {
			return this._getPersistentFileHandle(asset.file_path);
		}
		
		return null;
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

}

// built-in assets for the extension
const builtInAssets = [
	{
		id: 1,
		name: 'point_icon_1',
		kind: 'image',
		tags: ['points'],
	},
	{
		id: 2,
		name: 'point_icon_2',
		kind: 'image',
		tags: ['points'],
	},
	{
		id: 3,
		name: 'chat_frame_1',
		kind: 'image',
		tags: ['chat'],
	},
	{
		id: 19,
		name: 'chat_frame_2',
		kind: 'image',
		tags: ['chat'],
	},
	{
		id: 4,
		name: 'wheel_frame',
		kind: 'image',
		tags: ['wheel'],
	},
	{
		id: 5,
		name: 'yay',
		kind: 'image',
		tags: ['media'],
	},
	{
		id: 6,
		name: 'sad',
		kind: 'image',
		tags: ['media'],
	},
	{
		id: 7,
		name: 'buddy_sprites',
		kind: 'image',
		tags: ['buddies'],
	},
	{
		id: 8,
		name: 'fish_big',
		kind: 'image',
		tags: ['fish'],
	},
	{
		id: 9,
		name: 'fish_medium',
		kind: 'image',
		tags: ['fish'],
	},
	{
		id: 10,
		name: 'fish_small',
		kind: 'image',
		tags: ['fish'],
	},
	{
		id: 11,
		name: 'pop',
		kind: 'sound',
		tags: ['sfx'],
	},
	{
		id: 12,
		name: 'click',
		kind: 'sound',
		tags: ['sfx', 'wheel'],
	},
	{
		id: 13,
		name: 'yay',
		kind: 'sound',
		tags: ['sfx'],
	},
	{
		id: 14,
		name: 'sad',
		kind: 'sound',
		tags: ['sfx'],
	},
	{
		id: 15,
		name: 'splat',
		kind: 'sound',
		tags: ['sfx'],
	},
	{
		id: 16,
		name: 'tomato',
		kind: '3d',
		tags: ['toss'],
	},
	{
		id: 17,
		name: 'pie',
		kind: '3d',
		tags: ['toss'],
	},
	{
		id: 18,
		name: 'wad',
		kind: '3d',
		tags: ['toss'],
	},
];

export default AssetManager;
