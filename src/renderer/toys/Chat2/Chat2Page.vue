<!--
	Chat2Page.vue
	-------------

	Settings page for the next-gen Chat overlay toy.

	The page is split into three modes via a selector at the top; only the
	active mode's settings are shown, which fixes the original toy's confusing
	"settings silently overridden by a theme" problem by construction:

		- simple : all built-in style + behavior settings (no code, no textarea).
		- custom : behavior toggles + the theme spec v2 textarea + the theme's
		           own declared fields (rendered with SchemaSettingsRows).
		- compat : ingest a third-party (Streamlabs) theme. Harness is a later
		           phase; this mode shows a placeholder for now.
-->
<template>

	<PageBox
		title="Chat 2 Settings"
		:themeColor="toy.static.themeColor"
		themeImage="assets/bg_tiles/chat.png"
		bgSize="140px"
		bgThemePos="40px"
	>
		<p>The next-gen Chat widget displays live chat from all enabled sources
			(YouTube, Twitch, etc.) and shows real-time feedback for commands and
			channel points.</p>

		<WidgetSection :toy="toy" />

		<SectionHeader title="Theming Mode" />
		<p>Pick how this chat overlay is styled. Each mode shows only its own
			settings.</p>

		<div class="settingsBlock">
			<SettingsInputRow
				type="options"
				:options="modeOptions"
				v-model="chatMode"
			>
				<template #title>Mode</template>
				<p>
					<strong>Simple</strong>: no-code built-in styling.
					<strong>Custom Theme</strong>: paste a ChatToys theme (code).
					<strong>Compatibility</strong>: import a Streamlabs theme.
				</p>
			</SettingsInputRow>
		</div>

		<!-- ============================ MODE: SIMPLE ============================ -->
		<template v-if="chatMode === 'simple'">

			<SectionHeader title="Appearance" />
			<div class="settingsBlock">

				<!-- box + row backgrounds: none / 9-slice / tiled, with the
					 reusable slice editor -->
				<SettingsBackgroundRow
					:toy="toy"
					label="Chat Box Background"
					modeKey="chatBoxImageMode"
					assetKey="chatBoxImage"
					scaleKey="chatBoxImageScale"
					sliceKey="chatBoxImageSlice"
					desc="Frame or tile the whole chat box."
				/>
				<SettingsBackgroundRow
					:toy="toy"
					label="Chat Row Background"
					modeKey="chatRowImageMode"
					assetKey="chatRowImage"
					scaleKey="chatRowImageScale"
					sliceKey="chatRowImageSlice"
					desc="Frame or tile each individual message row."
				/>

				<!-- Consolidated text-style settings (name color / text color /
					 font size / shadow) behind the "..." in SettingsTextRow. -->
				<SettingsTextRow
					v-for="group in toy.static.textSettings"
					:key="group.groupKey"
					:toy="toy"
					:groupKey="group.groupKey"
				/>
			</div>

			<SectionHeader title="Animation & Timing" />
			<div class="settingsBlock">

				<SettingsInputRow type="number" :min="0" :max="40" :step="1" v-model="messageSpacing">
					<template #title>Spacing Between Messages</template>
					<p>Vertical gap (px) between chat rows.</p>
				</SettingsInputRow>

				<SettingsInputRow type="options" :options="animationOptions" v-model="messageAnimation">
					<template #title>Message Entry Animation</template>
					<p>How new messages appear on screen.</p>
				</SettingsInputRow>

				<template v-if="messageAnimation !== 'none'">
					<SettingsInputRow type="options" :options="easingOptions" v-model="messageAnimationEasing">
						<template #title>Animation Easing</template>
						<p>The motion curve for the entry animation.</p>
					</SettingsInputRow>
					<SettingsInputRow type="number" :min="50" :max="2000" :step="50" v-model="messageAnimationDuration">
						<template #title>Animation Duration (ms)</template>
						<p>How long the entry animation lasts.</p>
					</SettingsInputRow>
				</template>

				<SettingsInputRow type="boolean" v-model="hideAfterEnabled">
					<template #title>Hide Messages After a While</template>
					<p>Fade messages out after they've been on screen for a time.</p>
				</SettingsInputRow>
				<SettingsInputRow
					v-if="hideAfterEnabled"
					type="number"
					:min="3"
					:max="600"
					:step="1"
					v-model="hideAfterSeconds"
				>
					<template #title>Hide After (seconds)</template>
					<p>How long a message stays before fading out.</p>
				</SettingsInputRow>

			</div>

			<SectionHeader title="Behavior" />
			<div class="settingsBlock">
				<Chat2BehaviorRows :toy="toy" />
			</div>

		</template>

		<!-- ============================ MODE: CUSTOM ============================ -->
		<template v-else-if="chatMode === 'custom'">

			<SectionHeader title="Custom Theme Code" />
			<div class="settingsBlock">
				<SettingsRow>
					<p>
						Paste a ChatToys theme (JSON + CSS) below. In this mode the
						theme owns the visual style, so the built-in color/font
						controls are hidden - only behavior toggles remain.
					</p>
					<textarea
						v-model="customChatTheme"
						rows="10"
						style="resize: vertical; width: 100%; font-family: monospace;"
						placeholder='{ "name": "My Theme", "fields": [], "injects": { "styleInjects": "" } }'
						@keydown.tab.prevent="insertTabInTheme"
					/>
					<div v-if="themeError" class="themeError">
						Theme parse error: {{ themeError }}
					</div>
					<div v-else-if="parsedTheme.name" class="themeMeta">
						Loaded <strong>{{ parsedTheme.name }}</strong>
						<span v-if="parsedTheme.version">v{{ parsedTheme.version }}</span>
						<span v-if="parsedTheme.author">by {{ parsedTheme.author }}</span>
					</div>
				</SettingsRow>
			</div>

			<template v-if="themeFields.length">
				<SectionHeader title="Theme Settings" />
				<div class="settingsBlock">
					<SchemaSettingsRows :fields="themeFields" v-model="themeValues" />
				</div>
			</template>

			<SectionHeader title="Behavior" />
			<div class="settingsBlock">
				<Chat2BehaviorRows :toy="toy" />
			</div>

		</template>

		<!-- ========================= MODE: COMPATIBILITY ========================= -->
		<template v-else-if="chatMode === 'compat'">

			<SectionHeader title="Compatibility (Streamlabs)" />
			<div class="settingsBlock">
				<InfoBox>
					<p>
						Import a third-party <strong>Streamlabs</strong> chat theme
						(a folder or .zip with its HTML / CSS / Fields / JS) and run
						it natively. ChatToys features are layered on top: command
						filtering, avatar toggle, channel points, and emote support
						(Twitch / BTTV / YouTube / unicode).
					</p>
					<p>The theme's own JavaScript is not run; our harness owns the
						message loop, so JS-only extras (e.g. pronouns) won't apply.</p>
				</InfoBox>

				<div class="importRow">
					<button class="btn" @click="importTheme('folder')">Import Folder…</button>
					<button class="btn" @click="importTheme('zip')">Import .zip…</button>
					<span v-if="importError" class="importError">{{ importError }}</span>
				</div>
			</div>

			<template v-if="themes.length">
				<SectionHeader title="Theme" />
				<div class="settingsBlock">
					<SettingsInputRow type="options" :options="themeOptions" v-model="chatThemeId">
						<template #title>Active Theme</template>
						<p>Choose which imported Streamlabs theme to display.</p>
					</SettingsInputRow>
					<SettingsRow v-if="chatThemeId">
						<button class="btn danger" @click="removeTheme(chatThemeId)">Remove this theme</button>
					</SettingsRow>
				</div>

				<template v-if="compatFieldDefs.length">
					<SectionHeader title="Theme Settings" />
					<div class="settingsBlock">
						<SchemaSettingsRows :fields="compatFieldDefs" v-model="compatValues" />
					</div>
				</template>

				<SectionHeader title="Extra CSS (advanced)" />
				<div class="settingsBlock">
					<SettingsRow>
						<p>
							Some Streamlabs themes hide decorations (stars, corner
							accents) until their own JavaScript reveals them - which we
							don't run. Add CSS here to reveal or tweak anything; it is
							applied after the theme's own CSS.
						</p>
						<button class="btn" @click="insertRevealSnippet">Insert "reveal decorations" snippet</button>
						<textarea
							v-model="compatCss"
							rows="6"
							style="resize: vertical; width: 100%; font-family: monospace; margin-top: 8px;"
							placeholder=".leftsidecont { opacity: 1 !important; }"
						/>
					</SettingsRow>
				</div>
			</template>

			<SectionHeader title="Behavior" />
			<div class="settingsBlock">
				<Chat2BehaviorRows :toy="toy" />
			</div>

		</template>

	</PageBox>

