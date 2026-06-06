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

		<!-- update banner when a newer version is available remotely -->
		<div v-if="updateInfo" class="updateBanner">
			<span class="material-icons">system_update_alt</span>
			<span>Update available — v{{ updateInfo.version }}</span>
			<button class="updateBtn" :disabled="updating" @click="doUpdate">
				{{ updating ? 'Updating…' : 'Update' }}
			</button>
		</div>

		<!-- intro description at the top, like the built-in toy pages: prefer the
			rich markdown longDescription, fall back to the one-line description -->
		<MarkdownBlock v-if="longDescription" :source="longDescription" class="pluginDesc" />
		<p v-else-if="description" class="pluginDesc">{{ description }}</p>

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
import { ref, reactive, computed, inject, onMounted } from 'vue';

// app
import { installAndActivate } from './pluginInstall';

// components (the same ones built-in toy pages use)
import PageBox from '@components/options/PageBox.vue';
import SectionHeader from '@components/options/SectionHeader.vue';
import WidgetSection from '@components/options/WidgetSection.vue';
import CommandsConfigBox from '@components/options/CommandsConfigBox.vue';
import SettingsInputRow from '@components/options/SettingsInputRow.vue';
import SettingsAssetRow from '@components/options/SettingsAssetRow.vue';
import MarkdownBlock from '@components/MarkdownBlock.vue';

// which plugin this page is for (passed by ToyClassPage)
const props = defineProps({
	toySlug: { type: String, default: '' },
});

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

	// the box page tells us exactly which plugin this page is for
	if (props.toySlug) {
		const t = tm.getToyBySlug(props.toySlug);
		if (t && t.manifest) return t;
	}

	// fallback: first plugin selection across classes
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

// --- update availability ---
const updateInfo = ref(null);   // { version, zip, zipFilename, permissions, icon }
const updating = ref(false);

function semverGt(a, b) {
	const pa = String(a || '0').split('.').map((x) => parseInt(x, 10) || 0);
	const pb = String(b || '0').split('.').map((x) => parseInt(x, 10) || 0);
	for (let i = 0; i < 3; i++) {
		if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) > (pb[i] || 0);
	}
	return false;
}

onMounted(async () => {
	if (!toy || !toy.manifest) return;
	let remote = [];
	try { remote = (await window.electronAPI.invoke('get-remote-plugins')) || []; }
	catch (e) { return; }
	const r = remote.find((x) => x && x.slug === toy.manifest.slug);
	if (r && semverGt(r.version, toy.manifest.version)) {
		updateInfo.value = {
			version: r.version,
			zip: r.zip,
			zipFilename: String(r.zip || '').split('/').pop(),
			permissions: r.permissions || [],
			icon: r.icon || '',
		};
	}
});

/**
 * Download + apply the available update for this plugin (stays on the page).
 */
async function doUpdate() {
	if (!updateInfo.value || updating.value) return;
	updating.value = true;
	try {
		await installAndActivate(ctApp, {
			slug: toy.manifest.slug,
			zip: updateInfo.value.zip,
			zipFilename: updateInfo.value.zipFilename,
			name: toy.manifest.name,
			icon: updateInfo.value.icon,
			permissions: updateInfo.value.permissions,
			isUpdate: true,
			navigate: false,
		});
		updateInfo.value = null;
	} catch (e) {
		console.error('[PluginSettingsPage] update failed:', e);
	} finally {
		updating.value = false;
	}
}

// schema fields, split by how we render them
const schema = computed(() => (toy?.manifest?.settings) || []);
const inputFields = computed(() => schema.value.filter(f => INPUT_TYPES.has(f.type)));
const assetFields = computed(() => schema.value.filter(f => f.type === 'asset'));
const unsupportedFields = computed(() => schema.value.filter(f => !INPUT_TYPES.has(f.type) && f.type !== 'asset'));

const hasWidgets = computed(() => !!(toy?.static?.widgetComponents?.length));
const hasCommands = computed(() => !!(toy?.manifest?.commands?.length));
const pageTitle = computed(() => `${toy?.manifest?.name || 'Plugin'} Settings`);
const description = computed(() => toy?.manifest?.description || '');
const longDescription = computed(() => toy?.manifest?.longDescription || '');


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

	.updateBanner {
		display: flex;
		align-items: center;
		gap: 10px;
		margin: 4px 0 16px;
		padding: 10px 14px;
		background: #e6f7f7;
		border: 1px solid #00ABAE;
		border-radius: 8px;
		font-weight: 600;
		.material-icons { color: #00ABAE; }

		.updateBtn {
			margin-left: auto;
			border: 0;
			background: #00ABAE;
			color: #fff;
			font-weight: 700;
			padding: 6px 16px;
			border-radius: 999px;
			cursor: pointer;
		}
		.updateBtn:disabled { opacity: 0.6; cursor: default; }
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
