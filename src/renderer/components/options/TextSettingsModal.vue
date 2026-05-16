<!--
	TextSettingsModal.vue
	---------------------

	Modal that edits a single text-style "group" on a toy. Driven entirely by
	the descriptor on `toy.static.textSettings`; no per-toy logic lives here.

	Bindings are explicit `:modelValue` + `@update:modelValue` (rather than
	v-model) so we can do dynamic `toy.settings[key].value` access without
	tripping over Vue's template-level ref auto-unwrapping. Edits propagate
	live - same plumbing as the inline rows that used to live on the Page.

	Reset button writes the group's `defaults` map back into the refs.
-->
<template>

	<ModalWindowFrame
		:title="group.groupLabel || 'Text Style'"
		:width="640"
		:height="modalHeight"
	>

		<div class="modalContent">

			<div class="scroller">

				<p v-if="group.groupDescription" class="groupDesc">
					{{ group.groupDescription }}
				</p>

				<SettingsInputRow
					v-for="field in group.fields"
					:key="field.key"
					:type="field.type"
					:min="field.min"
					:max="field.max"
					:step="field.step"
					:modelValue="readField(field.key)"
					@update:modelValue="writeField(field.key, $event)"
				>
					<template #title>{{ field.label }}</template>
					<p v-if="field.description">{{ field.description }}</p>
				</SettingsInputRow>

			</div>

			<div class="footer">
				<button class="secondary" @click="resetToDefaults">Reset to Defaults</button>
				<button class="primary" @click="done">Done</button>
			</div>

		</div>

	</ModalWindowFrame>

</template>
<script setup>

// vue
import { computed } from 'vue';

// lib misc
import { closeModal } from 'jenesius-vue-modal';

// components
import ModalWindowFrame from './ModalWindowFrame.vue';
import SettingsInputRow from './SettingsInputRow.vue';


// props
const props = defineProps({

	/** The toy whose settings we're editing. */
	toy: {
		type: Object,
		required: true,
	},

	/** Which textSettings group to edit; defaults to the first group. */
	groupKey: {
		type: String,
		default: null,
	},
});


/** Resolved group from toy.static.textSettings. */
const group = computed(() => {
	const groups = props.toy?.static?.textSettings || [];
	if (groups.length === 0) return { groupLabel: 'Text Style', fields: [], defaults: {} };
	if (!props.groupKey) return groups[0];
	return groups.find(g => g.groupKey === props.groupKey) || groups[0];
});


/**
 * Modal height scales with field count so a 1-field group doesn't waste
 * vertical space and a 4-field group doesn't need to scroll for typical
 * use. The .scroller's overflow-y handles overflow safely either way.
 */
const modalHeight = computed(() => {
	const fieldCount = group.value.fields.length || 1;
	const descHeight = group.value.groupDescription ? 60 : 0;
	const perField = 90; // a SettingsInputRow with a 1-line description
	return Math.min(700, 120 + descHeight + fieldCount * perField);
});


/**
 * Read a setting field's current value via the toy's setting refs.
 * @param {string} key
 * @returns {*}
 */
function readField(key) {
	const r = props.toy?.settings?.[key];
	return r ? r.value : undefined;
}


/**
 * Write a setting field's value back through the toy's setting ref.
 * @param {string} key
 * @param {*} value
 */
function writeField(key, value) {
	const r = props.toy?.settings?.[key];
	if (r) r.value = value;
}


/**
 * Reset every field in this group to its descriptor-declared default.
 * Fields without a default in the descriptor are left as-is.
 */
function resetToDefaults() {
	const defaults = group.value.defaults || {};
	for (const field of group.value.fields) {
		if (Object.prototype.hasOwnProperty.call(defaults, field.key)) {
			writeField(field.key, defaults[field.key]);
		}
	}
}


/** Close the modal. Changes already applied live, so no return value needed. */
function done() {
	closeModal();
}

</script>
<style lang="scss" scoped>

	.modalContent {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
	}

	.scroller {
		flex: 1;
		overflow-y: auto;
		padding: 16px 20px;
	}

	.groupDesc {
		margin: 0 0 10px 0;
		font-size: 0.95em;
		color: #444;
	}

	// Footer button bar - mirrors ConfirmModal's bottom bar styling so the
	// modal feels consistent with the rest of the app's modals.
	.footer {
		flex: 0 0 50px;
		background: #EEE;
		display: flex;
		justify-content: flex-end;
		align-items: center;
		gap: 10px;
		padding: 0 10px;

		button {
			padding: 5px 14px;
			border-radius: 5px;
			cursor: pointer;
			border: 1px solid #999;
			text-transform: uppercase;
			background: linear-gradient(180deg, #FFF, #DDD);

			&:hover {
				background: linear-gradient(180deg, #f4fbff, #c4d0d6);
			}

			&.primary {
				background: linear-gradient(180deg, #05dee2, #00ABAE);
				color: white;
				font-weight: bolder;
				border-color: #008b8d;
			}

			&.secondary {
				color: #444;
			}
		}
	}

</style>
