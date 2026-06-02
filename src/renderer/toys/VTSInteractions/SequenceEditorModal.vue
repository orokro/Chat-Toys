<!--
	SequenceEditorModal.vue
	-----------------------

	Edits ONE (command x model) sequence for the VTS Interactions toy.

	A sequence is an ordered list of blocks:
	  - hotkey:     { id, type:'hotkey', hotkeyID, label }
	  - expression: { id, type:'expression', file, action:'activate'|'deactivate'|'toggle', label }
	  - wait:       { id, type:'wait', seconds }

	Scratch-style VERTICAL editor: blocks stack top-to-bottom (execution order),
	connected under a "hat" cap. Drag a block from the palette into the stack,
	drag a block's grip to reorder (drop on a gap), or use the up/down buttons.
	Each block carries its own controls and a trash button.
-->
<template>

	<ModalWindowFrame
		:title="`Edit Sequence: !${commandName}`"
		:width="700"
		:height="660"
	>
		<div class="editorContent">

			<!-- context -->
			<div class="ctxBar">
				<div>
					Model: <strong>{{ model.modelName }}</strong>
					<span class="meta">({{ model.hotkeys.length }} hotkeys, {{ model.expressions.length }} expressions)</span>
				</div>
				<div class="hint">Drag a block into the stack · drag a grip to reorder</div>
			</div>

			<!-- palette: draggable source blocks -->
			<div class="palette">
				<span class="paletteLbl">Blocks:</span>
				<div
					class="srcBlock hotkey"
					:class="{ disabled: model.hotkeys.length === 0 }"
					:draggable="model.hotkeys.length > 0"
					title="Trigger a hotkey"
					@dragstart="onPaletteDragStart('hotkey', $event)"
					@dragend="endDrag"
					@click="appendBlock('hotkey')"
				>+ Hotkey</div>
				<div
					class="srcBlock expression"
					:class="{ disabled: model.expressions.length === 0 }"
					:draggable="model.expressions.length > 0"
					title="Activate / deactivate / toggle an expression"
					@dragstart="onPaletteDragStart('expression', $event)"
					@dragend="endDrag"
					@click="appendBlock('expression')"
				>+ Expression</div>
				<div
					class="srcBlock wait"
					draggable="true"
					title="Pause before the next block"
					@dragstart="onPaletteDragStart('wait', $event)"
					@dragend="endDrag"
					@click="appendBlock('wait')"
				>+ Wait</div>
			</div>

			<!-- the vertical stack canvas -->
			<div
				class="canvas"
				@dragover.prevent
				@drop.prevent="dropAt(blocks.length)"
			>
				<!-- hat cap = sequence start -->
				<div class="hatCap">▶ When <span class="cmd">!{{ commandName }}</span> runs</div>

				<!-- empty hint -->
				<div v-if="blocks.length === 0" class="emptyHint">
					Drag a block here, or click one above to add it.
				</div>

				<template v-for="(b, i) in blocks" :key="b.id">

					<!-- drop zone before block i -->
					<div
						class="dropZone"
						:class="{ over: dragOverIndex === i }"
						@dragenter.prevent="dragOverIndex = i"
						@dragover.prevent
						@dragleave="onZoneLeave(i)"
						@drop.prevent="dropAt(i)"
					></div>

					<!-- the block -->
					<div class="block" :class="b.type">

						<!-- drag grip -->
						<div
							class="grip"
							draggable="true"
							title="Drag to reorder"
							@dragstart="onBlockDragStart(i, $event)"
							@dragend="endDrag"
						>⠿</div>

						<!-- hotkey -->
						<template v-if="b.type === 'hotkey'">
							<span class="tag">HOTKEY</span>
							<select v-model="b.hotkeyID" @change="syncLabel(b)">
								<option v-for="hk in model.hotkeys" :key="hk.hotkeyID" :value="hk.hotkeyID">{{ hk.name }}</option>
							</select>
						</template>

						<!-- expression -->
						<template v-else-if="b.type === 'expression'">
							<span class="tag">EXPRESSION</span>
							<select v-model="b.file" @change="syncLabel(b)">
								<option v-for="ex in model.expressions" :key="ex.file" :value="ex.file">{{ ex.name }}</option>
							</select>
							<select v-model="b.action" class="actionSel">
								<option value="activate">On</option>
								<option value="deactivate">Off</option>
								<option value="toggle">Toggle</option>
							</select>
						</template>

						<!-- wait -->
						<template v-else>
							<span class="tag">WAIT</span>
							<input type="number" v-model.number="b.seconds" min="0" max="60" step="0.1" class="waitInput" />
							<span class="unit">seconds</span>
						</template>

						<!-- control cluster -->
						<div class="blockCtl">
							<button :disabled="i === 0" title="Move up" @click="move(i, -1)">▲</button>
							<button :disabled="i === blocks.length - 1" title="Move down" @click="move(i, 1)">▼</button>
							<button class="del" title="Remove" @click="remove(i)">🗑</button>
						</div>
					</div>
				</template>

				<!-- trailing drop zone -->
				<div
					class="dropZone end"
					:class="{ over: dragOverIndex === blocks.length }"
					@dragenter.prevent="dragOverIndex = blocks.length"
					@dragover.prevent
					@dragleave="onZoneLeave(blocks.length)"
					@drop.prevent="dropAt(blocks.length)"
				></div>
			</div>

			<!-- footer -->
			<div class="buttons">
				<button class="primary" @click="save">Save</button>
				<button @click="cancel">Cancel</button>
			</div>

		</div>
	</ModalWindowFrame>

