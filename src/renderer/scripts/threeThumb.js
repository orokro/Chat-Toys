/*
	threeThumb.js
	-------------

	This module provides a function to generate a thumbnail image from a 3D model file.

	We use Three.js to load the model and render it to a canvas, then return the canvas as a data URL.
*/

// three	
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader';

// so we can cache the thumbnails if we see the same file again
const cache = new Map();

/**
 * Function to compute a SHA-256 hash from a file
 * 
 * @param {File} file - JavaScript File object representing the 3D model file
 * @returns Hash
 */
async function hashFile(file) {
	const arrayBuffer = await file.arrayBuffer();
	const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}


/**
 * Generate a thumbnail image from a 3D model file.
 * 
 * @param {File} file - JavaScript File object representing the 3D model file
 * @param {Number} width - OPTIONAL; width of the thumbnail image
 * @param {Number} height - OPTIONAL; height of the thumbnail image
 * @returns {Promise} - A promise that resolves with the thumbnail image data URL
 */
export async function getThumb(file, width = 300, height = 200) {

	// Compute the file hash
	const hash = await hashFile(file);

	// if we've seen this file before, return the cached thumbnail & GTFO	
	if (cache.has(hash)) {
		// console.log(`found in cache for ${file.name}`);
		return cache.get(hash);
	}

	// async wrapper cuz we loading stuffs
	return new Promise((resolve, reject) => {

		// set up a basic threeJS scene with camera, renderer, and lights
		const scene = new THREE.Scene();
		const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
		const renderer = new THREE.WebGLRenderer({ alpha: true });
		renderer.setSize(width, height);

		// lights
		const light = new THREE.PointLight(0xffffff, 100.2);
		light.position.set(5, 5, 5);
		scene.add(light);
		const ambientLight = new THREE.AmbientLight(0xFFFFFF, 5.75);
		scene.add(ambientLight);

		// for now we'll support just FBX and GLB, but in future may expand this
		const loader = file.name.endsWith('.fbx') ? new FBXLoader() : new GLTFLoader();
		const reader = new FileReader();

		// once we have the file loaded, parse it and render it to the canvas
		reader.onload = function (event) {
			try {
				const arrayBuffer = event.target.result;
				loader.parse(arrayBuffer, '', (object) => {

					// GLB will probably load a scene instead of direct object like GBX
					const model = object.scene || object;
					scene.add(model);

					// we'll use a Box3 to get the size of the model and center it
					const box = new THREE.Box3().setFromObject(model);
					const center = new THREE.Vector3();
					box.getCenter(center);
					model.position.sub(center);

					// set the camera position based on the model size
					const size = new THREE.Vector3();
					box.getSize(size);
					const maxDim = Math.max(size.x, size.y, size.z);
					const fov = camera.fov * (Math.PI / 180);
					const distance = Math.abs(maxDim / (2 * Math.tan(fov / 2)));
					camera.position.set(0, 0, distance * 1.5);
					camera.lookAt(new THREE.Vector3(0, 0, 0));

					// render the scene to the canvas
					renderer.render(scene, camera);

					// get the image data & cache it
					const imgData = renderer.domElement.toDataURL('image/png');
					cache.set(hash, imgData);

					// resolve the promise with the image data
					resolve(imgData);

					// Cleanup
					scene.remove(model);
					model.traverse((child) => {
						if (child.geometry) child.geometry.dispose();
						if (child.material) {
							if (Array.isArray(child.material)) {
								child.material.forEach(mat => mat.dispose());
							} else {
								child.material.dispose();
							}
						}
					});
					renderer.dispose();

				}, reject);

			} catch (e) {
				console.error(e);
			}
		};

		// load the file as an array buffer
		reader.onerror = reject;
		reader.readAsArrayBuffer(file);
	});
}