</template>
<script setup>

// vue
import { ref, computed, inject, onMounted, watch } from 'vue';

// components
import PageBox from '@components/options/PageBox.vue';
import SectionHeader from '@components/options/SectionHeader.vue';
import InfoBox from '@components/options/InfoBox.vue';
import SettingsRow from '@components/options/SettingsRow.vue';
import SettingsInputRow from '@components/options/SettingsInputRow.vue';
import SettingsTextRow from '@components/options/SettingsTextRow.vue';
import SettingsBackgroundRow from '@components/options/SettingsBackgroundRow.vue';
import SchemaSettingsRows from '@components/options/SchemaSettingsRows.vue';
import WidgetSection from '@components/options/WidgetSection.vue';
import Chat2BehaviorRows from './Chat2BehaviorRows.vue';

// our app
import Chat2 from './Chat2';
import { parseThemeSpec, adaptStreamlabsFields } from './themeSpec';

// fetch the main app state context & our toy
const ctApp = inject('ctApp');
const toy = ctApp.toyManager.toys[Chat2.slug];

// our local refs state (behavior toggles live inside Chat2BehaviorRows;
// background settings are driven by SettingsBackgroundRow via the toy)
const {
	chatMode,
	customChatTheme,
	themeFieldValues,
	chatThemeId,
	chatThemeFieldsById,
	chatThemeCssById,
	messageSpacing,
	messageAnimation,
	messageAnimationDuration,
	messageAnimationEasing,
	hideAfterEnabled,
	hideAfterSeconds,
} = toy.settings;

