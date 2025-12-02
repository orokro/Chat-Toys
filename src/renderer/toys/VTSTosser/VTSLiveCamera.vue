<!--
	VTSLiveCamera.vue
	-----------------

	Displays a live webcam feed (ideally VTubeStudio virtual camera),
	periodically captures frames, and uses a Web Worker with an off-screen
	canvas to detect letterbox black bars. A green bounding box is drawn over
	the actual video content, ignoring the bars.
-->
<template>
	<div class="vts-camera-wrapper">

		<div class="controls-row">
			<button
				type="button"
				class="btn"
				@click="handleStartClick"

				:disabled="isStarting || isRunning"
			>
				Start VTubeStudio Live Camera
			</button>

			<button
				type="button"
				class="btn"
				@click="handleApplyClick"
				:disabled="!isRunning"
			>
				Apply Settings
			</button>

			<span class="status-text">
				{{ statusMessage }}
			</span>
		</div>

		<div class="video-container">
			<video
				ref="videoRef"
				class="camera-video"
				autoplay
				playsinline
				muted
			></video>

			<!-- Bounding box overlay -->
			<div
				ref="boundingBoxOverlayRef"
				class="bounding-box-overlay"
				:style="overlayStyle"
			>
				<div class="relative-wrapper">
					<div 
						class="colliderImage"
						:style="colliderPos"
						@mousedown="handleStartColliderDrag"
					>
						
						<div 
							class="resizeHandle"
							@mousedown="handleStartColliderResize"
						></div>
					</div>
				</div>
			</div>
		</div>

	</div>

</template>
<script setup>

// vue
import { ref, computed, onBeforeUnmount, inject } from 'vue';

// our app
import VTSTosser from './VTSTosser';

// fetch the main app state context & our toy
const ctApp = inject('ctApp');
const toy = ctApp.toyManager.toys[VTSTosser.slug];

/**
 * Reactive references and state
 */
const videoRef = ref(null);
const isRunning = ref(false);
const isStarting = ref(false);
const statusMessage = ref('Camera is idle.');

/** @type {import('vue').Ref<MediaStream|null>} */
const mediaStreamRef = ref(null);

/** @type {import('vue').Ref<number|null>} */
const captureIntervalId = ref(null);

/** @type {import('vue').Ref<Worker|null>} */
const frameWorkerRef = ref(null);

const workerInitialized = ref(false);

/**
 * Bounding box result from the worker, in video pixel coordinates.
 * Shape: { x, y, width, height } or null
 */
const boundingBox = ref(null);


/**
 * Computed overlay style that maps video pixel coordinates
 * to percentages, so the overlay scales correctly with the video element.
 */
const overlayStyle = computed(() => {
	if (!boundingBox.value || !videoRef.value) {
		return { display: 'none' };
	}

	const videoEl = videoRef.value;
	const vw = videoEl.videoWidth;
	const vh = videoEl.videoHeight;

	if (!vw || !vh) {
		return { display: 'none' };
	}

	const box = boundingBox.value;

	const leftPct = (box.x / vw) * 100;
	const topPct = (box.y / vh) * 100;
	const widthPct = (box.width / vw) * 100;
	const heightPct = (box.height / vh) * 100;

	return {
		display: 'block',
		left: leftPct + '%',
		top: topPct + '%',
		width: widthPct + '%',
		height: heightPct + '%'
	};
});


const hasBoundingBox = computed(() => {
	return !!boundingBox.value;
});


/**
 * Build and register the worker lazily. This keeps everything
 * in the renderer context (no Electron main-process changes needed).
 */
