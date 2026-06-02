<!--
	VTSCommandMatrix.vue
	--------------------

	The commands x models configuration grid for the VTS Interactions toy.

	  - Rows    = the toy's custom commands (commandConfigs).
	  - Columns = every model we've scanned (modelCache).
	  - Cell    = the sequence for that (command, model) pair. Shows whether
	              it's configured, empty, or broken (references a hotkey /
	              expression that no longer exists on that model). Hovering a
	              cell reveals an edit button that opens the sequence editor
	              scoped to that single pair.

	Phase 3 renders the grid and wires the edit button to the sequence editor
	modal. The editor itself is a stub until Phase 4 (drag-and-drop blocks);
	saveSequence() below is the round-trip the real editor will call.
-->
<template>

	<div class="matrixWrap">

		<!-- nothing to show yet -->
		<div v-if="configs.length === 0" class="emptyMsg">
			No commands yet. Add a command above to start configuring sequences.
		</div>
		<div v-else-if="models.length === 0" class="emptyMsg">
			No models scanned yet. Load a model in VTubeStudio and scan it first.
		</div>

		<!-- the grid -->
		<div v-else class="matrixScroll">
			<table class="matrix">
				<thead>
					<tr>
						<th class="corner">Command \ Model</th>
						<th
							v-for="m in models"
							:key="m.modelID"
							class="modelCol"
							:class="{ active: m.modelID === currentModelID }"
						>
							<div class="modelColName">{{ m.modelName }}</div>
							<div class="modelColMeta">
								{{ m.hotkeys.length }}hk &middot; {{ m.expressions.length }}ex
								<span v-if="m.modelID === currentModelID" class="activeDot" title="Currently loaded">●</span>
							</div>
						</th>
					</tr>
				</thead>
				<tbody>
					<tr
						v-for="cfg in configs"
						:key="cfg.commandSlug"
					>
						<th class="cmdRow">!{{ cfg.commandName }}</th>
						<td
							v-for="m in models"
							:key="m.modelID"
							class="cell"
							:class="cellClass(cfg, m)"
						>
							<!-- configured: show a mini preview -->
							<div v-if="cellState(cfg, m) !== 'empty'" class="cellInner">
								<span v-if="cellState(cfg, m) === 'broken'" class="warn" title="This sequence uses a hotkey or expression that no longer exists on this model">⚠️</span>
								<span class="preview">{{ previewText(cfg, m) }}</span>
							</div>
							<!-- empty -->
							<div v-else class="cellInner emptyCell">
								<span class="plus">+</span>
							</div>

							<!-- hover edit button -->
							<button
								class="editBtn"
								title="Edit this sequence"
								@click="openEditor(cfg, m)"
							>✏️</button>
						</td>
					</tr>
				</tbody>
			</table>
		</div>

	</div>

</template>
<script setup>

// vue
import { computed, inject, markRaw } from 'vue';

// lib/misc
import { promptModal } from 'jenesius-vue-modal';

// components
import SequenceEditorModal from './SequenceEditorModal.vue';

// props
const props = defineProps({

	// the VTS Interactions toy instance
	toy: {
		type: Object,
		required: true,
	},
});

// main app context (for the live current-model highlight)
const ctApp = inject('ctApp');

// rows: the per-command configs
const configs = computed(() => props.toy.settings.commandConfigs.value || []);

// columns: scanned models, most-recently-seen first
const models = computed(() => {
	const cache = props.toy.modelCache.value || {};
	return Object.values(cache).sort((a, b) => (b.lastSeen || 0) - (a.lastSeen || 0));
});

// which model is loaded right now (column highlight)
const currentModelID = computed(() => ctApp.vtsConnMgr.currentModel.value?.modelID || null);


/**
 * Get the sequence object for a (command, model) pair, or null.
 *
 * @param {Object} cfg - command config row
 * @param {Object} model - cached model entry
 * @returns {Object|null} - { blocks: [] } or null
 */
function sequenceFor(cfg, model) {
	return cfg.sequencesByModel?.[model.modelID] || null;
}


/**
 * Classify a cell as 'empty' | 'configured' | 'broken'.
 *
 * @param {Object} cfg
 * @param {Object} model
 * @returns {String}
 */
function cellState(cfg, model) {

	const seq = sequenceFor(cfg, model);
	if (!seq || !Array.isArray(seq.blocks) || seq.blocks.length === 0)
		return 'empty';

	return hasBrokenRef(seq, model) ? 'broken' : 'configured';
}


/**
 * Bind cell state to a CSS class.
 *
 * @param {Object} cfg
 * @param {Object} model
 * @returns {Object}
 */
function cellClass(cfg, model) {
	const s = cellState(cfg, model);
	return {
		isEmpty: s === 'empty',
		isConfigured: s === 'configured',
		isBroken: s === 'broken',
		activeColCell: model.modelID === currentModelID.value,
	};
}


/**
 * Does any block in a sequence reference a hotkey / expression that no longer
 * exists on the given model? (Basic broken-ref detection; the full validation
 * pass arrives with the runner in Phase 5.)
 *
 * @param {Object} seq
 * @param {Object} model
 * @returns {Boolean}
 */