// mode selector options
const modeOptions = [
	{ value: 'simple', name: 'Simple (no code)' },
	{ value: 'custom', name: 'Custom Theme (code)' },
	{ value: 'compat', name: 'Compatibility (Streamlabs)' },
];

// entry-animation presets (values are the widget's keyframe names)
const animationOptions = [
	{ value: 'none', name: 'Instant (no animation)' },
	{ value: 'chat2FadeIn', name: 'Fade In' },
	{ value: 'chat2SlideUp', name: 'Slide Up' },
	{ value: 'chat2SlideFade', name: 'Slide + Fade' },
	{ value: 'chat2Pop', name: 'Pop' },
];

// easing presets (values are CSS timing functions)
const easingOptions = [
	{ value: 'ease-out', name: 'Ease Out' },
	{ value: 'ease-in', name: 'Ease In' },
	{ value: 'ease-in-out', name: 'Ease In-Out' },
	{ value: 'linear', name: 'Linear' },
	{ value: 'cubic-bezier(0.68,-0.55,0.27,1.55)', name: 'Bounce' },
];

// parse the active theme so we can render its fields + surface errors/metadata
const parsedTheme = computed(() => parseThemeSpec(customChatTheme.value));
const themeFields = computed(() => parsedTheme.value.fields);
const themeError = computed(() => parsedTheme.value.error);

// two-way binding for the theme's field values (a flat { key: value } map)
const themeValues = computed({
	get: () => themeFieldValues.value || {},
	set: (v) => { themeFieldValues.value = v; },
});


// --- compatibility mode (Streamlabs theme import) ---

// imported themes (from the main process) + any import error to surface
const themes = ref([]);
const importError = ref('');

// dropdown options for the theme picker
const themeOptions = computed(() => themes.value.map((t) => ({ value: t.id, name: t.name || t.id })));

// the currently-selected theme record
const selectedTheme = computed(() => themes.value.find((t) => t.id === chatThemeId.value) || null);

// the selected theme's Streamlabs Fields, normalized for our settings rows
const compatFieldDefs = computed(() => selectedTheme.value ? adaptStreamlabsFields(selectedTheme.value.fields) : []);

// two-way binding for the selected theme's field values (kept per theme id)
const compatValues = computed({
	get: () => (chatThemeFieldsById.value && chatThemeFieldsById.value[chatThemeId.value]) || {},
	set: (v) => { chatThemeFieldsById.value = { ...(chatThemeFieldsById.value || {}), [chatThemeId.value]: v }; },
});

