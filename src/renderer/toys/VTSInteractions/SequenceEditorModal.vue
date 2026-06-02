<!--
	SequenceEditorModal.vue
	-----------------------

	Edits ONE (command x model) sequence for the VTS Interactions toy.

	A sequence is an ordered list of blocks:
	  - hotkey:     { id, type:'hotkey', hotkeyID, label }
	  - expression: { id, type:'expression', file, action:'activate'|'deactivate'|'toggle', label }
	  - wait:       { id, type:'wait', seconds }

	PHASE 3 NOTE: this is the interim "quick" editor - plain dropdowns + add /
	remove / reorder buttons - so the full data path (matrix -> editor ->
	sequencesByModel -> matrix) works and is testable today. Phase 4 replaces
	these controls with the drag-and-drop scratch-style block canvas; the block
	data model above stays exactly the same.
-->
<template>

	<ModalWindowFrame
		:title="`Edit Sequence: !${commandName}`"
		:width="720"
		:height="560"
	>
		<div class="editorContent">

			<!-- context + interim notice -->
			<div class="ctxBar">
				<div>
					Model: <strong>{{ model.modelName }}</strong>
					<span class="meta">({{ model.hotkeys.length }} hotkeys, {{ model.expressions.length }} expressions)</span>
				</div>
				<div class="interimNote">Quick editor — drag-and-drop blocks coming next</div>
			</div>

			<!-- chain preview -->
			<div class="chainPreview">
				<template v-if="blocks.length">
					<span v-for="(b, i) in blocks" :key="b.id" class="chainBlock" :class="b.type">
						{{ chainLabel(b) }}<span v-if="i < blocks.length - 1" class="arrow">›</span>
					</span>
				</template>
				<span v-else class="chainEmpty">Empty sequence — add a block below.</span>
			</div>

			<!-- palette -->
			<div class="palette">
				<span class="paletteLbl">Add block:</span>
				<button :disabled="model.hotkeys.length === 0" @click="addBlock('hotkey')">Hotkey</button>
				<button :disabled="model.expressions.length === 0" @click="addBlock('expression')">Expression</button>
				<button @click="addBlock('wait')">Wait</button>
			</div>

			<!-- block list -->
			<div class="blockList">
				<div v-for="(b, i) in blocks" :key="b.id" class="blockRow" :class="b.type">

					<div class="ord">{{ i + 1 }}</div>

					<!-- hotkey block -->
					<template v-if="b.type === 'hotkey'">
						<span class="tag">HOTKEY</span>
						<select v-model="b.hotkeyID" @change="syncLabel(b)">
							<option v-for="hk in model.hotkeys" :key="hk.hotkeyID" :value="hk.hotkeyID">{{ hk.name }}</option>
						</select>
					</template>

					<!-- expression block -->
					<template v-else-if="b.type === 'expression'">
						<span class="tag">EXPRESSION</span>
						<select v-model="b.file" @change="syncLabel(b)">
							<option v-for="ex in model.expressions" :key="ex.file" :value="ex.file">{{ ex.name }}</option>
						</select>
						<select v-model="b.action" class="actionSel">
							<option value="activate">Activate</option>
							<option value="deactivate">Deactivate</option>
							<option value="toggle">Toggle</option>
						</select>
					</template>

					<!-- wait block -->
					<template v-else>
						<span class="tag">WAIT</span>
						<input type="number" v-model.number="b.seconds" min="0" max="60" step="0.1" class="waitInput" /> s
					</template>

					<!-- reorder + remove -->
					<div class="rowActions">
						<button :disabled="i === 0" title="Move up" @click="move(i, -1)">▲</button>
						<button :disabled="i === blocks.length - 1" title="Move down" @click="move(i, 1)">▼</button>
						<button class="del" title="Remove" @click="remove(i)">✕</button>
					</div>
				</div>
			</div>

			<!-- footer buttons -->
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

	// the cached model entry: { modelID, modelName, hotkeys:[], expressions:[] }
	model: {
		type: Object,
		required: true,
	},

	// the starting blocks (a clone owned by this modal)
	blocks: {
		type: Array,
		default: () => [],
	},
});

