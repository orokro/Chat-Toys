<!--
	NineSliceEditorModal.vue
	------------------------

	A reusable, asset-agnostic 9-slice / frame editor.

	Open it with promptModal(NineSliceEditorModal, { imageUrl, config, title }).
	Drag the four guides over the source image to set the border-image slice
	regions, then dial in frame width, padding and margin. A live result
	preview shows the framed box as it will render. Save resolves the prompt
	with { index: 0, value: <frame config> }; Cancel/close resolves null.

	Any toy that needs a sliceable background can reuse this - it knows nothing
	about chat. The config shape + CSS output live in nineSlice.js so the editor
	preview and the live widget always agree.
-->
<template>

	<ModalWindowFrame :title="title" :width="modalWidth" :height="modalHeight">

		<div class="nse">

			<div v-if="!imageUrl" class="noImg">
				Pick an image first, then edit its slicing.
			</div>

			<div v-else class="cols">

				<!-- LEFT: source image with draggable slice guides -->
				<div class="srcCol">
					<div class="hint">Drag the guides to set the 9-slice regions.</div>
					<div
						ref="stageRef"
						class="srcStage"
						:style="{ width: displayW + 'px', height: displayH + 'px' }"
					>
						<img
							:src="imageUrl"
							class="srcImg"
							draggable="false"
							@load="onImgLoad"
						/>
						<!-- shaded center region -->
						<div
							class="centerBox"
							:style="{
								left: (cfg.slice.left * scale) + 'px',
								top: (cfg.slice.top * scale) + 'px',
								right: (cfg.slice.right * scale) + 'px',
								bottom: (cfg.slice.bottom * scale) + 'px',
							}"
						></div>
						<div class="guide v" :style="{ left: (cfg.slice.left * scale) + 'px' }" @pointerdown="startDrag('left', $event)"></div>
						<div class="guide v" :style="{ left: (displayW - cfg.slice.right * scale) + 'px' }" @pointerdown="startDrag('right', $event)"></div>
						<div class="guide h" :style="{ top: (cfg.slice.top * scale) + 'px' }" @pointerdown="startDrag('top', $event)"></div>
						<div class="guide h" :style="{ top: (displayH - cfg.slice.bottom * scale) + 'px' }" @pointerdown="startDrag('bottom', $event)"></div>
					</div>

					<div class="quad">
						<div class="quadHead"><label>Slice (source px)</label></div>
						<span v-for="side in SIDES" :key="side">
							{{ sideAbbr[side] }}
							<input type="number" min="0" v-model.number="cfg.slice[side]" />
						</span>
					</div>

					<label class="fillToggle">
						<input type="checkbox" v-model="cfg.fill" />
						Keep center fill
					</label>
				</div>

				<!-- RIGHT: result preview + frame/padding/margin controls -->
				<div class="ctrlCol">

					<div class="resultWrap">
						<div class="result" :style="resultStyle">
							<span class="sampleName">Name</span>
							<span class="sampleMsg">sample message</span>
						</div>
					</div>

					<div v-for="q in quadGroups" :key="q.key" class="quad">
						<div class="quadHead">
							<label>{{ q.label }}</label>
							<label class="linkToggle">
								<input type="checkbox" v-model="links[q.key]" /> link
							</label>
						</div>
						<span v-for="side in SIDES" :key="side">
							{{ sideAbbr[side] }}
							<input
								type="number"
								min="0"
								:value="cfg[q.key][side]"
								@input="setSide(q.key, side, $event)"
							/>
						</span>
					</div>

				</div>

			</div>

			<div class="footer">
				<button class="btn" @click="cancel">Cancel</button>
				<button class="btn primary" @click="save">Save</button>
			</div>

		</div>

	</ModalWindowFrame>

</template>
<script setup>

// vue
import { ref, reactive, computed, onBeforeUnmount } from 'vue';

// components
import ModalWindowFrame from './ModalWindowFrame.vue';

// lib misc
import { closeModal, Modal } from 'jenesius-vue-modal';

// shared frame helpers
import { normalizeSliceConfig, frameStyle } from './nineSlice';

