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

				<SettingsInputRow type="boolean" v-model="enableChatBoxImage">
					<template #title>Enable Chat Box BG Image</template>
					<p>Use the image below to frame the chat box.</p>
				</SettingsInputRow>
				<SettingsAssetRow v-model="chatBoxImage" :kind-filter="'image'">
					<h3>Image Frame</h3>
					<p>Choose Image frame (sliceable in 3x3) for chat box.</p>
				</SettingsAssetRow>

				<!-- Consolidated text-style settings (name color / text color /
					 font size / shadow) behind the "..." in SettingsTextRow. -->
				<SettingsTextRow
					v-for="group in toy.static.textSettings"
					:key="group.groupKey"
					:toy="toy"
					:groupKey="group.groupKey"
				/>
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
						Compatibility mode will let you import a third-party
						<strong>Streamlabs</strong> chat theme (folder or .zip) and
						run it natively, with ChatToys features layered on top
						(command filtering, avatar toggle, channel points).
					</p>
					<p>The import harness is coming in a later build. The mode
						selector lives here now so the wiring is in place.</p>
				</InfoBox>
			</div>

		</template>

	</PageBox>

</template>
<script setup>

// vue
import { computed, inject } from 'vue';

// components
import PageBox from '@components/options/PageBox.vue';
import SectionHeader from '@components/options/SectionHeader.vue';
import InfoBox from '@components/options/InfoBox.vue';
import SettingsRow from '@components/options/SettingsRow.vue';
import SettingsInputRow from '@components/options/SettingsInputRow.vue';
import SettingsAssetRow from '@components/options/SettingsAssetRow.vue';
import SettingsTextRow from '@components/options/SettingsTextRow.vue';
import SchemaSettingsRows from '@components/options/SchemaSettingsRows.vue';
import WidgetSection from '@components/options/WidgetSection.vue';
import Chat2BehaviorRows from './Chat2BehaviorRows.vue';

// our app
import Chat2 from './Chat2';
import { parseThemeSpec } from './themeSpec';

// fetch the main app state context & our toy
const ctApp = inject('ctApp');
const toy = ctApp.toyManager.toys[Chat2.slug];

// our local refs state (behavior toggles live inside Chat2BehaviorRows)
const {
	chatMode,
	enableChatBoxImage,
	chatBoxImage,
	customChatTheme,
	themeFieldValues,
} = toy.settings;

// mode selector options
const modeOptions = [
	{ value: 'simple', name: 'Simple (no code)' },
	{ value: 'custom', name: 'Custom Theme (code)' },
	{ value: 'compat', name: 'Compatibility (Streamlabs)' },
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

	.themeMeta {
		margin-top: 8px;
		opacity: 0.8;

		span {
			margin-left: 6px;
		}
	}

</style>