// close-with-value event for jenesius prompt modals
const emit = defineEmits([Modal.EVENT_PROMPT]);

// local editable copy
const blocks = ref(props.blocks.map(b => ({ ...b })));


/**
 * Append a new block of the given type, defaulting to the model's first
 * available hotkey / expression where relevant.
 *
 * @param {'hotkey'|'expression'|'wait'} type
 */
function addBlock(type) {

	if (type === 'hotkey') {
		const hk = props.model.hotkeys[0];
		blocks.value.push({ id: uuidv4(), type: 'hotkey', hotkeyID: hk?.hotkeyID, label: hk?.name || '' });

	} else if (type === 'expression') {
		const ex = props.model.expressions[0];
		blocks.value.push({ id: uuidv4(), type: 'expression', file: ex?.file, action: 'toggle', label: ex?.name || '' });

	} else {
		blocks.value.push({ id: uuidv4(), type: 'wait', seconds: 1 });
	}
}


/**
 * Refresh a block's denormalized label after its dropdown selection changes,
 * so the matrix preview / offline display stays meaningful.
 *
 * @param {Object} b - the block being edited
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
 * Move a block up (-1) or down (+1) in the list.
 *
 * @param {Number} index
 * @param {Number} dir - -1 or +1
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
 * Build a short chain label for the preview row.
 *
 * @param {Object} b
 * @returns {String}
 */
function chainLabel(b) {
	if (b.type === 'hotkey')
		return `HK:${b.label || '?'}`;
	if (b.type === 'expression')
		return `EX:${b.label || '?'}`;
	return `WAIT ${b.seconds ?? 0}s`;
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
		.interimNote {
			font-size: 11px;
			font-style: italic;
			color: #D96A80;
		}
	}

	.chainPreview {
		margin: 10px 0;
		padding: 8px 10px;
		background: #FDEEF1;
		border: 1px solid #F6C9D1;
		border-radius: 6px;
		min-height: 20px;
		font-family: 'Courier New', Courier, monospace;
		font-size: 12px;

		.chainBlock { white-space: nowrap; }
		.arrow { margin: 0 6px; color: #F9A0B0; font-weight: bold; }
		.chainEmpty { color: #888; font-style: italic; }
	}

	.palette {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 8px;

		.paletteLbl { font-size: 12px; font-weight: bold; }

		button {
			padding: 4px 12px;
			border-radius: 40px;
			border: 2px solid black;
			background: #efefef;
			cursor: pointer;
			font-weight: bold;
			&:hover { background: #fff; }
			&:disabled { opacity: 0.5; cursor: not-allowed; }
		}
	}

	.blockList {
		flex: 1;
		overflow-y: auto;
		border: 1px solid #aaa;
		border-radius: 6px;
		background: rgba(255,255,255,0.5);

		.blockRow {
			display: flex;
			align-items: center;
			gap: 8px;
			padding: 8px 10px;
			border-bottom: 1px solid #ccc;
			&:last-child { border-bottom: none; }

			.ord {
				width: 20px;
				height: 20px;
				border-radius: 50%;
				background: #333;
				color: white;
				font-size: 11px;
				text-align: center;
				line-height: 20px;
				flex-shrink: 0;
			}

			.tag {
				font-size: 10px;
				font-weight: bold;
				padding: 2px 6px;
				border-radius: 4px;
				color: white;
			}
			&.hotkey .tag { background: #3a6ea5; }
			&.expression .tag { background: #2f8a5b; }
			&.wait .tag { background: #888; }

			select, .waitInput {
				padding: 3px 6px;
				border: 1px solid #888;
				border-radius: 4px;
			}
			.waitInput { width: 70px; }

			.rowActions {
				margin-left: auto;
				display: flex;
				gap: 4px;

				button {
					width: 24px;
					height: 24px;
					padding: 0;
					border: 1px solid #888;
					border-radius: 4px;
					background: #eee;
					cursor: pointer;
					&:hover { background: #fff; }
					&:disabled { opacity: 0.4; cursor: not-allowed; }
					&.del:hover { background: #f3c9c9; }
				}
			}
		}// .blockRow
	}// .blockList

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
