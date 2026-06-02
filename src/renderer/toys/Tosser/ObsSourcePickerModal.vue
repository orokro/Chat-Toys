<!--
	ObsSourcePickerModal.vue
	------------------------

	Two-column picker for choosing OBS sources to track:
	  - Left:  list of scenes.
	  - Right: the chosen scene's source hierarchy (groups + nested scenes,
	           any depth) with checkboxes.

	Reads the cached hierarchy from OBSConnectionManager.sourceCache (rebuilt
	on connect; a Refresh button forces a rebuild). Returns the newly-selected
	source names; sources already in the tracked list are shown disabled.
-->
<template>

	<ModalWindowFrame
		title="Add OBS Sources to Track"
		:width="900"
		:height="600"
	>
		<div class="pickerContent">

			<div v-if="!connected" class="notConnected">
				OBS isn't connected, so there are no sources to pick.
			</div>

			<template v-else>
				<div class="cols">

					<!-- scenes -->
					<div class="scenesCol">
						<div class="colHead">Scenes</div>
						<div class="scroll">
							<div
								v-for="s in scenes"
								:key="s"
								class="sceneRow"
								:class="{ active: s === selectedScene }"
								@click="selectedScene = s"
							>{{ s }}</div>
							<div v-if="scenes.length === 0" class="emptyMsg">No scenes cached — click Refresh.</div>
						</div>
					</div>

					<!-- sources of the selected scene -->
					<div class="treeCol">
						<div class="colHead">Sources in &ldquo;{{ selectedScene || '—' }}&rdquo;</div>
						<div class="scroll">
							<ObsTreeNode
								v-for="node in currentTree"
								:key="node.name + ':' + node.id"
								:node="node"
								:selected="selected"
								:existing="existing"
								@toggle="toggle"
							/>
							<div v-if="currentTree.length === 0" class="emptyMsg">No sources in this scene.</div>
						</div>
					</div>

				</div>
			</template>

			<!-- buttons -->
			<div class="buttons">
				<button class="primary" :disabled="selected.length === 0" @click="save">
					Add{{ selected.length ? ' (' + selected.length + ')' : '' }}
				</button>
				<button @click="cancel">Cancel</button>
				<button class="ghost" @click="refresh">Refresh</button>
			</div>

		</div>
	</ModalWindowFrame>

</template>
<script setup>

// vue
import { ref, computed, inject, watch } from 'vue';

// components
import ModalWindowFrame from '@components/options/ModalWindowFrame.vue';
import ObsTreeNode from './ObsTreeNode.vue';

// lib/misc
import { Modal } from 'jenesius-vue-modal';

const props = defineProps({
	// source names already tracked (shown disabled / "added")
	existing: { type: Array, default: () => [] },
});

const emit = defineEmits([Modal.EVENT_PROMPT]);

const ctApp = inject('ctApp');

const connected = computed(() => !!ctApp.obsConnMgr?.isConnected?.value);
const cache = computed(() => ctApp.obsConnMgr?.sourceCache?.value || { scenes: [], trees: {}, allNames: [] });
const scenes = computed(() => cache.value.scenes || []);

const selectedScene = ref(scenes.value[0] || '');
watch(scenes, (s) => {
	if ((!selectedScene.value || !s.includes(selectedScene.value)) && s.length)
		selectedScene.value = s[0];
}, { immediate: true });

const currentTree = computed(() => cache.value.trees[selectedScene.value] || []);

// names the user has newly checked
const selected = ref([]);

/**
 * Toggle a source name in the new-selection set.
 * @param {string} name
 */
function toggle(name) {
	if (props.existing.includes(name))
		return;
	selected.value = selected.value.includes(name)
		? selected.value.filter((n) => n !== name)
		: [...selected.value, name];
}

function save() {
	emit(Modal.EVENT_PROMPT, { names: selected.value.slice() });
}

function cancel() {
	emit(Modal.EVENT_PROMPT, null);
}

async function refresh() {
	await ctApp.obsConnMgr.buildSourceCache();
}

</script>
<style lang="scss" scoped>

	.pickerContent {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		padding: 12px 14px 60px 14px;
	}

	.notConnected {
		padding: 30px;
		text-align: center;
		font-style: italic;
		color: #666;
	}

	.cols {
		flex: 1;
		display: flex;
		gap: 12px;
		min-height: 0;

		.colHead {
			font-weight: bold;
			font-size: 13px;
			padding: 4px 6px;
			border-bottom: 2px solid #ccc;
			margin-bottom: 4px;
		}

		.scroll {
			overflow-y: auto;
			flex: 1;
			min-height: 0;
		}

		.scenesCol {
			width: 240px;
			display: flex;
			flex-direction: column;
			border: 1px solid #ccc;
			border-radius: 6px;
			padding: 6px;

			.sceneRow {
				padding: 5px 8px;
				border-radius: 4px;
				cursor: pointer;
				font-size: 13px;

				&:hover { background: #eee; }
				&.active { background: #F9A0B0; color: white; font-weight: bold; }
			}
		}

		.treeCol {
			flex: 1;
			display: flex;
			flex-direction: column;
			border: 1px solid #ccc;
			border-radius: 6px;
			padding: 6px;
		}

		.emptyMsg {
			padding: 12px;
			font-style: italic;
			color: #888;
			font-size: 12px;
		}
	}

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
			font-size: 12px;

			&:disabled { opacity: 0.5; cursor: not-allowed; }

			&.primary {
				background: linear-gradient(180deg, #FBB6C2, #F9A0B0);
				color: white;
				font-weight: bold;
				border-color: #E0788C;
			}
			&.ghost { margin-right: auto; }
		}
	}

</style>
