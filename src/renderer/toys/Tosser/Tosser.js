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

		// ---- recoil on hit ----
		// The widget publishes a bumped counter here every time a tossed item
		// lands. We watch it and, when enabled, recoil the VTS model. Throttled
		// so a burst of items doesn't spam MoveModelRequest.
		this.hitPing = socketShallowRef(this.static.slugify('hitPing'), { n: 0, x: 0, t: 0 });
		this._lastRecoilAt = 0;
		this._recoilMinIntervalMs = 220;
		this.stopHitWatch = watch(this.hitPing, (v) => this._onHitPing(v));

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
		if (this.stopHitWatch)
			this.stopHitWatch();
	}


	/**
	 * React to a hit published by the widget. When recoil is enabled and VTS is
	 * ready, give the model a quick tilt away from the impact side. Throttled to
	 * avoid spamming MoveModelRequest during a burst of tosses.
	 *
	 * @param {Object} ping - { n, x, t } published by TosserWidget
	 * @returns {void}
	 */
	_onHitPing(ping) {

		if (!this.settings.recoilOnHit.value)
			return;
		if (!this.vts || !this.vts.isReady())
			return;
		if (!ping || !ping.n)
			return;

		// throttle
		const now = Date.now();
		if (now - this._lastRecoilAt < this._recoilMinIntervalMs)
			return;
		this._lastRecoilAt = now;

		// tilt away from the side the item came from: a hit on the right (x > 0)
		// knocks the model's top to the right (positive rotation), and a hit on
		// the left knocks it to the left — i.e. the model recoils in the
		// direction the projectile was travelling.
		const angle = Math.abs(this.settings.recoilAngle.value || 0);
		if (angle <= 0)
			return;
		const dir = (ping.x || 0) >= 0 ? 1 : -1;

		this.vts.recoilModel({ angle: dir * angle });
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

		// Heartbeat (~1Hz): RE-READ the OBS transforms and republish. This both
		// keeps a late-joining / reloaded widget in sync (socket-ref doesn't
		// replay the last value to new subscribers) AND self-heals if a move
		// didn't fire a transform event (so the box can't get stuck stale).
		this._heartbeat = window.setElectronInterval(() => this.refreshObsRect(), 1000);
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
		const croppedW = Math.max(0, sw - cl - cr);
		const croppedH = Math.max(0, sh - ct - cb);

		// OBS alignment bits: LEFT=1, RIGHT=2, TOP=4, BOTTOM=8 (CENTER=0)
		const a = t.alignment || 0;

		const bt = t.boundsType;
		const hasBounds = bt && bt !== 'OBS_BOUNDS_NONE' && t.boundsWidth > 0 && t.boundsHeight > 0;

		// --- no bounds: size = cropped source * scale, anchored by alignment ---
		if (!hasBounds) {
			const visW = croppedW * sx;
			const visH = croppedH * sy;
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

		// --- bounds: the item is fit into a boundsWidth x boundsHeight box ---
		const bw = t.boundsWidth, bh = t.boundsHeight;
		const fitX = bw / (croppedW || 1);
		const fitY = bh / (croppedH || 1);
		let scale = null; // null = stretch (fill box, no aspect preserve)
		switch (bt) {
			case 'OBS_BOUNDS_STRETCH':         scale = null; break;
			case 'OBS_BOUNDS_SCALE_INNER':     scale = Math.min(fitX, fitY); break;
			case 'OBS_BOUNDS_SCALE_OUTER':     scale = Math.max(fitX, fitY); break;
			case 'OBS_BOUNDS_SCALE_TO_WIDTH':  scale = fitX; break;
			case 'OBS_BOUNDS_SCALE_TO_HEIGHT': scale = fitY; break;
			case 'OBS_BOUNDS_MAX_ONLY':        scale = Math.min(1, Math.min(fitX, fitY)); break;
			default:                           scale = Math.min(fitX, fitY); break;
		}
		const visW = (scale === null) ? bw : croppedW * scale;
		const visH = (scale === null) ? bh : croppedH * scale;

		// bounds box top-left (anchored by alignment)
		let boxLeft;
		if (a & 1) boxLeft = t.positionX;
		else if (a & 2) boxLeft = t.positionX - bw;
		else boxLeft = t.positionX - bw / 2;
		let boxTop;
		if (a & 4) boxTop = t.positionY;
		else if (a & 8) boxTop = t.positionY - bh;
		else boxTop = t.positionY - bh / 2;

		// content placement within the bounds box (boundsAlignment; default center)
		const ba = (typeof t.boundsAlignment === 'number') ? t.boundsAlignment : 0;
		let left;
		if (ba & 1) left = boxLeft;
		else if (ba & 2) left = boxLeft + (bw - visW);
		else left = boxLeft + (bw - visW) / 2;
		let top;
		if (ba & 4) top = boxTop;
		else if (ba & 8) top = boxTop + (bh - visH);
		else top = boxTop + (bh - visH) / 2;

		return { x: left, y: top, width: visW, height: visH };
	}


	/**
	 * Map a rect expressed in a CONTAINER's local content space up into the
	 * container's parent space. Uses the container's EFFECTIVE scale (visible
	 * size / cropped source size) so it's correct whether the container uses
	 * plain scaling or bounds.
	 *
	 * @param {{x:number,y:number,width:number,height:number}} rect
	 * @param {Object} t - the container item's transform (in its parent)
	 * @returns {{x:number,y:number,width:number,height:number}}
	 */
	_mapThroughContainer(rect, t) {
		const sw = (typeof t.sourceWidth === 'number' && t.sourceWidth > 0) ? t.sourceWidth : 0;
		const sh = (typeof t.sourceHeight === 'number' && t.sourceHeight > 0) ? t.sourceHeight : 0;
		const cl = t.cropLeft || 0, cr = t.cropRight || 0, ct = t.cropTop || 0, cb = t.cropBottom || 0;

		// The container only renders its content region [cl..sw-cr] x [ct..sh-cb]
		// and hides anything outside it (e.g. a nested scene clips to its canvas).
		// Clip the child rect (in container content space) to that region.
		const visLeft = cl, visRight = sw - cr, visTop = ct, visBottom = sh - cb;
		const x0 = Math.max(rect.x, visLeft);
		const y0 = Math.max(rect.y, visTop);
		const x1 = Math.min(rect.x + rect.width, visRight);
		const y1 = Math.min(rect.y + rect.height, visBottom);
		const clipW = Math.max(0, x1 - x0);
		const clipH = Math.max(0, y1 - y0);

		const croppedW = Math.max(1, visRight - visLeft);
		const croppedH = Math.max(1, visBottom - visTop);
		const cont = this._visibleRectPx(t);
		const esx = cont.width / croppedW;
		const esy = cont.height / croppedH;

		return {
			x: cont.x + (x0 - cl) * esx,
			y: cont.y + (y0 - ct) * esy,
			width: clipW * esx,
			height: clipH * esy,
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

		const src = this._obsRect;

		// In obsVts mode the actual collider is a sub-box within the source;
		// in obs mode it's the whole source rect.
		const collider = (mode === 'obsVts') ? this._computeVtsSubBox(src) : src;

		this.autoCollider.value = {
			valid: true,
			// the actual collider used for collisions
			x: collider.x,
			y: collider.y,
			width: collider.width,
			height: collider.height,
			// the full source rect (for the solid reference debug box)
			source: { x: src.x, y: src.y, width: src.width, height: src.height },
			mode,
		};
	}


	/**
	 * Compute the obsVts sub-box: an upper-center region of the source (since
	 * VTS has no head-position API), optionally offset by the live VTS model
	 * position. All inputs/outputs are normalized (0..1) canvas coordinates.
	 *
	 * @param {{x:number,y:number,width:number,height:number}} src
	 * @returns {{x:number,y:number,width:number,height:number}}
	 */
	_computeVtsSubBox(src) {

		const s = this.settings;
		const bw = src.width * (s.vtsBoxWidth.value ?? 0.5);
		const bh = src.height * (s.vtsBoxHeight.value ?? 0.5);

		// base center: horizontally centered, vertically in the upper area
		let cx = src.x + src.width * 0.5;
		let cy = src.y + src.height * (s.vtsBoxAnchorY.value ?? 0.32);

		// optional follow: shift by the live VTS model position. VTS's
		// position units don't map to OBS pixels by any knowable constant
		// (depends on VTS's internal render size + window-capture cropping),
		// so `follow` is a user-calibrated sensitivity: box shift = position *
		// source dimension * follow. Dial it against the dotted debug box.
		const follow = s.vtsFollowStrength.value ?? 0;
		const m = this.vts && this.vts.modelTransform;
		if (m && m.written && follow > 0) {
			cx += (m.positionX || 0) * src.width * follow;
			cy += -(m.positionY || 0) * src.height * follow;
		}

		return { x: cx - bw / 2, y: cy - bh / 2, width: bw, height: bh };
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

			// obsVts sub-box: where the avatar's hittable area sits WITHIN the
			// tracked source. All fractions of the source rect. Default = an
			// upper-center box (humanoid head/chest), since VTS has no head
			// API. vtsFollowStrength offsets it by the live VTS model position.
			vtsBoxWidth: ref(0.5),
			vtsBoxHeight: ref(0.5),
			vtsBoxAnchorY: ref(0.32),
			vtsFollowStrength: ref(1),

			// recoil "bonk": when a tossed item lands, nudge the VTS model with
			// a quick tilt. recoilAngle is the peak tilt in degrees.
			recoilOnHit: ref(false),
			recoilAngle: ref(15),

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
