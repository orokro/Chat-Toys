<!--
	SchemaSettingsRows.vue
	----------------------

	A reusable, schema-driven block of settings rows.

	Given a normalized `fields[]` schema (see toys/Chat2/themeSpec.js) and a flat
	{ key: value } model object, this renders one row per field using the SAME
	Settings*Row components the built-in toy pages use - so a theme's declared
	fields look and behave exactly like native settings.

	This is the shared "dynamic settings from JSON" backbone from the chat-theming
	spec (§5). It generalizes the loop PluginSettingsPage.vue already does for
	plugin manifests, so themes (Mode 2) and Streamlabs `Fields` (Mode 3) can both
	reuse it.

	Usage:
		<SchemaSettingsRows :fields="fields" v-model="values" />
-->
<template>

	<div class="schema-settings-rows">

		<template v-for="group in groupedFields" :key="group.label">

			<!-- optional group heading (only when the theme groups its fields) -->
			<SectionHeader v-if="group.label" :title="group.label" />

			<template v-for="field in group.fields" :key="field.key">

				<!-- asset-picker fields -->
				<SettingsAssetRow
					v-if="field.type === 'asset'"
					:kind-filter="(field.accept && (Array.isArray(field.accept) ? field.accept[0] : field.accept)) || null"
					v-model="models[field.key]"
				>
					<template #title>{{ field.label }}</template>
					<p v-if="field.desc">{{ field.desc }}</p>
				</SettingsAssetRow>

				<!-- everything else routes through SettingsInputRow -->
				<SettingsInputRow
					v-else
					:type="field.type"
					:options="field.options"
					:min="field.min"
					:max="field.max"
					:step="field.step"
					v-model="models[field.key]"
				>
					<template #title>{{ field.label }}</template>
					<p v-if="field.desc">{{ field.desc }}</p>
				</SettingsInputRow>

			</template>

		</template>

		<p v-if="!fields || fields.length === 0" class="emptyNote">
			This theme doesn't declare any settings.
		</p>

	</div>

</template>
<script setup>

// vue
import { reactive, computed, watch } from 'vue';

// components (the same ones built-in toy pages use)
import SectionHeader from './SectionHeader.vue';
import SettingsInputRow from './SettingsInputRow.vue';
import SettingsAssetRow from './SettingsAssetRow.vue';

// props: the normalized field schema to render
const props = defineProps({
	fields: { type: Array, default: () => [] },
});

// v-model: a flat { key: value } object holding each field's current value
const model = defineModel({ type: Object, default: () => ({}) });


/**
 * Group fields by their `group` label (preserving first-seen order) so we can
 * render an optional SectionHeader per group. Ungrouped fields fall under a
 * single leading group with an empty label (no header).
 *
 * @returns {Array<Object>} array of { label, fields }
 */
const groupedFields = computed(() => {

	const groups = [];
	const byLabel = {};

	for (const field of (props.fields || [])) {
		const label = field.group || '';
		if (!byLabel[label]) {
			byLabel[label] = { label, fields: [] };
			groups.push(byLabel[label]);
		}
		byLabel[label].fields.push(field);
	}

	return groups;
});


// v-model bridges: a reactive map of computeds, one per field key, that read
// from and write back into the model object. Writing a fresh object (rather
// than mutating in place) makes the change propagate through shallow refs /
// settings sync on the parent. Rebuilt whenever the field set changes.
const models = reactive({});

/**
 * (Re)build the per-field computed proxies bound into `models`.
 */
function rebuildModels() {

	// drop stale keys
	for (const key of Object.keys(models))
		delete models[key];

	// one two-way computed per field
	for (const field of (props.fields || [])) {
		const key = field.key;
		models[key] = computed({
			get: () => {
				const v = model.value ? model.value[key] : undefined;
				return v !== undefined ? v : field.value;
			},
			set: (v) => {
				model.value = { ...(model.value || {}), [key]: v };
			},
		});
	}
}

// rebuild on mount + whenever the field list identity/length changes
watch(() => props.fields, rebuildModels, { immediate: true, deep: false });

</script>
<style lang="scss" scoped>

	.schema-settings-rows {

		.emptyNote {
			opacity: 0.7;
			font-style: italic;
		}
	}

</style>
