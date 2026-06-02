<!--
	ObsTreeNode.vue
	---------------

	One node in the OBS scene-source hierarchy tree (used by the source
	picker modal). Renders a checkbox + name, an expand caret for groups /
	nested scenes, and recurses into children. Self-referencing component
	(Vue 3 resolves the recursion by the filename-derived name).
-->
<template>

	<div class="treeNode">

		<div class="nodeRow" :style="{ paddingLeft: (depth * 16) + 'px' }">

			<span
				v-if="hasChildren"
				class="caret"
				@click="open = !open"
			>{{ open ? '▾' : '▸' }}</span>
			<span v-else class="caretSpacer"></span>

			<label class="nodeLabel" :class="{ existing: isExisting }">
				<input
					type="checkbox"
					:checked="isSelected || isExisting"
					:disabled="isExisting"
					@change="$emit('toggle', node.name)"
				/>
				<span class="nodeName">{{ node.name }}</span>
				<span v-if="node.isGroup" class="tag group">group</span>
				<span v-else-if="node.isScene" class="tag scene">scene</span>
				<span v-else-if="node.kind" class="tag kind">{{ node.kind }}</span>
				<span v-if="isExisting" class="tag added">added</span>
			</label>
		</div>

		<div v-if="hasChildren && open" class="children">
			<ObsTreeNode
				v-for="child in node.children"
				:key="child.name + ':' + child.id"
				:node="child"
				:selected="selected"
				:existing="existing"
				:depth="depth + 1"
				@toggle="(n) => $emit('toggle', n)"
			/>
		</div>

	</div>

</template>
<script setup>

import { ref, computed } from 'vue';

const props = defineProps({
	node: { type: Object, required: true },
	selected: { type: Array, default: () => [] },
	existing: { type: Array, default: () => [] },
	depth: { type: Number, default: 0 },
});

defineEmits(['toggle']);

const open = ref(true);
const hasChildren = computed(() => Array.isArray(props.node.children) && props.node.children.length > 0);
const isSelected = computed(() => props.selected.includes(props.node.name));
const isExisting = computed(() => props.existing.includes(props.node.name));

</script>
<style lang="scss" scoped>

	.nodeRow {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 2px 0;

		.caret, .caretSpacer {
			width: 16px;
			text-align: center;
			cursor: pointer;
			user-select: none;
			color: #555;
		}

		.nodeLabel {
			display: flex;
			align-items: center;
			gap: 6px;
			cursor: pointer;

			&.existing {
				opacity: 0.6;
				cursor: default;
			}

			.nodeName {
				font-size: 13px;
			}

			.tag {
				font-size: 10px;
				padding: 1px 5px;
				border-radius: 4px;
				color: white;

				&.group  { background: #6a4ea5; }
				&.scene  { background: #3a6ea5; }
				&.kind   { background: #888; }
				&.added  { background: #2f8a5b; }
			}
		}
	}

</style>