</template>
<script setup>

// vue
import { ref } from 'vue';

// components
import ModalWindowFrame from '@components/options/ModalWindowFrame.vue';

// lib/misc
import { Modal } from 'jenesius-vue-modal';
import { v4 as uuidv4 } from 'uuid';

// props
const props = defineProps({

	// command name (display only)
	commandName: {
		type: String,
		default: '',
	},

	// cached model entry: { modelID, modelName, hotkeys:[], expressions:[] }
	model: {
		type: Object,
		required: true,
	},

	// starting blocks (a clone owned by this modal)
	blocks: {
		type: Array,
		default: () => [],
	},
});

// close-with-value event for jenesius prompt modals
const emit = defineEmits([Modal.EVENT_PROMPT]);

// local editable copy
const blocks = ref(props.blocks.map(b => ({ ...b })));

// in-app drag payload (more reliable than dataTransfer.getData during dragover)
// { mode:'new', type } | { mode:'move', fromIndex }
const dragData = ref(null);

// which gap is currently highlighted as a drop target
const dragOverIndex = ref(null);


/**
 * Factory for a fresh block of the given type, defaulting selections to the
 * model's first available hotkey / expression.
 *
 * @param {'hotkey'|'expression'|'wait'} type
 * @returns {Object}
 */
function createBlock(type) {

	if (type === 'hotkey') {
		const hk = props.model.hotkeys[0];
		return { id: uuidv4(), type: 'hotkey', hotkeyID: hk?.hotkeyID, label: hk?.name || '' };
	}
	if (type === 'expression') {
		const ex = props.model.expressions[0];
		return { id: uuidv4(), type: 'expression', file: ex?.file, action: 'toggle', label: ex?.name || '' };
	}
	return { id: uuidv4(), type: 'wait', seconds: 1 };
}


/**
 * Click fallback: append a block of the given type to the end of the stack.
 *
 * @param {'hotkey'|'expression'|'wait'} type
 */
function appendBlock(type) {

	if (type === 'hotkey' && props.model.hotkeys.length === 0)
		return;
	if (type === 'expression' && props.model.expressions.length === 0)
		return;

	blocks.value.push(createBlock(type));
}


/**
 * Begin dragging a new block out of the palette.
 *
 * @param {'hotkey'|'expression'|'wait'} type
 * @param {DragEvent} e
 */
