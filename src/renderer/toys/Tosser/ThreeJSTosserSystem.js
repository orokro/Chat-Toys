/*
	ThreeJSTosserSystem.js
	----------------------

	The ThreeJS logic for spawning & rendering the tossed object.

	Also plays the audio & etc.
*/

// three imports
import {
	Scene,
	PerspectiveCamera,
	OrthographicCamera,
	WebGLRenderer,
	AmbientLight,
	DirectionalLight,
	Box3,
	Vector3,
	Clock,
	BoxGeometry,
	MeshBasicMaterial,
	Mesh,
	AudioListener,
	Audio,
	AudioLoader,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { watch, unref } from 'vue';

/**
 * Class representing a tossed object.
 */
class TossedObject {

	/**
	 * Makes a new tossed object.
	 * 
	 * @param {Mesh} model - the model to toss (like a tomato, or paper, or whatever)
	 * @param {Vector3} startPos - the starting position of the object
	 * @param {Vector3} targetPosition - the target position to toss the object to
	 * @param {Audio} audio - the audio to play when the object is tossed
	 * @param {Scene} scene - main scene to add the object to
	 */
	constructor(model, startPos, targetPosition, audio, scene) {

		// clone & position the model
		this.mesh = model.clone();
		this.mesh.position.copy(startPos.clone().setY(0));

		// set up it's physics
		this.velocity = new Vector3(
			(Math.random() - 0.5) * 0.5,
			1 + Math.random(),
			0
		);
		this.gravity = -0.01;
		this.targetY = startPos.y;

		// save scene & add our new mesh to it
		this.scene = scene;
		this.scene.add(this.mesh);

		// state
		this.done = false;
		this.fadeOut = false;
		this.opacity = 1;

		// save the audio, if any
		this.audio = audio;

		// if (audio) {
		// 	audio.play();
		// }
	}

	/**
	 * Performs state update logic for the object
	 */
	update() {

		// if we are done, don't do anything
		if (this.done)
			return;

		// apply gravity
		this.velocity.y += this.gravity;
		this.mesh.position.add(this.velocity);

		// if we're not fading out, check if we hit the target
		if (!this.fadeOut && this.mesh.position.y <= this.targetY) {
			this.fadeOut = true;
			this.velocity.set(0, 0, 0);
			this.mesh.scale.set(1.5, 1.5, 1.5);
		}

		// if we are fading out, apply the fade out logic
		if (this.fadeOut) {
			this.opacity -= 0.05;
			this.mesh.material.transparent = true;
			this.mesh.material.opacity = this.opacity;
			if (this.opacity <= 0) {
				this.done = true;
				this.scene.remove(this.mesh);
			}
		}
	}

}


/**
 * The main class to orchestrate the ThreeJS toss system.
 */
export class ThreeJSTosserSystem {

	/**
	 * Sets up the ThreeJS toss system.
	 * 
	 * @param {Ref} canvasContainerRef - vue Ref to the parent canvas container
	 * @param {shallowRef} modelsAvailableRef - vue Ref to array of available models data
	 * @param {shallowRef} colliderBoxRef - vue ref to the collider box like { x, y, width, height }
	 */
	constructor(canvasContainerRef, modelsAvailableRef, colliderBoxRef) {

		console.log('zzz', canvasContainerRef, modelsAvailableRef, colliderBoxRef);
		// save the refs
		this.canvasContainerRef = canvasContainerRef;
		this.modelsAvailableRef = modelsAvailableRef;
		this.colliderBoxRef = colliderBoxRef;

		// our lst of spawned objects that have been tossed
		this.tossedItems = [];

		// maps of loaded models & audio sounds
		this.allModelsLoaded = new Map();
		this.audioSources = new Map();

		// save refs to the loaded models & audio
		this.scene = new Scene();

		// our loaders
		this.loader = new GLTFLoader();
		this.audioLoader = new AudioLoader();
		this.listener = new AudioListener();

		// set up the audio listener
		this.clock = new Clock();

		// build our three JS scene stuffs
		this.renderer = new WebGLRenderer({ alpha: true, antialias: true });
		this.canvasContainerRef.value.appendChild(this.renderer.domElement);

		this.camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 1000);
		this.camera.position.z = 10;

		this.scene.add(new AmbientLight(0xffffff, 0.5));
		const dirLight = new DirectionalLight(0xffffff, 1);
		dirLight.position.set(5, 10, 7.5);
		this.scene.add(dirLight);

		this.colliderDebug = null;
		this.setupColliderDebug();

		// watch our parent component so we can resize
		const resizeObserver = new ResizeObserver(() => this.onResize());
		resizeObserver.observe(this.canvasContainerRef.value);
		this.onResize();

		watch(modelsAvailableRef, () => this.loadModels());
		this.loadModels();

		this.renderLoop();
	}

	/**
	 * Handle when our canvas container resizes
	 */
	onResize() {
		const el = this.canvasContainerRef.value;
		this.renderer.setSize(el.clientWidth, el.clientHeight);
		this.canvasWidth = el.clientWidth;
		this.canvasHeight = el.clientHeight;
		this.camera.left = -el.clientWidth / 2;
		this.camera.right = el.clientWidth / 2;
		this.camera.top = el.clientHeight / 2;
		this.camera.bottom = -el.clientHeight / 2;
		this.camera.updateProjectionMatrix();
		this.updateColliderDebug();
	}


	loadModels() {
		const models = unref(this.modelsAvailableRef);

		for (const item of models) {

			if (!this.allModelsLoaded.has(item.slug)) {

				this.loader.load(item.modelPath, (gltf) => {
					const mesh = gltf.scene;
					mesh.scale.set(item.scale, item.scale, item.scale);
					this.allModelsLoaded.set(item.slug, {
						slug: item.slug,
						command: item.cmd,
						object: mesh,
						sound: item.soundPath,
					});
				});

				if (!this.audioSources.has(item.soundPath)) {
					const sound = new Audio(this.listener);
					this.audioLoader.load(item.soundPath, (buffer) => {
						sound.setBuffer(buffer);
					});
					this.audioSources.set(item.soundPath, sound);
				}
			}

		}// next item
	}


	/**
	 * Tosses an item at the collider box
	 * @param {String} slug - one of the loaded model's slugs
	 */
	tossItem(slug) {

		// get the loaded model w/ this slug or GTFO if none
		const modelEntry = this.allModelsLoaded.get(slug);
		if (!modelEntry)
			return;

		// pick random place on the bottom of the screen
		const spawnX = (Math.random() - 0.5) * this.canvasWidth;
		const spawnPos = new Vector3(spawnX, -this.canvasHeight / 2, 0);

		const collider = unref(this.colliderBoxRef);
		const colliderCenterX = collider.x + (collider.width * 0.5);
		const colliderTargetX = colliderCenterX - (collider.width * 0.125);
		const colliderTarget = new Vector3(
			colliderTargetX - this.canvasWidth / 2,
			this.canvasHeight / 2 - collider.y - collider.height,
			0
		);

		const audio = this.audioSources.get(modelEntry.sound);

		const tossed = new TossedObject(modelEntry.object, colliderTarget, audio, this.scene);
		this.tossedItems.push(tossed);
	}


	/**
	 * Adds a cube to the scene so we can see the collider box
	 */
	setupColliderDebug() {
		const material = new MeshBasicMaterial({ color: 0xff0000, wireframe: true });
		const geometry = new BoxGeometry(1, 1, 1);
		this.colliderDebug = new Mesh(geometry, material);
		this.scene.add(this.colliderDebug);
	}


	/**
	 * Updates the collider debug box to match the collider box
	 */
	updateColliderDebug() {

		// break out the collider box into its components
		// & adjust the size a bit
		const collider = this.colliderBoxRef.value;
		const width = collider.width * 0.75;
		const height = collider.height;
		const x = collider.x + (collider.width * 0.125) - this.canvasWidth / 2;
		const y = this.canvasHeight / 2 - collider.y - (collider.height / 2);
		this.colliderDebug.scale.set(width, height, 1);
		this.colliderDebug.position.set(x, y, 0);
	}


	/**
	 * Main render loop
	 * 
	 * Updates our super basic state logic for the tossed objects
	 * and renders the scene.
	 * @returns {void}
	 */
	renderLoop() {

		// recursively loop on animation frames
		requestAnimationFrame(() => this.renderLoop());

		// update the tossed items w/ delta time
		const delta = this.clock.getDelta();
		this.tossedItems.forEach((item, index) => {
			item.update(delta);
		});

		// any items that are done, remove 'em
		this.tossedItems = this.tossedItems.filter(item => !item.done);

		// render the scene
		this.renderer.render(this.scene, this.camera);
	}


	/**
	 * Clean up logic
	 */
	end() {
		this.renderer.dispose();
		this.tossedItems.forEach(obj => {
			this.scene.remove(obj.mesh);
		});
		this.tossedItems = [];
		this.audioSources.clear();
		this.allModelsLoaded.clear();
		this.scene.clear();
	}
}
