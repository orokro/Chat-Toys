<!--
	PluginSettingsPage.vue
	----------------------

	The generic options page for ALL plugin toys. ToyBox/ToolBox render a toy's
	`optionsPageComponent` with no props, so we resolve which plugin we're for
	from the current selection and pull its live PluginToy instance from the
	toy manager (exactly how built-in pages get their `toy`).

	The page is schema-driven: it reads `toy.manifest.settings` and renders one
	row per field using the SAME field components the built-in toys use, bound
	to the toy's reactive `settings` refs. Widget URLs + commands reuse the
	existing WidgetSection / CommandsConfigBox.
-->
<template>

	<PageBox
		v-if="toy"
		:title="pageTitle"
		:themeColor="toy.static.themeColor"
	>

		<!-- intro description at the top, like the built-in toy pages -->
		<p v-if="description" class="pluginDesc">{{ description }}</p>

		<SectionHeader v-if="hasCommands" title="Command Triggers" />
		<CommandsConfigBox v-if="hasCommands" :toy="toy" />

		<WidgetSection v-if="hasWidgets" :toy="toy" />

		<SectionHeader title="Settings" />

		<div class="settingsBlock">

			<!-- input-style fields -->
			<SettingsInputRow
				v-for="field in inputFields"
				:key="field.key"
				:type="rowType(field.type)"
				:options="field.options"
				:min="field.min"
				:max="field.max"
				:step="field.step"
				v-model="models[field.key]"
			>
				<template #title>{{ field.label || field.key }}</template>
				<p v-if="field.desc">{{ field.desc }}</p>
			</SettingsInputRow>

			<!-- asset-picker fields -->
			<SettingsAssetRow
				v-for="field in assetFields"
				:key="field.key"
				:kindFilter="(field.accept && field.accept[0]) || null"
				:desc="field.desc || ''"
				v-model="models[field.key]"
			>
				<template #title>{{ field.label || field.key }}</template>
			</SettingsAssetRow>

			<p v-if="unsupportedFields.length" class="unsupportedNote">
				Some settings types aren't editable yet in this build:
				{{ unsupportedFields.map(f => f.key).join(', ') }}.
			</p>

		</div>

	</PageBox>

	<div v-else class="missingToy">
		Plugin settings unavailable (toy instance not found).
	</div>

</template>
<script setup>

// vue
import { reactive, computed, inject } from 'vue';

// components (the same ones built-in toy pages use)
import PageBox from '@components/options/PageBox.vue';
import SectionHeader from '@components/options/SectionHeader.vue';
import WidgetSection from '@components/options/WidgetSection.vue';
import CommandsConfigBox from '@components/options/CommandsConfigBox.vue';
import SettingsInputRow from '@components/options/SettingsInputRow.vue';
import SettingsAssetRow from '@components/options/SettingsAssetRow.vue';

// the input types SettingsInputRow can render
const INPUT_TYPES = new Set(['number', 'float', 'string', 'text', 'boolean', 'options', 'radio', 'color']);

// app + resolve our plugin toy instance
const ctApp = inject('ctApp');


/**
 * Resolve the PluginToy instance this page is being shown for. ToyBox uses
 * selectedToy, ToolBox uses selectedTool - try both and take whichever is a
 * plugin (has a manifest).
 *
 * @returns {?Object}
 */
function resolveToy() {
	const tm = ctApp?.toyManager;
	if (!tm) return null;
	// check every class's selection (toy/game/tool) - a plugin can be any class
	const refs = ctApp.selectionRefs || { toy: ctApp.selectedToy, tool: ctApp.selectedTool };
	for (const r of Object.values(refs)) {
		const slug = r && r.value;
		if (!slug) continue;
		const t = tm.getToyBySlug(slug);
		if (t && t.manifest) return t;
	}
	return null;
}

const toy = resolveToy();

// schema fields, split by how we render them
const schema = computed(() => (toy?.manifest?.settings) || []);
const inputFields = computed(() => schema.value.filter(f => INPUT_TYPES.has(f.type)));
const assetFields = computed(() => schema.value.filter(f => f.type === 'asset'));
const unsupportedFields = computed(() => schema.value.filter(f => !INPUT_TYPES.has(f.type) && f.type !== 'asset'));

const hasWidgets = computed(() => !!(toy?.static?.widgetComponents?.length));
const hasCommands = computed(() => !!(toy?.manifest?.commands?.length));
const pageTitle = computed(() => `${toy?.manifest?.name || 'Plugin'} Settings`);
const description = computed(() => toy?.manifest?.description || '');


/**
 * Map a manifest field type to a SettingsInputRow `type`.
 *
 * @param {string} t
 * @returns {string}
 */
function rowType(t) {
	if (t === 'string' || t === 'text') return 'text';
	return t;
}


// v-model bridges: a reactive map of computeds over the toy's settings refs.
// Putting computeds inside a reactive object makes reads unwrap and writes
// forward to the underlying ref's .value (so v-model "just works" on a nested
// ref, which it otherwise can't).
const models = reactive({});
if (toy) {
	for (const field of schema.value) {
		const ref = toy.settings[field.key];
		if (!ref) continue;
		models[field.key] = computed({
			get: () => ref.value,
			set: (v) => { ref.value = v; },
		});
	}
}

</script>
<style lang="scss" scoped>

	.pluginDesc {
		margin: 4px 0 16px;
		font-size: 15px;
		line-height: 1.5;
		opacity: 0.85;
	}

	.settingsBlock {
		margin-bottom: 20px;
	}

	.unsupportedNote {
		opacity: 0.7;
		font-style: italic;
		font-size: 0.9em;
	}

	.missingToy {
		padding: 20px;
		opacity: 0.7;
	}

</style>
