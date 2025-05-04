/*
	ThreeBuddy.js
	-------------

	This class handles the Three.js buddy system for the StreamBuddies toy.
*/

// vue
import { watch } from 'vue';

// three imports
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader';
import { AnimationMixer, Object3D, LoopRepeat, LoopOnce, AnimationClip } from 'three';
import { ThreeJSBuddiesSystem } from './ThreeJSBuddiesSystem';

/**
 * Helper class to load and manage animations.
 */
export class AnimationLibrary {

	/**
	 * Constructs the animation library
	 * 
	 * @param {String} basePath - base path to load the animations from
	 * @param {Array<String>} animationFBXPaths - list of file names (without the .fbx) to load
	 */
	constructor(basePath, animationFBXPaths) {

		// save our base path
		this.basePath = basePath;

		// make a new threeJS FBX loader
		this.loader = new FBXLoader();

		// we'll store our loaded ani models here, with their name as the key
		this.animations = new Map();

		// load the animations
		this.ready = this.loadAnimations(animationFBXPaths);
	}


	/**
	 * Loads the animation
	 * 
	 * @param {Array<String>} paths - list of file names (without the .fbx) to load
	 * @returns {Promise} - a promise that resolves when all animations are loaded
	 */
	async loadAnimations(paths) {

		// load the animations
		const promises = paths.map(async (name) => {

			// load the file with the animation in it
			const path = `${this.basePath}${name}.fbx`;
			const anim = await this.loader.loadAsync(path);

			// get the first animation clip and add it to our map
			const clip = anim.animations[0];

			// save it to our map
			this.animations.set(name, clip);
		});
		await Promise.all(promises);
	}


	/**
	 * get the animation by name
	 * 
	 * @param {String} name - name of the animation to get
	 * @returns {AnimationClip} - the animation clip
	 */
	get(name) {
		return this.animations.get(name);
	}
}


/**
 * Class to represent one of the buddy characters on screen
 */
export class ThreeBuddy extends Object3D {

	/**
	 * Constructs a buddy on screen
	 * 
	 * @param {ThreeJSBuddiesSystem} threeBuddySystem - the buddy system to use
	 * @param {String} modelPath - path to the avatar model to use
	 * @param {AnimationLibrary} animationLibrary - the animation library to use
	 */
	constructor(threeBuddySystem, modelPath, animationLibrary) {

		// call the parent constructor
		super();

		// members
		this.system = threeBuddySystem;
		this.loader = new FBXLoader();
		this.model = null;
		this.mixer = null;
		this.currentAction = null;
		this.lastState = null;
		this.animationLibrary = animationLibrary;

		// 
		this.animationMap = {
			idle: ['idle_generic', 'idle_happy', 'idle_dwarf'],
			moving: 'walking',
			jumping: 'jumping',
			knockback: 'knockback',
			sitting: 'sitting',
			hugging: 'fireball',
			attacking: ['attack_fist', 'attack_kick'],
		};

		this.danceAnimations = ['dance_hiphop', 'dance_spin', 'dance_swing', 'dance_twerk'];

		this.loader.load(modelPath, (fbx) => {
			this.model = fbx;
			this.model.scale.set(0.11, 0.11, 0.11);
			this.mixer = new AnimationMixer(fbx);
			this.add(fbx);
		});

		// watch global scale ref to adjust our own scale when it changes
		const s = this.system.buddySize.value;
		this.scale.set(s, s, s);
		watch(this.system.buddySize, (newVal) => {
			this.scale.set(newVal, newVal, newVal);
		});
	}


	/**
	 * Sets up and plays one of our animations
	 * 
	 * @param {String} name - key/name of the animation to pull from our loaded animations in the library
	 * @param {Boolean} loop - whether to loop the animation or not
	 * @returns 
	 */
	playAnimation(name, loop = true) {

		// if we don't have a clip, or no mixer, GTFO
		const clip = this.animationLibrary.get(name);
		if (!clip || !this.mixer)
			return;

		// if the name isn't different don't replay
		if (this.currentAnimation === name)
			return;

		// save the current animation name
		this.currentAnimation = name;

		const action = this.mixer.clipAction(clip);
		action.reset();
		action.setLoop(loop ? LoopRepeat : LoopOnce, Infinity);
		action.clampWhenFinished = !loop;
		action.play();

		if (this.currentAction && this.currentAction !== action) {
			this.currentAction.stop();
		}
		this.currentAction = action;
	}


	/**
	 * Updates the animation and facing direction of the character based on the state	
	 * 
	 * @param {Object} newState - object with state of the buddy based on the state
	 */
	updateState(newState) {

		// GTFO if we're not ready yet
		if (!this.model || !this.mixer) 
			return;

		// console.log('poop', newState);

		const changed = !this.lastState || JSON.stringify(this.lastState) !== JSON.stringify(newState);
		this.lastState = { ...newState };
		if (!changed)
			return;

		const xPos = newState.x - (this.system.canvasWidth / 2);
		const yPos = newState.y - (this.system.canvasHeight / 2);
		this.position.set(xPos, yPos, 0);

		let rotY = 0;
		if (["moving", "jumping", "hugging", "attacking", "knockback"].includes(newState.stateMode)) {
			rotY = newState.dir === 'right' ? (Math.PI / 2) * 0.6 : (-Math.PI / 2) * 0.6;
		}
		this.rotation.y = rotY;

		// figure out what animation kind to play
		let {ani, loop} = this.pickAnimationKind(newState);

		// initial set if undefined
		if(this.lastAniKind===undefined)
			this.lastAniKind = '';

		// if the _kind_ of animation changed, we can run some extra logic for the type
		if(this.lastAniKind !== ani){

			this.lastAniKind = ani;

			if(ani=='idle')
				ani = this.animationMap.idle[Math.floor(Math.random() * 3)];

			if(ani=='attacking')
				ani = this.animationMap.attacking[Math.floor(Math.random() * 2)];

			if (ani) 
				this.playAnimation(ani, loop);
		}
	}


	/**
	 * Picks the animation kind to play, no random picks yet
	 * 
	 * @param {Object} newState - new state of the buddy
	 * @returns {Object} -  with the animation clip or string to play and if it should loop
	 */
	pickAnimationKind(newState){

		let ani = '';
		let loop = true;

		if (newState.stateMode === 'idle') {
			ani = 'idle';

		} else if (newState.stateMode === 'dancing') {
			ani = `dance_${newState.dance}`;

		} else if (['hugging', 'attacking'].includes(newState.stateMode)) {

			if(newState[newState.stateMode]){
				ani = newState.stateMode === 'hugging'
					? this.animationMap['hugging']
					: 'attacking'
				loop = false;
			}else{
				ani = this.animationMap['moving'];
			}

		} else {
			ani = this.animationMap[newState.stateMode];
			loop = !['jumping', 'knockback'].includes(newState.stateMode);
		}

		return {ani, loop};
	}


	/**
	 * Updates the animation mixer
	 * 
	 * @param {Number} delta - delta time
	 */
	tick(delta) {

		if (this.mixer)
			this.mixer.update(delta);
	}
}
