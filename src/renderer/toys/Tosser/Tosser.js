/*
	Tosser.js
	---------

	This class handles the state for the Tosser toy system.

	NOTE: it does not handle the rendering, which will be the Tosser widgets.
*/

// vue
import { ref, shallowRef, watch } from 'vue';
import { socketRef, socketShallowRef, socketShallowRefAsync, bindRef } from 'socket-ref';

// lib/misc
import { v4 as uuidv4 } from 'uuid';

// our app
import Toy from "../Toy";

// components
import TosserPage from './TosserPage.vue';
import TosserWidget from './TosserWidget.vue';

// main export
export default class Tosser extends Toy {

	// static info
	static name = 'Tosser';
	static slug = 'tosser';
	static desc = 'Let viewers toss objects onto your stream.';
	static optionsPageComponent = TosserPage;
	static themeColor = '#E65A5A';

	// Tosser ships with no built-in commands - the user wires their own
	// custom commands to each tossable item. The master Commands page
	// reads this flag to decide whether to show the toy even when its
	// localCommandsList is empty.
	static enableCustomCommands = true;
	static widgetComponents = [
		{
			component: TosserWidget,
			key: 'widgetBox',
			allowResize: true,
			lockAspectRatio: false,
			description: `
				This should be a browser source layer that is full screen. 
				It shows the 3d objects tossed at the set collider.`,
			slug: 'tosserLayer'
		}
	];


	/**
	 * Constructs the Tosser object
	 * 
	 * @param {ToyManager} toyManager - reference to the toy manager
	 */
	constructor(toyManager) {

		// call the parent constructor
		super(toyManager);

		// list of tosses to perform
		this.tossQueue = socketShallowRef(this.static.slugify('tossQueue'), []);

		// reset the toss queue
		this.resetTimeout = window.setElectronTimeout(() => {
			this.tossQueue.value = [];
		}, 2000);

		// ---- collider auto-tracking ----
		this.obs = this.chatToysApp.obsConnMgr;
		this.vts = this.chatToysApp.vtsConnMgr;

		// Normalized (0..1 of the OBS canvas) collider box published to the
		// widget when an auto-tracking mode is active. valid=false means the
		// widget should fall back to its manual collider.
		this.autoCollider = socketShallowRef(this.static.slugify('autoCollider'), {
			valid: false, x: 0, y: 0, width: 0, height: 0,
		});

		// cached normalized OBS source rect (recomputed on OBS events only)
		this._obsRect = null;
		this._obsRefreshPending = false;
		this._publishPending = false;
		this._trackUnsubs = [];
		this._heartbeat = null;
		this._onModelMoved = () => this.scheduleColliderPublish();

		// Which tracked source is currently driving the collider (the first
		// one found in the live scene), so the settings list can highlight it.
		this.activeTrackedSource = ref(null);

		// (re)wire tracking now and whenever the mode / tracked sources change
		this.setupTracking();
		this.stopTrackWatch = watch(
			[this.settings.trackingMode, this.settings.trackingObsSources],
			() => this.setupTracking(),
			{ deep: true }
		);
	}


	/**
	 * Perform clean up when the toy is destroyed
	 */
	end(){
		super.end();
		window.clearElectronTimeout(this.resetTimeout);
		this.teardownTracking();
		if (this.stopTrackWatch)
			this.stopTrackWatch();
	}


	// =====================================================================
	// Collider auto-tracking (OBS source rect [+ VTS model] -> normalized box)
	// =====================================================================

	/**
	 * Wire up the tracking listeners for the current mode. Idempotent.
	 */
	setupTracking() {

		this.teardownTracking();

		const mode = this.settings.trackingMode.value;
		if (mode === 'manual') {
			// tell the widget to use its manual collider
			this.autoCollider.value = { valid: false, x: 0, y: 0, width: 0, height: 0 };
			return;
		}

		// OBS source rect changes: re-read on transform / scene / (re)connect
		if (this.obs) {
			this._trackUnsubs.push(this.obs.on('obs-scene-item-transform', () => this.scheduleObsRefresh()));
			this._trackUnsubs.push(this.obs.on('obs-scene-changed', () => this.scheduleObsRefresh()));
			this._trackUnsubs.push(this.obs.on('obs-connected', () => this.scheduleObsRefresh()));
		}

		// VTS model movement only matters when composing with VTS
		if (mode === 'obsVts' && this.vts) {
			this.vts.onModelMoved(this._onModelMoved);
			this._trackUnsubs.push(() => this.vts.offModelMoved(this._onModelMoved));
		}

		// initial read
		this.refreshObsRect();

		// Heartbeat re-publish (~1Hz) so a late-joining / reloaded widget
		// always converges on the current box — socket-ref doesn't replay the
		// last value to subscribers that connect after the write. Cheap: uses
		// the cached OBS rect, no OBS calls.
		this._heartbeat = window.setElectronInterval(() => this.publishCollider(), 1000);
	}