function ensureWorker() {
	if (frameWorkerRef.value) {
		return;
	}

	// Inline worker script as a Blob
	// NOTE: Keep indentation tabs and end lines with semicolons for consistency.
	const workerScript = `
		let canvas = null;
		let ctx = null;

		/**
		 * Entry point for messages from the main thread.
		 */
		self.onmessage = function(event) {
			const data = event.data;
			if (!data || !data.type) {
				return;
			}

			if (data.type === 'INIT') {
				// Initialize offscreen canvas with initial size
				canvas = new OffscreenCanvas(data.width, data.height);
				ctx = canvas.getContext('2d');
				return;
			}

			if (data.type === 'FRAME') {
				if (!canvas || !ctx || !data.bitmap) {
					return;
				}

				const bitmap = data.bitmap;

				// Ensure canvas matches incoming frame size
				canvas.width = bitmap.width;
				canvas.height = bitmap.height;

				// Draw frame to canvas
				ctx.drawImage(bitmap, 0, 0);

				try {
					const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
					const box = detectBlackBars(imageData);
					self.postMessage({ type: 'BOX', box: box });
				} catch (err) {
					// If anything fails (e.g., security / context issues), just ignore
					self.postMessage({ type: 'BOX', box: null });
				}

				if (bitmap.close) {
					bitmap.close();
				}
			}
		};

		/**
		 * Detects letterbox-style black bars around the content.
		 * Returns a bounding box { x, y, width, height } in image coordinates,
		 * or null if detection fails.
		 *
		 * @param {ImageData} imageData
		 * @returns {{x:number,y:number,width:number,height:number}|null}
		 */
		function detectBlackBars(imageData) {
			const w = imageData.width;
			const h = imageData.height;
			const data = imageData.data;

			if (!w || !h) {
				return null;
			}

			// Sampling step to avoid scanning every single pixel (performance)
			const maxSamples = 200;
			const rowStep = Math.max(1, Math.floor(h / maxSamples));
			const colStep = Math.max(1, Math.floor(w / maxSamples));

			const darkThreshold = 25; // 0..255 average brightness
			const darkRowRatio = 0.98;
			const darkColRatio = 0.98;

			function isDarkPixel(idx) {
				const r = data[idx];
				const g = data[idx + 1];
				const b = data[idx + 2];
				const brightness = (r + g + b) / 3;
				return brightness < darkThreshold;
			}

			// Scan from top
			let topBar = 0;
			for (let y = 0; y < h; y += rowStep) {
				let darkCount = 0;
				let totalCount = 0;

				for (let x = 0; x < w; x += colStep) {
					const idx = (y * w + x) * 4;
					if (isDarkPixel(idx)) {
						darkCount++;
					}
					totalCount++;
				}

				const ratio = totalCount > 0 ? darkCount / totalCount : 0;

				if (ratio >= darkRowRatio) {
					topBar = y + rowStep;
				} else {
					break;
				}
			}

			// Scan from bottom
			let bottomBarFromBottom = 0;
			for (let y = h - 1; y >= 0; y -= rowStep) {
				let darkCount = 0;
				let totalCount = 0;

				for (let x = 0; x < w; x += colStep) {
					const idx = (y * w + x) * 4;
					if (isDarkPixel(idx)) {
						darkCount++;
					}
					totalCount++;
				}

				const ratio = totalCount > 0 ? darkCount / totalCount : 0;

				if (ratio >= darkRowRatio) {
					bottomBarFromBottom = (h - y);
				} else {
					break;
				}
			}

			const bottomBar = bottomBarFromBottom;

			// Scan from left
			let leftBar = 0;
			for (let x = 0; x < w; x += colStep) {
				let darkCount = 0;
				let totalCount = 0;

				for (let y = 0; y < h; y += rowStep) {
					const idx = (y * w + x) * 4;
					if (isDarkPixel(idx)) {
						darkCount++;
					}
					totalCount++;
				}

				const ratio = totalCount > 0 ? darkCount / totalCount : 0;

				if (ratio >= darkColRatio) {
					leftBar = x + colStep;
				} else {
					break;
				}
			}

			// Scan from right
			let rightBarFromRight = 0;
			for (let x = w - 1; x >= 0; x -= colStep) {
				let darkCount = 0;
				let totalCount = 0;

				for (let y = 0; y < h; y += rowStep) {
					const idx = (y * w + x) * 4;
					if (isDarkPixel(idx)) {
						darkCount++;
					}
					totalCount++;
				}

				const ratio = totalCount > 0 ? darkCount / totalCount : 0;

				if (ratio >= darkColRatio) {
					rightBarFromRight = (w - x);
				} else {
					break;
				}
			}

			const rightBar = rightBarFromRight;

			// Compute totals
			const totalVerticalBars = topBar + bottomBar;
			const totalHorizontalBars = leftBar + rightBar;

			// If no obvious bars detected, just return full frame
			if (totalVerticalBars === 0 && totalHorizontalBars === 0) {
				return {
					x: 0,
					y: 0,
					width: w,
					height: h
				};
			}

			let x = 0;
			let y = 0;
			let width = w;
			let height = h;

			// Decide whether bars are more likely horizontal (top/bottom) or vertical (left/right)
			if (totalVerticalBars >= totalHorizontalBars) {
				// Likely top/bottom bars
				y = topBar;
				height = h - topBar - bottomBar;
			} else {
				// Likely left/right bars
				x = leftBar;
				width = w - leftBar - rightBar;
			}

			// Sanity checks
			if (width <= 0 || height <= 0) {
				return null;
			}

			return {
				x: x,
				y: y,
				width: width,
				height: height
			};
		}
	`;

	const blob = new Blob([workerScript], { type: 'application/javascript' });
	const url = URL.createObjectURL(blob);
	const worker = new Worker(url);

	worker.onmessage = (event) => {
		const data = event.data;
		if (!data || data.type !== 'BOX') {
			return;
		}

		const box = data.box;

		if (box && typeof box.x === 'number') {
			boundingBox.value = box;
		} else {
			// Detection failed; clear bounding box
			boundingBox.value = null;
		}
	};

	frameWorkerRef.value = worker;
}


