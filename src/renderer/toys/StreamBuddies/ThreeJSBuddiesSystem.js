/*
	ThreeJSBuddiesSystem.js
	-----------------------

	This file will control the state for the on screen chat avatars, using ThreeJS.
*/

// three js
import {
	Scene,
	OrthographicCamera,
	WebGLRenderer,
	AmbientLight,
	DirectionalLight,
	Vector3,
	Vector2,
	Sprite,
	SpriteMaterial,
	Clock,
	BoxGeometry,
	MeshBasicMaterial,
	Mesh,
	AudioListener,
	Audio,
	AudioLoader,
	Object3D,
	Color,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { int } from 'three/src/nodes/TSL.js';
import { watch, unref } from 'vue';

// our app
import { AnimationLibrary, ThreeBuddy } from './ThreeBuddy';


/**
 * Main class to manager the tosser system state for the Tosser toy.
 */
export class ThreeJSBuddiesSystem {

	/**
	 * Constructor for the ThreeJSTosserSystem class.
	 * 
	 * @param {Ref} canvasContainerRef - the canvas container reference
	 * @param {ShallowRef} state - the vue3 shallow ref to the state
	 * @param {Number} buddySize - the size of the buddies
	 * @param {Ref} modelPath - ref to the path to the model for avatars
	 */
	constructor(canvasContainerRef, state, buddySize, modelPath) {

		// save our refs
		this.containerRef = canvasContainerRef;
		this.state = state;
		this.buddySize = buddySize;
		this.modelPath = modelPath;
		
		// our instantiated buddies
		this.buddiesMap = new Map();

		// useful for timekeeping
		this.clock = new Clock();

		// build our ThreeJS scene (lights, camera, etc)
		this.buildScene();

		// set up the state things we'll need to monitor
		// (ie. container resize, list of models, etc)
		this.subscribeWatches();

		// true when animations are ready
		this.aniLibrary = null;
		this.animationsReady = false;

		// load our models initially once on start
		this.loadModels();

		// set up buddies at least once on start up
		this.updateBuddies(this.state.value);

		// kick off the recursive (on animation frame) render loop
		this.renderLoop();
	}


	/**
	 * Sets up all the watchers we need to monitor
	 */
	subscribeWatches() {

		// set up a resize observer for the container element
		// so we can update the canvas size when it changes
		this.resizeObserver = new ResizeObserver(() => this.onResize());
		this.resizeObserver.observe(this.containerRef.value);
		this.onResize();

		// watch state & update the model list
		watch(this.state, (newVal) => {
			this.updateBuddies(newVal);
		}, { deep: true });
	}


	/**
	 * Synchronizes our instantiated ThreeBuddy objects with the state
	 * 
	 * @param {Object} newVal - from our state variable
	 */
	updateBuddies(newVal) {

		// if our animations aren't ready yet, gtfo
		if (this.animationsReady === null)
			return;

		// get the data
		if (newVal.buddies === undefined)
			return;
		const buddies = newVal.buddies;

		// get the current list of ID's we have instantiated
		const currentIDs = new Set(buddies.map(b => b.userID));

		// Remove old buddies
		for (const [id, buddy] of this.buddiesMap.entries())
			if (!currentIDs.has(id)){

				// get the buddy from our map
				const buddy = this.buddiesMap.get(id);

				// remove from the scene & then delete the buddy
				this.scene.remove(buddy);
				this.buddiesMap.delete(id);
			}

		// Add new buddies
		for (const buddyInfo of buddies)
			if (!this.buddiesMap.has(buddyInfo.userID)){
			
				// make a new buddy
				// const avatarPath = 'assets/buddies/avatar.fbx';
				const avatarPath = unref(this.modelPath);
				const buddy = new ThreeBuddy(this, avatarPath, this.aniLibrary);
				
				// add to our map & to the scene
				this.buddiesMap.set(buddyInfo.userID, buddy);
				this.scene.add(buddy);
			}

		// loop over the buddies and update their state
		for (const buddyInfo of buddies) {

			// get the buddy from our map
			const buddy = this.buddiesMap.get(buddyInfo.userID);

			// update the buddy's state
			buddy.updateState(buddyInfo);
		}
	}


	/**
	 * Sets up all the ThreeJS scene stuff (e.g. camera, lights, renderer, etc.)
	 */
	buildScene() {

		// make our loaders
		this.loader = new GLTFLoader();

		// build the scene
		this.scene = new Scene();

		// set up camera & audio listener
		this.listener = new AudioListener();
		this.camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 1000);
		this.camera.position.z = 100;

		// add to scene
		this.scene.add(this.camera);

		// make a renderer & append it to the container element passed in
		this.renderer = new WebGLRenderer({ alpha: true, antialias: true });
		this.containerRef.value.appendChild(this.renderer.domElement);

		// set up some basic lighting
		this.scene.add(new AmbientLight(0xffffff, 1.75));
		const dirLight = new DirectionalLight(0xffffff, 1);
		dirLight.position.set(5, 10, 17.5);
		this.scene.add(dirLight);

		// for debug, show the collider
		this.debugCollider = null;
		// this.setupDebug();

		this.onResize();
	}


	/**
	 * Add a wireframe box to the scene to show the collider area
	 */
	setupDebug() {
		
		// add a teal cube to the center of the scene to test rendering is live
		const geo = new BoxGeometry(100, 100, 100);
		const mat = new MeshBasicMaterial({ color: 0x00ABAE, wireframe: true });
		this.debugCube = new Mesh(geo, mat);
		this.debugCube.position.set(0, 0, 0);
		this.debugCube.rotation.x = Math.PI / 4;
		this.debugCube.rotation.y = Math.PI / 4;
		this.debugCube.rotation.z = Math.PI / 4;
		this.scene.add(this.debugCube);
	}


	/**
	 * When the canvas container resizes, we need to update the camera and renderer
	 */
	onResize() {

		// measure the container our renderer's canvas is mounted in
		const el = this.containerRef.value;
		const w = el.clientWidth;
		const h = el.clientHeight;

		// reset renderer & camera
		this.renderer.setSize(w, h);
		this.camera.left = -w / 2;
		this.camera.right = w / 2;
		this.camera.top = h / 2;
		this.camera.bottom = -h / 2;
		this.camera.updateProjectionMatrix();
		this.canvasWidth = w;
		this.canvasHeight = h;
	}


	/**
	 * Load models we need
	 */
	async loadModels() {

		this.aniLibrary = new AnimationLibrary(
			'assets/buddies/ani/',
			[
				'attack_fist',
				'attack_kick',
				'dance_hiphop',
				'dance_spin',
				'dance_swing',
				'dance_twerk',
				'fireball',
				'idle_dwarf',
				'idle_generic',
				'idle_happy',
				'jumping',
				'knockback',
				'sitting',
				'walking'
			]);

		await this.aniLibrary.ready;
		this.animationsReady = true;
	}


	/**
	 * Render loop for the Three.js scene.
	 */
	renderLoop() {

		// recursively loop on browser's animation frame
		requestAnimationFrame(() => this.renderLoop());

		// console.log('Rendering...');
		if(this.debugCube)
			this.debugCube.rotation.z -= 0.01;

		// get our delta time & up the buddies
		const deltaTime = this.clock.getDelta();
		for (const buddy of this.buddiesMap.values())
			buddy.tick(deltaTime);

		// render the scene
		this.renderer.render(this.scene, this.camera);
	}


	/**
	 * Perform cleanup actions when the component is destroyed.
	 */
	end() {
		this.renderer.dispose();
		this.scene.clear();
		this.resizeObserver.disconnect();
	}

}

