<!--
	TocNode.vue
	-----------

	Recursive table-of-contents node used by HelpBrowser. Each node
	shows a topic's title plus, if it has children, a collapsible
	disclosure triangle and a nested list.

	The node emits `select(id)` upward when clicked - HelpBrowser
	handles the actual navigation. The component is purely
	presentational + local expand/collapse state.
-->
<template>

	<div class="tocNode">

		<!-- the row itself -->
		<div
			class="tocRow"
			:class="{
				active: node.topic.id === currentId,
				hasChildren,
			}"
			@click="onRowClick"
		>
			<!-- disclosure caret (or a placeholder for alignment) -->
			<span
				v-if="hasChildren"
				class="caret material-icons"
				:class="{ expanded: expanded }"
				@click.stop="toggleExpanded"
			>chevron_right</span>
			<span v-else class="caretPlaceholder"></span>

			<span class="tocTitle">{{ node.topic.title }}</span>

		</div>

		<!-- nested children -->
		<div v-if="hasChildren && expanded" class="tocChildren">
			<TocNode
				v-for="child in node.children"
				:key="child.topic.id"
				:node="child"
				:currentId="currentId"
				@select="(id)=>emit('select', id)"
			/>
		</div>

	</div>

</template>
<script setup>

// vue
import { ref, computed, watch } from 'vue';

// props
const props = defineProps({

	/**
	 * Tree node: { topic, children }
	 */
	node: {
		type: Object,
		required: true,
	},

	/**
	 * Currently-selected topic id - used to highlight the active row
	 * and (on first mount) auto-expand any ancestor sections.
	 */
	currentId: {
		type: String,
		default: '',
	},

});

// events
const emit = defineEmits(['select']);


// -- state ---------------------------------------------------------------

// Expanded by default if the current topic is somewhere under us, OR
// if we're a top-level section (top-level sections start expanded so
// the TOC feels open and inviting on first load).
const expanded = ref(initiallyExpanded());


/**
 * Compute whether we should start expanded.
 *
 * @returns {boolean}
 */
function initiallyExpanded() {

	const myId = props.node.topic.id;

	// top-level sections (no '.' in id) start expanded
	if (!myId.includes('.')) return true;

	// otherwise: expand if the currently-selected topic lives under us
	const cur = props.currentId || '';
	if (cur === myId) return true;
	if (cur.startsWith(myId + '.')) return true;

	return false;
}


// -- derived -------------------------------------------------------------

const hasChildren = computed(() => Array.isArray(props.node.children) && props.node.children.length > 0);


// -- behavior ------------------------------------------------------------

/**
 * Row click: navigate to this node's topic. The caret has its own
 * .stop modifier so toggling expansion doesn't also navigate.
 */
function onRowClick() {
	emit('select', props.node.topic.id);
	// if we have children, also open them so the user can see what
	// they just navigated into
	if (hasChildren.value) expanded.value = true;
}


/**
 * Toggle the disclosure. Called only from the caret click.
 */
function toggleExpanded() {
	expanded.value = !expanded.value;
}


// Keep ourselves open if the currently-selected topic moves under us.
watch(() => props.currentId, (val) => {
	const myId = props.node.topic.id;
	if (val === myId || (myId && val.startsWith(myId + '.'))) {
		expanded.value = true;
	}
});

</script>
<style lang="scss" scoped>

	.tocNode {

		.tocRow {

			display: flex;
			align-items: center;
			gap: 2px;

			padding: 4px 6px;
			border-radius: 5px;
			cursor: pointer;

			color: #2b2b35;
			font-size: 13.5px;
			line-height: 1.3;

			transition: background 0.1s ease;

			.caret {
				font-size: 16px;
				color: rgba(0, 0, 0, 0.45);
				transition: transform 0.15s ease;

				&.expanded {
					transform: rotate(90deg);
				}
			}

			.caretPlaceholder {
				// match the caret's size so titles align across rows
				display: inline-block;
				width: 16px;
				height: 16px;
			}

			.tocTitle {
				flex: 1;
				min-width: 0;
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
			}

			&:hover {
				background: rgba(0, 0, 0, 0.06);
			}

			&.active {
				background: rgba(0, 171, 174, 0.15);
				color: #003e3f;
				font-weight: 500;
			}

		}// .tocRow

		.tocChildren {

			// indent children with a hairline guide line so deep
			// trees stay legible
			margin-left: 10px;
			padding-left: 8px;
			border-left: 1px solid rgba(0, 0, 0, 0.08);

		}// .tocChildren

	}// .tocNode

</style>