	/**
	 * Drop all tracking listeners + cached state.
	 */
	teardownTracking() {
		if (this._heartbeat) {
			window.clearElectronInterval(this._heartbeat);
			this._heartbeat = null;
		}
		for (const u of this._trackUnsubs || []) {
			try { u(); } catch { /* ignore */ }
		}
		this._trackUnsubs = [];
		this._obsRect = null;
	}


	/**
	 * Coalesce rapid OBS transform events into one rect refresh (~80ms).
	 */
	scheduleObsRefresh() {
		if (this._obsRefreshPending)
			return;
		this._obsRefreshPending = true;
		window.setElectronTimeout(() => {
			this._obsRefreshPending = false;
			this.refreshObsRect();
		}, 80);
	}


	/**
	 * Read the chosen OBS source's on-canvas rectangle, normalize it to the
	 * canvas size, cache it, and publish the resulting collider.
	 */
	async refreshObsRect() {

		const mode = this.settings.trackingMode.value;
		if (mode === 'manual')
			return;

		const sources = this.settings.trackingObsSources.value || [];
		if (!this.obs || !this.obs.isConnected.value || sources.length === 0) {
			this._obsRect = null;
			this.activeTrackedSource.value = null;
			this.publishCollider();
			return;
		}

		// Find (in tracked-list priority order) the first source present in the
		// current scene's hierarchy, even if nested in a group / nested scene.
		const sceneName = await this.obs.getCurrentSceneName();
		if (!sceneName) {
			this._obsRect = null;
			this.activeTrackedSource.value = null;
			this.publishCollider();
			return;
		}

		let tree = this.obs.sourceCache.value?.trees?.[sceneName];
		if (!tree) {
			await this.obs.buildSourceCache();
			tree = this.obs.sourceCache.value?.trees?.[sceneName] || [];
		}

		const path = this._findTrackedPath(tree, sceneName, sources);
		if (!path) {
			this._obsRect = null;
			this.activeTrackedSource.value = null;
			this.publishCollider();
			return;
		}

		// fetch each path item's transform (leaf last)
		const transforms = [];
		for (const step of path) {
			const t = await this.obs.getSceneItemTransformById(step.container, step.id);
			if (!t) {
				this._obsRect = null;
				this.activeTrackedSource.value = null;
				this.publishCollider();
				return;
			}
			transforms.push(t);
		}

		const canvas = await this.obs.getVideoSettings();
		if (!canvas || !canvas.baseWidth || !canvas.baseHeight) {
			this._obsRect = null;
			this.publishCollider();
			return;
		}

		// compose the path into an absolute canvas rect, then normalize
		const px = this._composePath(transforms);
		this._obsRect = {
			x: px.x / canvas.baseWidth,
			y: px.y / canvas.baseHeight,
			width: px.width / canvas.baseWidth,
			height: px.height / canvas.baseHeight,
		};
		this.activeTrackedSource.value = path[path.length - 1].name;
		this.publishCollider();
	}


	/**
	 * Find a path (tracked-list priority order) to the first tracked source
	 * present anywhere in the scene tree. Returns the root..leaf path or null.
	 *
	 * @param {Array<Object>} tree - cached scene tree nodes
	 * @param {string} sceneName - the root container (scene) name
	 * @param {Array<string>} sourcesInOrder - tracked names, priority order
	 * @returns {Array<{container:string, id:number, name:string}>|null}
	 */
	_findTrackedPath(tree, sceneName, sourcesInOrder) {
		for (const name of sourcesInOrder) {
			const p = this._findPathToName(tree, sceneName, name);
			if (p) return p;
		}
		return null;
	}


	/**
	 * DFS for a named source, recording the container path from scene root.
	 *
	 * @param {Array<Object>} nodes
	 * @param {string} container - the container these nodes live in
	 * @param {string} targetName
	 * @returns {Array<{container:string, id:number, name:string}>|null}
	 */
	_findPathToName(nodes, container, targetName) {
		for (const node of nodes) {
			if (node.name === targetName)
				return [{ container, id: node.id, name: node.name }];
			if (Array.isArray(node.children) && node.children.length) {
				const sub = this._findPathToName(node.children, node.name, targetName);
				if (sub)
					return [{ container, id: node.id, name: node.name }, ...sub];
			}
		}
		return null;
	}