// props
const props = defineProps({
	title: { type: String, default: 'Edit Slicing' },
	imageUrl: { type: String, default: '' },
	config: { type: Object, default: null },
});

// jenesius-vue-modal: emit Modal.EVENT_PROMPT to resolve the prompt
const emit = defineEmits([Modal.EVENT_PROMPT]);

const modalWidth = 'min(92vw, 780px)';
const modalHeight = 'min(92vh, 600px)';

// the four sides, in CSS shorthand order, plus short labels
const SIDES = ['top', 'right', 'bottom', 'left'];
const sideAbbr = { top: 'T', right: 'R', bottom: 'B', left: 'L' };

// editable working copy (deeply reactive)
const cfg = reactive(normalizeSliceConfig(props.config));

// which quad groups get a "link all four" toggle
const quadGroups = [
	{ key: 'border', label: 'Frame Width (px)' },
	{ key: 'padding', label: 'Padding (px)' },
	{ key: 'margin', label: 'Margin (px)' },
];
const links = reactive({ border: true, padding: false, margin: false });

// --- source image sizing ---
const natW = ref(0);
const natH = ref(0);
const MAX_W = 360;
const MAX_H = 300;

// uniform display scale to fit the source into the stage
const scale = computed(() => {
	if (!natW.value || !natH.value) return 1;
	return Math.min(MAX_W / natW.value, MAX_H / natH.value);
});
const displayW = computed(() => Math.round((natW.value || MAX_W) * scale.value));
const displayH = computed(() => Math.round((natH.value || MAX_H) * scale.value));


/**
 * Capture the source image's natural dimensions once it loads.
 *
 * @param {Event} e - the img load event
 */
function onImgLoad(e) {
	natW.value = e.target.naturalWidth || 0;
	natH.value = e.target.naturalHeight || 0;
}


/**
 * Set one side of a quad group, honoring the group's "link" toggle (which
 * mirrors the value to all four sides).
 *
 * @param {String} groupKey - 'border' | 'padding' | 'margin'
 * @param {String} side - 'top' | 'right' | 'bottom' | 'left'
 * @param {Event} ev - the input event
 */
function setSide(groupKey, side, ev) {
	const val = Math.max(0, parseInt(ev.target.value, 10) || 0);
	if (links[groupKey]) {
		for (const s of SIDES) cfg[groupKey][s] = val;
	} else {
		cfg[groupKey][side] = val;
	}
}


// --- guide dragging ---
const stageRef = ref(null);
let dragEdge = null;

/**
 * Begin dragging a slice guide.
 *
 * @param {String} edge - which guide ('top'|'right'|'bottom'|'left')
 * @param {PointerEvent} e - the pointerdown event
 */
function startDrag(edge, e) {
	dragEdge = edge;
	e.preventDefault();
	window.addEventListener('pointermove', onMove);
	window.addEventListener('pointerup', endDrag);
}

/**
 * Update the dragged slice value from the pointer position (converted from
 * displayed px back to source px), clamped so opposing guides can't cross.
 *
 * @param {PointerEvent} e - the pointermove event
 */
function onMove(e) {
	if (!dragEdge || !stageRef.value) return;
	const rect = stageRef.value.getBoundingClientRect();
	const sc = scale.value || 1;

	let px;
	if (dragEdge === 'left') px = e.clientX - rect.left;
	else if (dragEdge === 'right') px = rect.right - e.clientX;
	else if (dragEdge === 'top') px = e.clientY - rect.top;
	else px = rect.bottom - e.clientY;

	// displayed px -> source px
	let v = Math.round(Math.max(0, px) / sc);

	// clamp so the opposing slice doesn't overlap (leave >= 1px center)
	if (dragEdge === 'left') v = Math.min(v, natW.value - cfg.slice.right - 1);
	else if (dragEdge === 'right') v = Math.min(v, natW.value - cfg.slice.left - 1);
	else if (dragEdge === 'top') v = Math.min(v, natH.value - cfg.slice.bottom - 1);
	else v = Math.min(v, natH.value - cfg.slice.top - 1);

	cfg.slice[dragEdge] = Math.max(0, v);
}