function hasBrokenRef(seq, model) {

	const hotkeyIDs = new Set((model.hotkeys || []).map(h => h.hotkeyID));
	const exprFiles = new Set((model.expressions || []).map(e => e.file));

	return seq.blocks.some(b => {
		if (b.type === 'hotkey')
			return !hotkeyIDs.has(b.hotkeyID);
		if (b.type === 'expression')
			return !exprFiles.has(b.file);
		return false;
	});
}


/**
 * Build a short text preview of a sequence, e.g. "HK · WAIT 3s · HK".
 *
 * @param {Object} cfg
 * @param {Object} model
 * @returns {String}
 */
function previewText(cfg, model) {

	const seq = sequenceFor(cfg, model);
	if (!seq || !Array.isArray(seq.blocks))
		return '';

	return seq.blocks.map(b => {
		if (b.type === 'hotkey')
			return 'HK';
		if (b.type === 'expression')
			return 'EX';
		if (b.type === 'wait')
			return `WAIT ${b.seconds ?? 0}s`;
		return '?';
	}).join(' · ');
}


/**
 * Open the sequence editor for a (command, model) pair and persist the result.
 *
 * @param {Object} cfg
 * @param {Object} model
 */
async function openEditor(cfg, model) {

	// deep-clone existing blocks so the modal edits a copy
	const seq = sequenceFor(cfg, model);
	const blocks = seq && Array.isArray(seq.blocks)
		? JSON.parse(JSON.stringify(seq.blocks))
		: [];

	const result = await promptModal(SequenceEditorModal, {
		commandName: cfg.commandName,
		model: markRaw(model),
		blocks,
	});

	// modal returns { blocks } on save, null/undefined on cancel
	if (!result || !Array.isArray(result.blocks))
		return;

	saveSequence(cfg, model.modelID, result.blocks);
}


/**
 * Write a sequence back into the toy's commandConfigs (immutable update so the
 * shallowRef notifies and the settings aggregator persists it).
 *
 * @param {Object} cfg
 * @param {String} modelID
 * @param {Array<Object>} blocks
 */
function saveSequence(cfg, modelID, blocks) {

	const next = props.toy.settings.commandConfigs.value.map(c => {
		if (c.commandSlug !== cfg.commandSlug)
			return c;
		return {
			...c,
			sequencesByModel: {
				...c.sequencesByModel,
				[modelID]: { blocks },
			},
		};
	});

	props.toy.settings.commandConfigs.value = next;
}

</script>
<style lang="scss" scoped>

	.matrixWrap {
		margin-top: 10px;
	}

	.emptyMsg {
		padding: 20px;
		border: 2px dashed #888;
		border-radius: 10px;
		text-align: center;
		font-style: italic;
		color: #555;
		background: rgba(255, 255, 255, 0.4);
	}

	// horizontal scroll for many models
	.matrixScroll {
		overflow-x: auto;
		border: 2px solid black;
		border-radius: 10px;
		background: rgb(172, 172, 172);
	}

	.matrix {

		border-collapse: collapse;
		width: 100%;

		th, td {
			border: 1px solid #555;
		}

		// header cells
		thead th {
			background: #333;
			color: white;
			padding: 8px 12px;
			font-size: 12px;

			&.corner {
				text-align: left;
				font-style: italic;
				background: #222;
			}

			&.modelCol {
				min-width: 130px;

				&.active {
					background: #C46B7E;
				}

				.modelColName {
					font-weight: bold;
					white-space: nowrap;
				}
				.modelColMeta {
					font-size: 10px;
					opacity: 0.85;
					margin-top: 2px;

					.activeDot {
						color: #F9A0B0;
						margin-left: 4px;
					}
				}
			}
		}

		// command label column
		.cmdRow {
			background: #444;
			color: white;
			text-align: left;
			padding: 8px 12px;
			font-family: 'Courier New', Courier, monospace;
			white-space: nowrap;
		}

		// data cells
		.cell {

			position: relative;
			height: 46px;
			padding: 4px 6px;
			text-align: center;
			cursor: default;

			.cellInner {
				display: flex;
				align-items: center;
				justify-content: center;
				gap: 4px;
				height: 100%;
				font-size: 11px;
			}

			.preview {
				font-family: 'Courier New', Courier, monospace;
				color: #111;
			}

			.emptyCell .plus {
				color: #777;
				font-size: 18px;
				font-weight: bold;
			}

			// state backgrounds
			&.isEmpty       { background: rgba(255,255,255,0.15); }
			&.isConfigured  { background: #cdeccd; }
			&.isBroken      { background: #f3c9c9; }

			&.activeColCell { box-shadow: inset 0 0 0 2px #F9A0B0; }

			// hover edit button
			.editBtn {
				position: absolute;
				top: 2px;
				right: 2px;
				scale: 0;
				transition: scale 0.15s;

				width: 22px;
				height: 22px;
				padding: 0;
				border: none;
				border-radius: 50%;
				background: rgba(0,0,0,0.35);
				cursor: pointer;
				font-size: 11px;

				&:hover {
					background: rgba(0,0,0,0.6);
				}
			}

			&:hover .editBtn {
				scale: 1;
			}
		}// .cell
	}// .matrix

</style>