	/**
	 * Visible (crop-aware) rect of an item in ITS PARENT's coordinate space,
	 * in pixels. OBS `width`/`height` ignore crop, so derive the size from
	 * sourceWidth/Height minus crop, times scale. Rotation ignored (v1).
	 *
	 * @param {Object} t - sceneItemTransform
	 * @returns {{x:number, y:number, width:number, height:number}}
	 */
	_visibleRectPx(t) {
		const sx = (typeof t.scaleX === 'number') ? t.scaleX : 1;
		const sy = (typeof t.scaleY === 'number') ? t.scaleY : 1;
		const sw = (typeof t.sourceWidth === 'number' && t.sourceWidth > 0) ? t.sourceWidth : (sx ? (t.width || 0) / sx : 0);
		const sh = (typeof t.sourceHeight === 'number' && t.sourceHeight > 0) ? t.sourceHeight : (sy ? (t.height || 0) / sy : 0);

		const cl = t.cropLeft || 0, cr = t.cropRight || 0, ct = t.cropTop || 0, cb = t.cropBottom || 0;
		const visW = Math.max(0, (sw - cl - cr) * sx);
		const visH = Math.max(0, (sh - ct - cb) * sy);

		// OBS alignment bits: LEFT=1, RIGHT=2, TOP=4, BOTTOM=8 (CENTER=0)
		const a = t.alignment || 0;
		let left;
		if (a & 1) left = t.positionX;
		else if (a & 2) left = t.positionX - visW;
		else left = t.positionX - visW / 2;
		let top;
		if (a & 4) top = t.positionY;
		else if (a & 8) top = t.positionY - visH;
		else top = t.positionY - visH / 2;

		return { x: left, y: top, width: visW, height: visH };
	}


	/**
	 * Map a rect expressed in a CONTAINER's local content space up into the
	 * container's parent space, using the container's own transform.
	 *
	 * @param {{x:number,y:number,width:number,height:number}} rect
	 * @param {Object} t - the container item's transform (in its parent)
	 * @returns {{x:number,y:number,width:number,height:number}}
	 */
	_mapThroughContainer(rect, t) {
		const sx = (typeof t.scaleX === 'number') ? t.scaleX : 1;
		const sy = (typeof t.scaleY === 'number') ? t.scaleY : 1;
		const cl = t.cropLeft || 0, ct = t.cropTop || 0;
		const cont = this._visibleRectPx(t);
		return {
			x: cont.x + (rect.x - cl) * sx,
			y: cont.y + (rect.y - ct) * sy,
			width: rect.width * sx,
			height: rect.height * sy,
		};
	}


	/**
	 * Compose a path of transforms (root..leaf) into an absolute canvas rect.
	 *
	 * @param {Array<Object>} transforms - one per path step, leaf last
	 * @returns {{x:number,y:number,width:number,height:number}}
	 */
	_composePath(transforms) {
		if (!transforms.length)
			return { x: 0, y: 0, width: 0, height: 0 };

		// leaf's visible rect, expressed in its immediate container's space
		let rect = this._visibleRectPx(transforms[transforms.length - 1]);

		// map up through each container (leaf-1 .. root)
		for (let k = transforms.length - 2; k >= 0; k--)
			rect = this._mapThroughContainer(rect, transforms[k]);

		return rect;
	}


	/**
	 * Coalesce rapid VTS model-moved events into one publish (~40ms).
	 */
	scheduleColliderPublish() {
		if (this._publishPending)
			return;
		this._publishPending = true;
		window.setElectronTimeout(() => {
			this._publishPending = false;
			this.publishCollider();
		}, 40);
	}


