import {
	Scene,
	OrthographicCamera,
	WebGLRenderer,
	AmbientLight,
	DirectionalLight,
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

class TossedObject {
	constructor(model, target, scene, sound) {
		this.scene = scene;
		this.mesh = model.clone();
		this.mesh.traverse(child => {
			if (child.isMesh) {
				child.material = child.material.clone();
			}
		});

		this.startPos = new Vector3(
			(Math.random() - 0.5) * 200,
			-200,
			0
		);

		this.mesh.position.copy(this.startPos);
		this.velocity = target.clone().sub(this.startPos).normalize().multiplyScalar(5);
		this.gravity = new Vector3(0, -0.1, 0);

		this.hit = false;
		this.opacity = 1;
		this.fadeSpeed = 0.05;

		if (sound) sound.play();

		this.scene.add(this.mesh);
	}

	update(targetBox) {
		if (this.hit) {
			this.opacity -= this.fadeSpeed;
			this.mesh.traverse(child => {
				if (child.isMesh) {
					child.material.transparent = true;
					child.material.opacity = this.opacity;
				}
			});
			if (this.opacity <= 0) {
				this.scene.remove(this.mesh);
				return false;
			}
			return true;
		}

		this.velocity.add(this.gravity);
		this.mesh.position.add(this.velocity);

		const pos = this.mesh.position;
		if (
			pos.x > targetBox.min.x &&
			pos.x < targetBox.max.x &&
			pos.y > targetBox.min.y &&
			pos.y < targetBox.max.y
		) {
			this.hit = true;
			this.mesh.scale.set(1.5, 1.5, 1.5);
		}

		return true;
	}
}

export class ThreeJSTosserSystem {
	constructor(canvasContainerRef, modelsAvailableRef, colliderBoxRef) {
		this.containerRef = canvasContainerRef;
		this.modelsRef = modelsAvailableRef;
		this.colliderRef = colliderBoxRef;

		this.tossedItems = [];
		this.allModels = new Map();
		this.audioSources = new Map();

		this.clock = new Clock();
		this.scene = new Scene();
		this.loader = new GLTFLoader();
		this.audioLoader = new AudioLoader();
		this.listener = new AudioListener();

		this.camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 1000);
		this.camera.position.z = 10;
		this.scene.add(this.camera);

		this.renderer = new WebGLRenderer({ alpha: false, antialias: true });
		this.containerRef.value.appendChild(this.renderer.domElement);

		this.scene.add(new AmbientLight(0xffffff, 0.5));
		const dirLight = new DirectionalLight(0xffffff, 1);
		dirLight.position.set(5, 10, 7.5);
		this.scene.add(dirLight);

		this.debugCollider = null;
		this.setupDebug();

		this.resizeObserver = new ResizeObserver(() => this.onResize());
		this.resizeObserver.observe(this.containerRef.value);
		this.onResize();

		watch(this.modelsRef, () => this.loadModels());
		this.loadModels();

		this.renderLoop();
	}

	onResize() {
		const el = this.containerRef.value;
		const w = el.clientWidth;
		const h = el.clientHeight;
		this.renderer.setSize(w, h);
		this.camera.left = -w / 2;
		this.camera.right = w / 2;
		this.camera.top = h / 2;
		this.camera.bottom = -h / 2;
		this.camera.updateProjectionMatrix();
		this.canvasWidth = w;
		this.canvasHeight = h;
		this.updateDebug();
	}

	setupDebug() {
		const mat = new MeshBasicMaterial({ color: 0x00ff00, wireframe: true });
		const geo = new BoxGeometry(1, 1, 1);
		this.debugCollider = new Mesh(geo, mat);
		this.scene.add(this.debugCollider);
	}

	updateDebug() {
		const box = unref(this.colliderRef);
		const width = box.width * 0.75;
		const x = box.x + (box.width - width) / 2;
		const y = box.y;
		const centerX = x + width / 2 - this.canvasWidth / 2;
		const centerY = this.canvasHeight / 2 - (y + box.height / 2);
		this.debugCollider.position.set(centerX, centerY, 0);
		this.debugCollider.scale.set(width, box.height, 1);
	}

	loadModels() {
		const items = unref(this.modelsRef);
		for (const item of items) {
			if (!this.allModels.has(item.slug)) {
				this.loader.load(item.modelPath, (gltf) => {
					const obj = gltf.scene;
					obj.scale.set(item.scale, item.scale, item.scale);
					this.allModels.set(item.slug, {
						object: obj,
						soundPath: item.soundPath,
					});
				});

				if (!this.audioSources.has(item.soundPath)) {
					const audio = new Audio(this.listener);
					this.audioLoader.load(item.soundPath, (buffer) => {
						audio.setBuffer(buffer);
					});
					this.audioSources.set(item.soundPath, audio);
				}
			}
		}
	}

	tossItem(slug) {
		const def = this.allModels.get(slug);
		if (!def) return;

		const box = unref(this.colliderRef);
		const width = box.width * 0.75;
		const x = box.x + (box.width - width) / 2;
		const y = box.y;
		const minX = x - this.canvasWidth / 2;
		const maxX = x + width - this.canvasWidth / 2;
		const minY = this.canvasHeight / 2 - (y + box.height);
		const maxY = this.canvasHeight / 2 - y;

		const target = new Vector3(
			(minX + maxX) / 2,
			(minY + maxY) / 2,
			0
		);

		const sound = this.audioSources.get(def.soundPath);

		const tossed = new TossedObject(def.object, target, this.scene, sound);
		this.tossedItems.push(tossed);
	}

	renderLoop() {
		requestAnimationFrame(() => this.renderLoop());

		const box = unref(this.colliderRef);
		const width = box.width * 0.75;
		const x = box.x + (box.width - width) / 2;
		const y = box.y;
		const minX = x - this.canvasWidth / 2;
		const maxX = x + width - this.canvasWidth / 2;
		const minY = this.canvasHeight / 2 - (y + box.height);
		const maxY = this.canvasHeight / 2 - y;

		const colliderBox = { min: { x: minX, y: minY }, max: { x: maxX, y: maxY } };

		this.tossedItems = this.tossedItems.filter(obj => obj.update(colliderBox));
		this.renderer.render(this.scene, this.camera);
	}

	end() {
		this.renderer.dispose();
		this.scene.clear();
		this.allModels.clear();
		this.audioSources.clear();
		this.tossedItems = [];
		this.resizeObserver.disconnect();
	}
}
