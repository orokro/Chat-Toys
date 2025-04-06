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
import { ref, shallowRef } from "vue";
import { chromeRef, chromeShallowRef } from "../chromeRef";

// lib/misc
import { v4 as uuidv4 } from 'uuid';

// AssetManager class
export class AssetManager {

	/**
	 * Constructor
	 */
	constructor() {

		// get our built-in assets, pre-processed on start up
		this.builtInAssets = this.preprocessAssets(builtInAssets);

		// ask database for any files the user has previously imported
		this.userAssets = this.formatUserAssets(window.assetDB.getAllAssets());

		// we'll keep a list of all the assets in the front-end as a shallow ref
		this.assets = shallowRef([...this.builtInAssets, ...this.userAssets]);

		// for debug
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
	 * Formats results from the database in a way that the front-end can use
	 * 
	 * @param {Array<Object>} assets 
	 * @returns {Array<Object>} - the formatted assets list
	 */
	formatUserAssets(assets) {

		return assets.map(asset => {
			return {
				id: asset.uuid,
				name: asset.original_name,
				kind: asset.type,
				tags: [],
				internal: false,
				file_path: `custom_assets/${asset.uuid}.${asset.extension}`,
			};
		});
	}


	/**
	 * Refreshes the list of files in the asset manager
	 */
	refreshAssetsFromDB() {

		// re-merge in database results
		this.userAssets = this.formatUserAssets(window.assetDB.getAllAssets());
		this.assets.value = [...this.builtInAssets, ...this.userAssets];
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

		// remove from database & refresh the list
		window.assetDB.removeAsset(id);
		this.refreshAssetsFromDB();
	}


	/**
	 * For debug, reset the files to the built-in assets
	 */
	resetFiles() {
		this.assets.value = this.preprocessAssets(builtInAssets);
	}


	/**
	 * Retrieves the data for a given asset ID.
	 * 
	 * @param {string} id - The asset ID
	 * @returns {Object|null} - The asset data, or null if not found
	 */
	getFileData(id) {
		return this.assets.value.find(asset => asset.id === id);
	}


	/**
	 * Retrieves a file for a given asset ID.
	 * 
	 * @param {string} id - The asset ID
	 * @returns {Promise<File|null>} - The file, or null if not found
	 */
	async getFile(id) {

		return null;
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


	/**
	 * Imports a file from the user
	 */
	async importFiles() {

		// show the file picker dialog
		const meta = await window.electronAPI.invoke('import-asset');

		// if we got a file, we'll add it to the database & return it's data
		if (meta) {

			// add to DB & refresh the list
			await window.assetDB.addAsset(meta);
			this.refreshAssetsFromDB();

			// return to caller
			return meta;
		}

		return null;
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
	{
		id: 20,
		name: 'headpat-hand.gif',
		kind: 'image',
		tags: ['media'],
	},
	{
		id: 21,
		name: 'fish_boot.png',
		kind: 'image',
		tags: ['fish'],
	},
	{
		id: 22,
		name: 'generic_chat.png',
		kind: 'image',
		tags: ['chat'],
	}
];