	/**
	 * Compose the cached OBS rect (and, in obsVts mode, the live VTS model
	 * transform) into the final normalized collider and publish it.
	 *
	 * NOTE: the VTS mapping here is a first cut and will need on-device tuning
	 * (normalized range, y-axis, and hitbox size are approximate).
	 */
	publishCollider() {

		const mode = this.settings.trackingMode.value;

		if (mode === 'manual' || !this._obsRect) {
			this.autoCollider.value = { valid: false, x: 0, y: 0, width: 0, height: 0 };
			return;
		}

		let box = { ...this._obsRect };

		if (mode === 'obsVts' && this.vts) {
			const m = this.vts.modelTransform;
			if (m && m.written) {
				// map VTS model position (-1..1, y up) into the source rect
				const cx = box.x + ((m.positionX + 1) / 2) * box.width;
				const cy = box.y + (1 - (m.positionY + 1) / 2) * box.height;
				const cw = box.width * 0.4 * (m.scale || 1);
				const ch = box.height * 0.5 * (m.scale || 1);
				box = { x: cx - cw / 2, y: cy - ch / 2, width: cw, height: ch };
			}
		}

		this.autoCollider.value = { valid: true, ...box };
	}


	/**
	 * Initialize the settings for this toy
	 */
	initSettings() {

		// tosser settings
		this.buildSettingsBlock({

			// list of items that can be tossed
			tosserAssets: ref([
				{
					model: "16",
					modelPath: this.getAssetPath('16'),
					sound: "15",
					soundPath: this.getAssetPath('15'),
					scale: 1,
					slug: "tomato",
					cmd: "tomato",
				},
				{
					model: "18",
					modelPath: this.getAssetPath('18'),
					sound: "15",
					soundPath: this.getAssetPath('15'),
					scale: 1,
					slug: "wad",
					cmd: "paper",
				}
			]),
			randomTossMode: ref(true),
			tossSpeed: ref(1),
			allEmojisToBeTossed: ref(true),
			soundVolume: ref(1),

			// Collider tracking (VTS/OBS-aware). 'manual' = today's behavior
			// (drag the silhouette in OBS). 'obs' = follow a chosen OBS source's
			// rectangle. 'obsVts' = OBS source rect composed with the live VTS
			// model transform. The OBS source name the avatar/VTS capture lives in.
			trackingMode: ref('manual'),

			// List of OBS source names to track. At runtime the FIRST one
			// present in the current program scene wins, so switching scenes
			// (with differently-placed / differently-named avatar sources)
			// just works. Replaces the old single `trackingObsSource`.
			trackingObsSources: ref([]),

			// When an auto mode is active, overlay the tracked collider on the
			// widget so the user can see where hits register (testing aid).
			showColliderDebug: ref(false),

			widgetBox: shallowRef({
				x: 20,
				y: 20,
				width: 1880,
				height: 1040
			}),

		});
	}


	/**
	 * Initialize the commands for this toy
	 */
	buildCommands() {

		super.buildCommands([
			{
				command: 'toss',
				params: [
					{ name: 'item', type: 'string', optional: true, desc: 'Which item to toss' },
				],
				description: 'Lets the toss an item!',
				userDesc: 'Toss at item at a user! (Optionally specify the item)',
				tipText: 'Throw something at the streamer with {cmd}, or at another chatter: {cmd} @user',
			},
		]);
	}
	

	/**
	 * Handle when an incoming command is sent to this toy
	 * 
	 * @param {String} commandSlug - the slug of the command
	 * @param {Object} msg - details about the chat message that invoked the command
	 * @param {Object} user - details about the user that invoked the command (could be dummy if not in database yet)
	 * @param {Object} params - the parameters passed to the command
	 * @param {Object} handshake - object like { accept: Function, reject: Function } to accept or reject the command
	 */
	onCommand(commandSlug, msg, user, params, handshake) {

		// if we don't have any tosser assets, then we can't toss anything
		if(this.settings.tosserAssets.value.length === 0) {
			this.chatToysApp.log.error('Toss command failed, no tossable items found');
			handshake.reject();
			return;
		}

		// if the slug iis 'toss' then we need to check for parameters
		if(commandSlug === 'toss') {

			// check if there's emojis in the message, if so, we toss a random item
			const extractedEmojis = this.extractEmojisFromMsg(msg);
			if(extractedEmojis.length > 0 && this.settings.allEmojisToBeTossed.value === true) {

				// get the emoji - either the char or a link to the image
				const firstEmoji = extractedEmojis[0];
				const string = firstEmoji.kind === 'image' ? firstEmoji.url : firstEmoji.char;

				// toss the emoji item
				this.tossItem(msg, string, true);
				handshake.accept();
				return;
			}

			// if item is undefined, toss random/unspecified & gtfo
			if(params.item === undefined) {
				this.tossUnspecifiedItem(msg);
				handshake.accept();
				return;
			}

			// check if the item is in the list of tossable items
			const matchItemSlug = params.item.toLowerCase();
			const tossableItem = this.settings.tosserAssets.value.find(item => item.slug === matchItemSlug);
			if(tossableItem !== undefined) {
				this.tossItem(msg, tossableItem.slug);
				handshake.accept();
				return;
			} 

			// otherwise we got TOSS and either there was no item, or it was invalid
			// so we can just toss a random item
			this.chatToysApp.log.msg(msg.author + ' chose invalid item, tossing random item instead');
			handshake.accept();
		}

		// if it wasn't specifically toss, then it's a custom user command, we need to get it's full data
		const fullCommandData = this.chatToysApp.commands.value[this.slug+'__'+commandSlug];
		const command = fullCommandData.command;
		const tossObject = this.settings.tosserAssets.value.find(item => item.cmd === command);

		// if un found, then we need to toss an unspecified item
		if(tossObject === undefined) {
			this.tossUnspecifiedItem(msg);
			handshake.accept();
			return;
		}

		// get it's slug & toss that sum-bitch
		const itemSlug = tossObject.slug;
		this.tossItem(msg, itemSlug);

		// accept the command which updates the database
		handshake.accept();
	}


