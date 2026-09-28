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

		<!-- a newer version exists, but it needs a newer Chat Toys -->
		<div v-if="newerNeedsApp" class="updateBanner subtle">
			<span class="material-icons">info</span>
			<span>v{{ newerNeedsApp }} is out, but needs a newer version of Chat Toys.</span>
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

			<!-- one row per schema field, in manifest order -->
			<template v-for="field in schema" :key="field.key">

				<!-- input-style fields -->
				<SettingsInputRow
					v-if="INPUT_TYPES.has(field.type)"
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

				<!-- multi-line text fields -->
				<SettingsTextAreaRow
					v-else-if="field.type === 'text'"
					:desc="field.desc || null"
					:placeholder="field.placeholder || ''"
					:rows="field.rows || 5"
					v-model="models[field.key]"
				>
					<template #title>{{ field.label || field.key }}</template>
				</SettingsTextAreaRow>

				<!-- asset-picker fields -->
				<SettingsAssetRow
					v-else-if="field.type === 'asset'"
					:kindFilter="(field.accept && field.accept[0]) || null"
					:desc="field.desc || ''"
					:clearable="!field.default"
					:emptyLabel="field.emptyLabel || (!field.default ? 'Built-in default' : '')"
					v-model="models[field.key]"
				>
					<template #title>{{ field.label || field.key }}</template>
				</SettingsAssetRow>

			</template>

			<p v-if="unsupportedFields.length" class="unsupportedNote">
				Some settings types aren't editable yet in this build:
				{{ unsupportedFields.map(f => f.key).join(', ') }}.
			</p>

		</div>

		<!-- what this plugin remembers about viewers (CT.userData) -->
		<template v-if="usesUserData">
			<SectionHeader title="Saved Viewer Data" />
			<div class="savedData">
				<p>
					This plugin remembers things about viewers (like high scores) between streams.
					<template v-if="dataStats">
						It has saved data for <b>{{ dataStats.users }}</b> viewer{{ dataStats.users === 1 ? '' : 's' }}
						({{ formatBytes(dataStats.bytes) }}).
					</template>
					Removing the plugin keeps this data, so reinstalling it brings everything back.
				</p>
				<button class="dangerBtn" :disabled="!dataStats || dataStats.users === 0" @click="deleteSavedData">
					Delete this plugin's saved data
				</button>
			</div>
		</template>

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
import { promptModal } from 'jenesius-vue-modal';
import ConfirmModal from '@components/options/ConfirmModal.vue';

// components (the same ones built-in toy pages use)
import PageBox from '@components/options/PageBox.vue';
import SectionHeader from '@components/options/SectionHeader.vue';
import WidgetSection from '@components/options/WidgetSection.vue';
import CommandsConfigBox from '@components/options/CommandsConfigBox.vue';
import SettingsInputRow from '@components/options/SettingsInputRow.vue';
import SettingsAssetRow from '@components/options/SettingsAssetRow.vue';
import SettingsTextAreaRow from '@components/options/SettingsTextAreaRow.vue';
import MarkdownBlock from '@components/MarkdownBlock.vue';

// which plugin this page is for (passed by ToyClassPage)
const props = defineProps({
	toySlug: { type: String, default: '' },
});

// the input types SettingsInputRow can render. "text" is NOT here: per the
// plugin spec it's the multi-line type (SettingsTextAreaRow); "string" is the
// single-line one.
const INPUT_TYPES = new Set(['number', 'float', 'string', 'boolean', 'options', 'radio', 'color']);

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
const updateInfo = ref(null);   // { version, zip, zipFilename, zipHash, permissions, icon }
const updating = ref(false);
const newerNeedsApp = ref(null); // version string of a newer release this app can't run

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
	if (!r) return;

	// main already picked the newest version this app can run (r.version);
	// compatible:false means none of the published versions can
	const compatible = r.compatible !== false;
	if (compatible && r.zip && semverGt(r.version, toy.manifest.version)) {
		updateInfo.value = {
			version: r.version,
			zip: r.zip,
			zipFilename: String(r.zip || '').split('/').pop(),
			zipHash: r.zipHash || null,
			permissions: r.permissions || [],
			icon: r.icon || '',
		};
	}
	if (r.newestVersion && semverGt(r.newestVersion, toy.manifest.version)
		&& semverGt(r.newestVersion, compatible ? r.version : '0'))
		newerNeedsApp.value = r.newestVersion;
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
			zipHash: updateInfo.value.zipHash,
			name: toy.manifest.name,
			icon: updateInfo.value.icon,
			permissions: updateInfo.value.permissions,
			isUpdate: true,
			navigate: false,
		});
		updateInfo.value = null;
	} catch (e) {
		console.error('[PluginSettingsPage] update failed:', e);
		const msg = String((e && e.message) || e).replace(/^.*Error: /, '');
		alert(`Couldn't update ${toy.manifest.name}: ${msg}`);
	} finally {
		updating.value = false;
	}
}

// --- saved per-viewer data (CT.userData) ---
const usesUserData = computed(() => (toy?.manifest?.permissions || []).includes('userdata:store'));
const dataStats = ref(null);   // { users, bytes }

function dataId() {
	return String(toy?.manifest?.id || toy?.manifest?.slug || '');
}

function refreshDataStats() {
	if (!usesUserData.value || !window.pluginDataDB) return;
	try { dataStats.value = window.pluginDataDB.stats(dataId()); }
	catch (e) { dataStats.value = null; }
}

function formatBytes(n) {
	if (n < 1024) return `${n} bytes`;
	if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
	return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

async function deleteSavedData() {
	const r = await promptModal(ConfirmModal, {
		title: 'Delete saved viewer data?',
		prompt: `This permanently deletes everything ${toy.manifest.name} remembers about viewers (${dataStats.value ? dataStats.value.users : 0} viewers). It can't be undone.`,
		buttons: ['delete', 'nevermind'],
		icon: 'warning',
	});
	if (!r || r.button !== 'delete') return;
	try { window.pluginDataDB.clear(dataId()); }
	catch (e) { console.error('[PluginSettingsPage] clearing saved data failed:', e); }
	refreshDataStats();
}

onMounted(refreshDataStats);

// schema fields, split by how we render them
const schema = computed(() => (toy?.manifest?.settings) || []);
const unsupportedFields = computed(() => schema.value.filter(f => !INPUT_TYPES.has(f.type) && f.type !== 'asset' && f.type !== 'text'));

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
	if (t === 'string') return 'text';
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
	.updateBanner.subtle {
		background: rgba(0, 0, 0, 0.04);
		border-color: rgba(0, 0, 0, 0.12);
		font-weight: 500;
		.material-icons { color: #888; }
	}

	.settingsBlock {
		margin-bottom: 20px;
	}

	.savedData {
		margin-bottom: 20px;
		p { margin: 4px 0 10px; line-height: 1.5; }
		.dangerBtn {
			border: 0;
			border-radius: 999px;
			padding: 7px 16px;
			font-weight: 700;
			background: #c62828;
			color: #fff;
			cursor: pointer;
		}
		.dangerBtn:disabled { opacity: 0.45; cursor: default; }
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