function onPaletteDragStart(type, e) {

	if (type === 'hotkey' && props.model.hotkeys.length === 0)
		return;
	if (type === 'expression' && props.model.expressions.length === 0)
		return;

	dragData.value = { mode: 'new', type };
	if (e.dataTransfer) {
		e.dataTransfer.setData('text/plain', type);
		e.dataTransfer.effectAllowed = 'copy';
	}
}


/**
 * Begin dragging an existing block to reorder it. Uses the whole block as the
 * drag image even though the grip is the draggable element.
 *
 * @param {Number} index
 * @param {DragEvent} e
 */
function onBlockDragStart(index, e) {

	dragData.value = { mode: 'move', fromIndex: index };
	if (e.dataTransfer) {
		e.dataTransfer.setData('text/plain', 'move');
		e.dataTransfer.effectAllowed = 'move';
		const blockEl = e.target?.closest?.('.block');
		if (blockEl)
			e.dataTransfer.setDragImage(blockEl, 24, 20);
	}
}


/**
 * Clear drag state at the end of any drag.
 */
function endDrag() {
	dragData.value = null;
	dragOverIndex.value = null;
}


/**
 * Only clear the highlight if we're leaving the gap that's currently active
 * (prevents flicker as the pointer crosses child elements).
 *
 * @param {Number} index
 */
function onZoneLeave(index) {
	if (dragOverIndex.value === index)
		dragOverIndex.value = null;
}


/**
 * Drop handler for a gap. Inserts a new block, or moves an existing one,
 * at the target index (insert-before semantics; targetIndex can equal length).
 *
 * @param {Number} targetIndex
 */
function dropAt(targetIndex) {

	const d = dragData.value;
	if (!d) {
		dragOverIndex.value = null;
		return;
	}

	if (d.mode === 'new') {
		blocks.value.splice(targetIndex, 0, createBlock(d.type));

	} else {
		const from = d.fromIndex;
		let to = targetIndex;
		const [moved] = blocks.value.splice(from, 1);
		// removing an earlier element shifts the target up by one
		if (from < to)
			to -= 1;
		blocks.value.splice(to, 0, moved);
	}

	endDrag();
}


/**
 * Refresh a block's denormalized label after its dropdown changes, so the
 * matrix preview / offline display stays meaningful.
 *
 * @param {Object} b
 */
function syncLabel(b) {

	if (b.type === 'hotkey') {
		const hk = props.model.hotkeys.find(h => h.hotkeyID === b.hotkeyID);
		b.label = hk?.name || '';
	} else if (b.type === 'expression') {
		const ex = props.model.expressions.find(e => e.file === b.file);
		b.label = ex?.name || '';
	}
}


/**
 * Reorder fallback: move a block up (-1) or down (+1).
 *
 * @param {Number} index
 * @param {Number} dir
 */
function move(index, dir) {
	const target = index + dir;
	if (target < 0 || target >= blocks.value.length)
		return;
	const arr = blocks.value;
	[arr[index], arr[target]] = [arr[target], arr[index]];
}


/**
 * Remove a block.
 *
 * @param {Number} index
 */
function remove(index) {
	blocks.value.splice(index, 1);
}


/**
 * Save: return the edited blocks to the matrix.
 */
function save() {
	emit(Modal.EVENT_PROMPT, { blocks: blocks.value.map(b => ({ ...b })) });
}


/**
 * Cancel: close without returning anything.
 */
function cancel() {
	emit(Modal.EVENT_PROMPT, null);
}