	/**
	 * Tosses a random item, or the first item
	 * 
	 * @param {Object} msg - message object
	 */
	tossUnspecifiedItem(msg){

		// pick a random slug if non specified
		let randomIndex = Math.floor(Math.random() * this.settings.tosserAssets.value.length);

		// note: if random mode isn't enabled, we'll just pick the first item
		if(this.settings.randomTossMode.value === false)
			randomIndex = 0;

		// get the random item (or first item if random mode is disabled)
		const randomItem = this.settings.tosserAssets.value[randomIndex];
		const slug = randomItem.slug;

		// use regular method
		this.tossItem(msg, slug);
	}


	/**
	 * Tosses an item
	 * 
	 * @param {Object} msg - message object
	 * @param {String} itemSlug - item to toss
	 * @param {Boolean} isEmoji - whether the item is an emoji
	 */
	tossItem(msg, itemSlug, isEmoji = false) {

		// add it to our toss queue w/ a unique id
		const tossId = uuidv4();
		const toss = {
			id: tossId,
			item: itemSlug,
			isEmoji: isEmoji,
			createdAt: Date.now(),
		};
		this.tossQueue.value = [...this.tossQueue.value, toss];

		this.chatToysApp.log.msg(msg.author + ' tossed a ' + itemSlug);
	}


	// ---------------------------------------------------------------------
	// Emoji extraction (custom + unicode)
	// ---------------------------------------------------------------------

	/**
	 * Lazily build / return a regex that matches unicode emoji-ish codepoints.
	 * Uses \p{Extended_Pictographic} when available, falls back to a range.
	 */
	getUnicodeEmojiRegex() {

		if (this.unicodeEmojiRegex)
			return this.unicodeEmojiRegex;

		try {
			// Modern engines (Chromium / Electron) should support this.
			this.unicodeEmojiRegex = new RegExp('\\p{Extended_Pictographic}', 'gu');
		}
		catch (e) {
			// Fallback: BMP + SMP emoji blocks, not perfect but pretty good.
			this.unicodeEmojiRegex = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu;
		}

		return this.unicodeEmojiRegex;
	}


	/**
	 * Build a combined emoji list from:
	 * - msg.emojis (custom image emojis from Twitch / YouTube)
	 * - unicode emoji glyphs found directly in messageText
	 *
	 * Returns array of entries like:
	 *  { kind: 'image', url, code? }
	 *  { kind: 'unicode', char }
	 *
	 * @param {Object} msg
	 * @returns {Array<Object>}
	 */
	extractEmojisFromMsg(msg) {

		const result = [];

		if (!msg)
			return result;

		// 1) Custom / platform emojis (already normalized by chat processor)
		const customEmojis = Array.isArray(msg.emojis) ? msg.emojis : [];

		for (const e of customEmojis) {
			if (!e || !e.url)
				continue;

			result.push({
                kind: 'image',
				url: e.url,
				code: e.code || null,
				// keep a reference if we ever care about more fields later
				_original: e,
			});
		}

		// 2) Unicode emojis directly in the message text
		const text = (msg.messageText || '').trim();
		if (text) {
			const re = this.getUnicodeEmojiRegex();
			re.lastIndex = 0;

			let m;
			while ((m = re.exec(text)) !== null) {

				const ch = m[0];
				if (!ch)
					continue;

				result.push({
					kind: 'unicode',
					char: ch,
					_original: null,
				});

			}// next match
		}

		return result;
	}

}