/**
 * Clear and terminate the worker, if any.
 */
function disposeWorker() {
	if (frameWorkerRef.value) {
		frameWorkerRef.value.terminate();
		frameWorkerRef.value = null;
	}
	workerInitialized.value = false;
}


/**
 * Start the periodic frame capture loop.
 */
function startFrameCapture() {
	if (!videoRef.value) {
		return;
	}

	ensureWorker();

	if (captureIntervalId.value !== null) {
		clearInterval(captureIntervalId.value);
		captureIntervalId.value = null;
	}

	// Capture frame every 500ms (tweak this as needed)
	const intervalMs = 500;

	captureIntervalId.value = window.setInterval(() => {
		captureFrameOnce();
	}, intervalMs);
}


/**
 * Capture a single frame from the video and send it to the worker.
 */
function captureFrameOnce() {
	const videoEl = videoRef.value;
	const worker = frameWorkerRef.value;

	if (!videoEl || !worker) {
		return;
	}

	if (videoEl.readyState < 2 /* HAVE_CURRENT_DATA */) {
		return;
	}

	const vw = videoEl.videoWidth;
	const vh = videoEl.videoHeight;

	if (!vw || !vh) {
		return;
	}

	// Initialize worker size once we know the video dimensions
	if (!workerInitialized.value) {
		worker.postMessage({
			type: 'INIT',
			width: vw,
			height: vh
		});
		workerInitialized.value = true;
	}

	// Create an ImageBitmap from the current video frame and send it to the worker
	createImageBitmap(videoEl)
		.then((bitmap) => {
			worker.postMessage(
				{
					type: 'FRAME',
					bitmap: bitmap
				},
				[bitmap]
			);
		})
		.catch(() => {
			// Ignore errors (e.g., transient issues)
		});
}


/**
 * Stop the frame capture interval and clear bounding box.
 */
function stopFrameCapture() {
	if (captureIntervalId.value !== null) {
		clearInterval(captureIntervalId.value);
		captureIntervalId.value = null;
	}
}


/**
 * Stop the camera stream and clean up tracks.
 */
function stopCameraStream() {
	const stream = mediaStreamRef.value;
	if (!stream) {
		return;
	}

	stream.getTracks().forEach((track) => {
		try {
			track.stop();
		} catch (_) {
			// ignore
		}
	});

	mediaStreamRef.value = null;

	if (videoRef.value) {
		videoRef.value.srcObject = null;
	}
}


/**
 * Try to choose the "VTubeStudioCam" device if available.
 * Note: Browsers typically require that media permissions have been
 * granted at least once before labels are available.
 *
 * @returns {Promise<MediaStreamConstraints['video']>}
 */
async function buildVideoConstraints() {
	const baseConstraints = {
		width: { ideal: 1280 },
		height: { ideal: 720 }
	};

	// Default constraints (no deviceId) so the browser picker can appear
	let finalConstraints = { ...baseConstraints };

	// Try to auto-select the VTubeStudio virtual camera if label is available
	if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
		try {
			const devices = await navigator.mediaDevices.enumerateDevices();
			const vtsDevice = devices.find((d) => {
				return d.kind === 'videoinput' && d.label && d.label.includes('VTubeStudioCam');
			});

			if (vtsDevice) {
				finalConstraints = {
					...baseConstraints,
					deviceId: { exact: vtsDevice.deviceId }
				};
			}
		} catch (_) {
			// If enumeration fails for any reason, just fall back to base constraints
		}
	}

	return finalConstraints;
}


/**
 * Handle "Start VTubeStudio Live Camera" button click.
 */
async function handleStartClick() {

	if (isStarting.value || isRunning.value) {
		return;
	}

	if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
		statusMessage.value = 'getUserMedia is not supported in this environment.';
		return;
	}

	isStarting.value = true;
	statusMessage.value = 'Requesting camera...';

	try {
		const videoConstraints = await buildVideoConstraints();

		/** @type {MediaStream} */
		const stream = await navigator.mediaDevices.getUserMedia({
			video: videoConstraints,
			audio: false
		});

		mediaStreamRef.value = stream;

		if (videoRef.value) {
			videoRef.value.srcObject = stream;
			await videoRef.value.play();
		}

		isRunning.value = true;
		statusMessage.value = 'Camera running. Detecting feed boundary...';

		startFrameCapture();
	} catch (err) {
		console.error('Error starting camera:', err);
		statusMessage.value = 'Failed to start camera. Check permissions and device.';
	} finally {
		isStarting.value = false;
	}
}


