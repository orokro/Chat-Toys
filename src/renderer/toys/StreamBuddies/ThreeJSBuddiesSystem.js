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


/**
 * Main class to manager the tosser system state for the Tosser toy.
 */
export class ThreeJSBuddiesSystem {

	/**
	 * Constructor for the ThreeJSTosserSystem class.
	 * 
	 * @param {Ref} canvasContainerRef - the canvas container reference
	 */
	constructor(canvasContainerRef) {

		// save our refs
		this.containerRef = canvasContainerRef;

		// useful for timekeeping
		this.clock = new Clock();
		
		// build our ThreeJS scene (lights, camera, etc)
		this.buildScene();

		// set up the state things we'll need to monitor
		// (ie. container resize, list of models, etc)
		this.subscribeWatches();

		// load our models initially once on start
		this.loadModels();

		// kick off the recursive (on animation frame) render loop
		this.renderLoop();
	}


	/**
	 * Sets up all the watchers we need to monitor
	 */
	subscribeWatches(){

		// set up a resize observer for the container element
		// so we can update the canvas size when it changes
		this.resizeObserver = new ResizeObserver(() => this.onResize());
		this.resizeObserver.observe(this.containerRef.value);
		this.onResize();
	}


	/**
	 * Sets up all the ThreeJS scene stuff (e.g. camera, lights, renderer, etc.)
	 */
	buildScene(){

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
		this.scene.add(new AmbientLight(0xffffff, 0.5));
		const dirLight = new DirectionalLight(0xffffff, 1);
		dirLight.position.set(5, 10, 7.5);
		this.scene.add(dirLight);

		// add a teal cube to the center of the scene to test rendering is live
		const geo = new BoxGeometry(100, 100, 100);
		const mat = new MeshBasicMaterial({ color: 0x00ABAE, wireframe: true });
		this.debugCube = new Mesh(geo, mat);
		this.debugCube.position.set(0, 0, 0);
		this.debugCube.rotation.x = Math.PI / 4;
		this.debugCube.rotation.y = Math.PI / 4;
		this.debugCube.rotation.z = Math.PI / 4;
		this.scene.add(this.debugCube);

		// for debug, show the collider
		this.debugCollider = null;
		// this.setupDebug();
	}
	

	/**
	 * Add a wireframe box to the scene to show the collider area
	 */
	setupDebug() {
		// const mat = new MeshBasicMaterial({ color: 0x00ff00, wireframe: true });
		// const geo = new BoxGeometry(1, 1, 1);
		// this.debugCollider = new Mesh(geo, mat);
		// this.scene.add(this.debugCollider);
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
	loadModels() {

	}



	/**
	 * Render loop for the Three.js scene.
	 */
	renderLoop() {

		// recursively loop on browser's animation frame
		requestAnimationFrame(() => this.renderLoop());

		// console.log('Rendering...');
		this.debugCube.rotation.z -= 0.01;

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