</script>
<style lang="scss" scoped>

	.editorContent {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		padding: 12px 14px 60px 14px;
	}

	.ctxBar {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		font-size: 13px;

		.meta { color: #666; font-size: 11px; margin-left: 4px; }
		.hint { font-size: 11px; font-style: italic; color: #D96A80; }
	}

	// palette of draggable source blocks
	.palette {
		display: flex;
		align-items: center;
		gap: 10px;
		margin: 10px 0;

		.paletteLbl { font-size: 12px; font-weight: bold; }

		.srcBlock {
			padding: 6px 16px;
			border-radius: 16px;
			color: white;
			font-weight: bold;
			font-size: 12px;
			cursor: grab;
			user-select: none;

			&:active { cursor: grabbing; }
			&.disabled {
				opacity: 0.4;
				cursor: not-allowed;
				pointer-events: none;
			}

			&.hotkey { background: #3a6ea5; }
			&.expression { background: #2f8a5b; }
			&.wait { background: #888; }
		}
	}

	// the vertical stack canvas
	.canvas {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: stretch;
		padding: 10px 12px;
		overflow-y: auto;

		border: 2px dashed #d9a7b1;
		border-radius: 10px;
		background: rgba(255, 245, 247, 0.6);

		// hat cap (sequence start)
		.hatCap {
			align-self: flex-start;
			padding: 6px 16px 8px 12px;
			background: #555;
			color: white;
			font-size: 12px;
			font-weight: bold;
			border-radius: 12px 12px 4px 4px;

			.cmd {
				font-family: 'Courier New', Courier, monospace;
				background: rgba(0,0,0,0.3);
				padding: 1px 6px;
				border-radius: 4px;
			}
		}

		.emptyHint {
			color: #b08;
			opacity: 0.6;
			font-style: italic;
			font-size: 13px;
			padding: 8px 6px;
		}

		// horizontal gap drop targets between/around blocks
		.dropZone {
			height: 4px;
			width: 100%;
			border-radius: 3px;
			transition: height 0.12s, background 0.12s;

			&.over {
				height: 28px;
				background: rgba(249, 160, 176, 0.7);
			}
		}

		// a stacked block
		.block {

			position: relative;
			display: flex;
			align-items: center;
			gap: 8px;
			width: 100%;
			padding: 10px 12px;

			color: white;
			font-size: 12px;
			border-radius: 6px;

			// little scratch-style nub plugging into the block below
			&::after {
				content: '';
				position: absolute;
				left: 18px;
				bottom: -5px;
				width: 18px;
				height: 6px;
				background: inherit;
				border-radius: 0 0 4px 4px;
			}

			&.hotkey { background: #3a6ea5; }
			&.expression { background: #2f8a5b; }
			&.wait { background: #777; }

			.grip {
				cursor: grab;
				font-size: 15px;
				line-height: 1;
				opacity: 0.85;
				&:active { cursor: grabbing; }
			}

			.tag {
				font-weight: bold;
				font-size: 10px;
				letter-spacing: 0.5px;
				min-width: 74px;
			}

			select, .waitInput {
				padding: 4px 6px;
				border: 1px solid #0003;
				border-radius: 4px;
				background: white;
				color: #111;
				font-size: 12px;
			}
			select { max-width: 240px; }
			.waitInput { width: 70px; }
			.unit { font-size: 11px; opacity: 0.9; }

			.blockCtl {
				display: flex;
				gap: 3px;
				margin-left: auto;

				button {
					width: 24px;
					height: 24px;
					padding: 0;
					border: none;
					border-radius: 4px;
					background: rgba(255,255,255,0.25);
					color: white;
					cursor: pointer;
					font-size: 12px;
					line-height: 1;

					&:hover { background: rgba(255,255,255,0.45); }
					&:disabled { opacity: 0.35; cursor: not-allowed; }
					&.del:hover { background: #e3556a; }
				}
			}
		}// .block
	}// .canvas

	.buttons {
		position: absolute;
		inset: auto 0 0 0;
		height: 50px;
		background: #eee;
		display: flex;
		flex-direction: row-reverse;
		align-items: center;
		gap: 10px;
		padding-right: 12px;

		button {
			padding: 5px 14px;
			border-radius: 5px;
			border: 1px solid #999;
			cursor: pointer;
			background: linear-gradient(180deg, #fff, #ddd);
			text-transform: uppercase;

			&.primary {
				background: linear-gradient(180deg, #FBB6C2, #F9A0B0);
				color: white;
				font-weight: bold;
				border-color: #E0788C;
			}
			&:hover { filter: brightness(1.05); }
		}
	}

</style>