/**
 * Handle "Apply Settings" button click.
 * For now, this will simply stop the camera feed and capture loop.
 * You can later extend this to persist the bounding box.
 */
function handleApplyClick() {
	if (!isRunning.value) {
		return;
	}

	// In a later pass, you can read `boundingBox.value` here and
	// send it to your settings/store.
	statusMessage.value = 'Settings applied. Camera stopped for now.';

	stopFrameCapture();
	stopCameraStream();
	disposeWorker();

	boundingBox.value = null;
	isRunning.value = false;
}


/**
 * Cleanup on component unmount.
 */
onBeforeUnmount(() => {
	stopFrameCapture();
	stopCameraStream();
	disposeWorker();
});


const boundingBoxOverlayRef = ref(null);



const colliderBox = ref({
	x: 0,
	y: 0,
	width: 200,
	height: 300,
});

const colliderPos = computed(() => {
	return {
		left: colliderBox.value.x + 'px',
		top:  colliderBox.value.y + 'px',
		width: colliderBox.value.width + 'px',
		height: colliderBox.value.height + 'px',
	};
});


// handle the drag of the collider box
function handleStartColliderDrag(e){
	doDrag(['x', 'y']);
}


// handle the resize of the collider box
function handleStartColliderResize(e){

	e.cancelBubble = true;
	doDrag(['width', 'height']);
}


// generic drag function for either x/y or width/height
function doDrag(keys){

	// save initial position
	const initialBox = {
		...colliderBox.value
	};

	// start the drag
	ctApp.dragHelper.dragStart(
		
		// during drag
		(dx, dy)=>{

			const newBox = {
				...colliderBox.value,
			};
			newBox[keys[0]] = initialBox[keys[0]] - dx;
			newBox[keys[1]] = initialBox[keys[1]] - dy;

			// update live box
			colliderBox.value = newBox;
		},

		// upon complete
		(dx, dy)=>{

		}
	);

}



</script>
<style lang="scss" scoped>

	// outer wrapper
	.vts-camera-wrapper {

		display: flex;
		flex-direction: column;
		gap: 0.75rem;

		// row for the buttons and status
		.controls-row {
			display: flex;
			align-items: center;
			gap: 0.75rem;
			flex-wrap: wrap;
		}

		// our button styles
		.btn {
			padding: 0.4rem 0.8rem;
			border-radius: 4px;
			border: 1px solid #444;
			background: #222;
			color: #f5f5f5;
			font-size: 0.9rem;
			cursor: pointer;
			transition: background 0.15s ease, transform 0.05s ease;

			&:hover:enabled {
				background: #333;
				transform: translateY(-1px);
			}

			&:disabled {
				cursor: default;
				opacity: 0.6;
			}

		}// .btn

		// status text area
		.status-text {

			font-size: 0.85rem;
			color: #aaa;

		}// .status-text

		// container for the video and overlay
		.video-container {

			position: relative;
			width: 900px;
			max-width: 100%;
			// 4:3 aspect ratio (1.33)
			/* aspect-ratio: 4 / 3; */
			background: #000;
			overflow: hidden;

		}// .video-container

		// the video element showing the camera feed
		.camera-video {
			width: 100%;
			height: 100%;
			
			object-fit: contain;
			background: #000;
			display: block;

		}// .camera-video

		// the green box that frames the detected content area
		.bounding-box-overlay {

			position: absolute;
			border: 3px solid #00ff00;
			box-sizing: border-box;
			pointer-events: none;

			// use to reset positioning context
			.relative-wrapper {

				// for debug:
				border: 1px solid red;

				width: 100%;
				height: 100%;
				position: relative;

				// the area where we show a collider to send the info to ThreeJS
				.colliderImage {

					// absolute position
					position: absolute;

					// silhouette collider image
					background-image: url('/assets/tosser_collider_outline.png');
					background-position: 0px 0px;
					background-size: 100% 100%;

					// re-enable pointer events & make look movable
					pointer-events: initial !important;
					cursor: move;

					// light up on hover
					opacity: 1;
					border: 2px dashed white;
					

					// the box to resize. Only one for this widget cuz lazy
					.resizeHandle {

						// fixed position square on the bottom-right
						position: absolute;
						bottom: -15px;
						right: -15px;
						width: 30px;
						height: 30px;

						// gray box
						background: gray;
						border: 2px solid black;

						// appear resizable	
						cursor: nwse-resize;

					}// .resizeHandle

				}// .colliderImage

			}// .relative-wrapper

		}// .bounding-box-overlay

	}// .vts-camera-wrapper

</style>