// per-theme CSS override (applied after the theme CSS in the harness)
const compatCss = computed({
	get: () => (chatThemeCssById.value && chatThemeCssById.value[chatThemeId.value]) || '',
	set: (v) => { chatThemeCssById.value = { ...(chatThemeCssById.value || {}), [chatThemeId.value]: v }; },
});

// a starter snippet that reveals the decorations many SL themes hide via JS
const REVEAL_SNIPPET = [
	"/* reveal decorations the theme's JS would normally show */",
	'.leftsidecont, .anim { opacity: 1 !important; }',
	'.bordertop, .borderbot, .connector, .star2 { visibility: visible !important; }',
].join('\n');

/**
 * Append the reveal-decorations snippet to the override (once).
 */
function insertRevealSnippet() {
	const cur = compatCss.value || '';
	if (cur.includes('reveal decorations')) return;
	compatCss.value = cur ? (cur + '\n\n' + REVEAL_SNIPPET) : REVEAL_SNIPPET;
}

/**
 * Ensure the selected theme's stored values include every field (defaults for
 * any not yet set), so the widget always pushes a complete field map.
 */
function reconcileCompatFields() {
	const id = chatThemeId.value;
	if (!id) return;
	const defs = compatFieldDefs.value;
	if (!defs.length) return;
	const prev = (chatThemeFieldsById.value && chatThemeFieldsById.value[id]) || {};
	const next = {};
	for (const f of defs)
		next[f.key] = Object.prototype.hasOwnProperty.call(prev, f.key) ? prev[f.key] : f.value;
	if (JSON.stringify(next) !== JSON.stringify(prev))
		chatThemeFieldsById.value = { ...(chatThemeFieldsById.value || {}), [id]: next };
}

/**
 * Load the imported-theme list from the main process.
 */
async function loadThemes() {
	try { themes.value = (await window.electronAPI.invoke('list-chat-themes')) || []; }
	catch (e) { themes.value = []; }
}

/**
 * Import a Streamlabs theme from a folder or a .zip, then select it.
 *
 * @param {('folder'|'zip')} mode
 */
async function importTheme(mode) {
	importError.value = '';
	try {
		const res = await window.electronAPI.invoke('import-chat-theme', { mode });
		if (!res || res.canceled) return;
		if (res.error) { importError.value = res.error; }
		themes.value = res.themes || themes.value;
		if (res.theme && res.theme.id) chatThemeId.value = res.theme.id;
		reconcileCompatFields();
	} catch (e) {
		importError.value = e.message || String(e);
	}
}

/**
 * Remove an imported theme and clear the selection if it was active.
 *
 * @param {String} id
 */
async function removeTheme(id) {
	try {
		const res = await window.electronAPI.invoke('remove-chat-theme', { id });
		themes.value = (res && res.themes) || [];
		if (chatThemeId.value === id) chatThemeId.value = themes.value[0] ? themes.value[0].id : '';
	} catch (e) { /* noop */ }
}

// load themes on mount; reconcile field defaults whenever the selection changes
onMounted(loadThemes);
watch(chatThemeId, reconcileCompatFields, { immediate: true });
watch(compatFieldDefs, reconcileCompatFields);


/**
 * Insert a literal tab into the theme textarea instead of moving focus.
 *
 * @param {KeyboardEvent} event - the keydown event
 */
function insertTabInTheme(event) {
	const textarea = event.target;
	if (!textarea) return;

	const start = textarea.selectionStart;
	const end = textarea.selectionEnd;
	const value = textarea.value;

	textarea.value = value.slice(0, start) + '\t' + value.slice(end);
	textarea.selectionStart = textarea.selectionEnd = start + 1;
	textarea.dispatchEvent(new Event('input'));
}

</script>
<style lang="scss" scoped>

	.settingsBlock {
		margin-bottom: 20px;
	}

	.themeError {
		color: #b00020;
		font-weight: bold;
		margin-top: 8px;
	}

	.importRow {
		display: flex;
		align-items: center;
		gap: 10px;
		margin: 10px 0;
	}

	.importError {
		color: #b00020;
		font-weight: bold;
	}

	.btn {
		padding: 7px 16px;
		border: 2px solid black;
		border-radius: 999px;
		background: #00ABAE;
		color: #fff;
		font-weight: bold;
		cursor: pointer;

		&.danger { background: #b00020; }
	}

	.themeMeta {
		margin-top: 8px;
		opacity: 0.8;

		span {
			margin-left: 6px;
		}
	}

</style>