/**
 * End a guide drag and detach the temporary window listeners.
 */
function endDrag() {
	dragEdge = null;
	window.removeEventListener('pointermove', onMove);
	window.removeEventListener('pointerup', endDrag);
}

onBeforeUnmount(endDrag);


// live result preview style (a fixed sample box uses the sliced frame)
const resultStyle = computed(() => ({
	...frameStyle({ mode: 'sliced', url: props.imageUrl, config: cfg }),
	width: '100%',
	height: '100%',
}));


/**
 * Save: resolve the prompt with a plain-object copy of the config.
 */
function save() {
	emit(Modal.EVENT_PROMPT, { index: 0, value: JSON.parse(JSON.stringify(cfg)) });
}

/**
 * Cancel: close without a value (promptModal resolves null).
 */
function cancel() {
	closeModal();
}

</script>
<style lang="scss" scoped>

	.nse {
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 6px;
	}

	.noImg {
		padding: 30px;
		text-align: center;
		opacity: 0.7;
	}

	.cols {
		display: flex;
		gap: 18px;
		flex-wrap: wrap;
	}

	.srcCol, .ctrlCol {
		display: flex;
		flex-direction: column;
		gap: 10px;
		min-width: 300px;
	}

	.hint {
		font-size: 0.85em;
		opacity: 0.75;
	}

	.srcStage {
		position: relative;
		background: url('/assets/alpha_checkers.png');
		background-size: 12px;
		border: 2px solid black;
		border-radius: 4px;
		user-select: none;
		touch-action: none;
		overflow: hidden;

		.srcImg {
			position: absolute;
			inset: 0;
			width: 100%;
			height: 100%;
			pointer-events: none;
		}

		.centerBox {
			position: absolute;
			border: 1px dashed rgba(255, 0, 128, 0.9);
			background: rgba(255, 0, 128, 0.08);
			pointer-events: none;
		}

		.guide {
			position: absolute;
			background: rgba(255, 0, 128, 0.9);

			&.v {
				top: 0;
				bottom: 0;
				width: 2px;
				margin-left: -3px;
				padding: 0 2px;
				cursor: ew-resize;
			}
			&.h {
				left: 0;
				right: 0;
				height: 2px;
				margin-top: -3px;
				padding: 2px 0;
				cursor: ns-resize;
			}
		}
	}

	.quad {
		.quadHead {
			display: flex;
			justify-content: space-between;
			align-items: center;
			margin-bottom: 2px;

			label { font-weight: bold; font-size: 0.9em; }
			.linkToggle { font-weight: normal; opacity: 0.8; }
		}

		span {
			display: inline-flex;
			align-items: center;
			gap: 3px;
			margin-right: 8px;
			font-size: 0.85em;

			input {
				width: 56px;
				padding: 3px 5px;
				border: 2px solid black;
				border-radius: 4px;
			}
		}
	}

	.fillToggle {
		font-size: 0.9em;
	}

	.resultWrap {
		width: 100%;
		height: 170px;
		background: #3a3a3a url('/assets/alpha_checkers.png');
		background-size: 14px;
		border: 2px solid black;
		border-radius: 4px;
		display: flex;
		align-items: stretch;
		justify-content: stretch;
		overflow: hidden;

		.result {
			display: flex;
			flex-direction: column;
			justify-content: flex-end;
			color: #fff;
			font-weight: bold;
			text-shadow: 0.05em 0.05em 0 #000;

			.sampleName { color: #6fe3ff; }
			.sampleMsg { font-weight: normal; }
		}
	}

	.footer {
		display: flex;
		justify-content: flex-end;
		gap: 10px;
		border-top: 2px solid rgba(0, 0, 0, 0.1);
		padding-top: 10px;

		.btn {
			padding: 7px 18px;
			border: 2px solid black;
			border-radius: 999px;
			background: #eee;
			font-weight: bold;
			cursor: pointer;

			&.primary {
				background: #00ABAE;
				color: #fff;
			}
		}
	}

</style>
