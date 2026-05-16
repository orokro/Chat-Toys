<!--
	SettingsTextRow.vue
	-------------------

	A row that consolidates a toy's text-style settings behind a "..." button.
	Pages that previously had four-or-so inline color / size / shadow rows now
	render a single SettingsTextRow per text "group" (e.g. Gamba's Header
	Text + Body Text are two separate groups, each with their own row).

	The row reads the descriptor from `toy.static.textSettings` (an array of
	groups - see TOY_GUIDE on the textSettings shape) and shows:
	  - the group label on the left
	  - a live preview of the current values on the right (color swatches +
	    numeric / boolean summaries)
	  - a "..." button that opens TextSettingsModal scoped to this group

	Existing setting refs are reused verbatim; this is a UI rearrangement only,
	no data-format migration.
-->
<template>

	<div class="settings-row settings-text-row">

		<div class="topRow">

			<div class="left">
				<h3>{{ group.groupLabel || 'Text Style' }}</h3>
			</div>

			<div class="right">

				<div class="preview" :title="previewTooltip">
					<template v-for="f in group.fields" :key="f.key">

						<!-- color: small swatch -->
						<span
							v-if="f.type === 'color'"
							class="swatch"
							:style="{ background: readField(f.key) }"
						></span>

						<!-- boolean: check / x -->
						<span
							v-else-if="f.type === 'boolean'"
							class="chip"
							:class="{ on: readField(f.key) }"
						>
							{{ shortLabel(f.label) }} {{ readField(f.key) ? '✓' : '✗' }}
						</span>

						<!-- number: value + px -->
						<span
							v-else-if="f.type === 'number' || f.type === 'float'"
							class="chip"
						>
							{{ readField(f.key) }}{{ f.unit ?? 'px' }}
						</span>

						<!-- fallback: stringified value -->
						<span v-else class="chip">{{ readField(f.key) }}</span>

					</template>
				</div>

				<button
					class="open-btn"
					title="Open text style settings"
					@click="openTextModal"
				>
					...
				</button>

			</div>

		</div>

		<div class="bottomRow" v-if="group.groupDescription">
			<p class="desc">{{ group.groupDescription }}</p>
		</div>

	</div>

</template>
<script setup>

// vue
import { computed } from 'vue';

// lib/misc
import { openModal } from 'jenesius-vue-modal';

// components
import TextSettingsModal from './TextSettingsModal.vue';


// props
const props = defineProps({

	/** The toy whose settings we're editing. Has .settings (refs) and .static.textSettings (descriptor). */
	toy: {
		type: Object,
		required: true,
	},

	/**
	 * Which textSettings group this row represents. If the toy has multiple
	 * groups (e.g. Gamba: header + body) the parent Page renders one row per
	 * group and passes the groupKey through. If omitted, defaults to the
	 * first group.
	 */
	groupKey: {
		type: String,
		default: null,
	},
});


/**
 * Resolved group descriptor from the toy's static textSettings array.
 * Falls back to an empty group so a misconfigured row degrades visibly
 * instead of crashing.
 */
const group = computed(() => {
	const groups = props.toy?.static?.textSettings || [];
	if (groups.length === 0) return { groupLabel: 'Text Style', fields: [], defaults: {} };
	if (!props.groupKey) return groups[0];
	return groups.find(g => g.groupKey === props.groupKey) || groups[0];
});


/**
 * Read the current value of a setting field by key.
 * @param {string} key - matches `toy.settings[key]`
 * @returns {*}
 */
function readField(key) {
	const r = props.toy?.settings?.[key];
	return r ? r.value : undefined;
}


/**
 * Best-effort short label for boolean chip text - "Text shadow" -> "shadow",
 * "Font shadow" -> "shadow". Keeps the preview compact.
 *
 * @param {string} label
 * @returns {string}
 */
function shortLabel(label) {
	if (!label) return '';
	const lower = label.toLowerCase();
	if (lower.includes('shadow')) return 'shadow';
	return label;
}


/** Hover tooltip on the preview - readable summary of all field values. */
const previewTooltip = computed(() => {
	return group.value.fields
		.map(f => `${f.label}: ${readField(f.key)}`)
		.join('\n');
});


/**
 * Open the text-settings modal for this group. Changes apply live via the
 * underlying refs, so nothing needs to come back from the modal.
 */
function openTextModal() {
	openModal(TextSettingsModal, {
		toy: props.toy,
		groupKey: group.value.groupKey,
	});
}

</script>
<style lang="scss" scoped>

	// Match SettingsInputRow.vue's outer structure so this row visually slots
	// in next to the other settings rows on a Page.
	.settings-row {
		display: flex;
		flex-direction: column;
		gap: 5px;
		padding: 10px 0px;
		max-width: 1200px;

		.topRow {
			margin-top: 5px;
			border-bottom: 5px solid rgba(0, 0, 0, 0.03);
			padding-bottom: 5px;
			display: flex;
			align-items: center;
			justify-content: space-between;

			.left {
				h3 { margin: 0; }
			}

			.right {
				display: flex;
				align-items: center;
				gap: 12px;
				min-width: 500px;
				justify-content: flex-end;
			}
		}

		.bottomRow {
			margin-bottom: 5px;
			.desc {
				margin: 0;
				font-size: 0.9em;
				color: #555;
			}
		}

		.preview {
			display: flex;
			align-items: center;
			gap: 8px;
			flex-wrap: wrap;
			justify-content: flex-end;

			.swatch {
				display: inline-block;
				width: 22px;
				height: 22px;
				border-radius: 50%;
				border: 2px solid black;
				box-shadow: inset 1px 1px 3px rgba(0, 0, 0, 0.4);
			}

			.chip {
				display: inline-flex;
				align-items: center;
				padding: 2px 8px;
				border: 1px solid #888;
				border-radius: 10px;
				font-size: 0.9em;
				color: #333;
				background: #f5f5f5;

				&.on {
					background: #e8f7e8;
					border-color: #4a934a;
					color: #2a6a2a;
				}
			}
		}

		.open-btn {
			padding: 4px 14px;
			border-radius: 8px;
			cursor: pointer;
			border: 2px solid black;
			background: linear-gradient(180deg, #FFF, #DDD);
			font-weight: bold;
			font-size: 1.1em;
			line-height: 1;

			&:hover {
				background: linear-gradient(180deg, #f4fbff, #c4d0d6);
			}
		}
	}

</style>
