<!--
	AssetBrowser.vue
	----------------

	Reusable wrapper around the vuefinder file-manager UI, configured
	against our local /api/files endpoint and augmented with a
	collapsible preview sidebar on the right.

	The preview sidebar reuses the existing FilePreview component (which
	knows how to render images, audio, and 3D thumbnails) and only shows
	when exactly ONE file is currently selected in vuefinder. Folders
	never trigger a preview.

	Used in two places:
	  - mounted directly on the System -> Assets page (full-page browse)
	  - inside AssetPickerModal (picker prompt for toy settings)

	Props let the caller restrict the visible kinds (kindFilter), receive
	the current selection (single-file mode for the picker), and toggle
	the picker-flavored "Save" event vs. the page-flavored chrome.

	Pre-reqs: `npm install vuefinder` (UI library). The backend was
	implemented as part of this same change in main/system/assetFsAPI.js.
-->
<template>

	<div class="assetBrowser" :class="{ showPreview: previewOpen }">

		<!-- main: vuefinder file-manager -->
		<div class="finderHost">

			<!-- preview-toggle - bottom-right corner so it never overlaps
			     vuefinder's own toolbar icons. When the preview pane is
			     ALREADY open we don't show this button (the pane has its
			     own close X); when it's hidden, this small floating
			     "Show preview" affordance reopens it. -->
			<button
				v-if="!previewOpen"
				class="previewToggle"
				title="Show preview"
				@click="previewOpen = true"
			>
				Show preview
			</button>

			<!-- vuefinder mounts here. v4.x requires a Driver instance
			     (we use RemoteDriver pointed at our /api/files routes)
			     and accepts handlers as `onXxx` callback props rather
			     than @event listeners. -->
			<vue-finder
				v-if="finderReady"
				:id="finderId"
				:driver="finderDriver"
				:config="finderConfig"
				:features="enabledFeatures"
				:locale="'en'"
				:selection-mode="singleSelect ? 'single' : 'multiple'"
				:on-select="onSelect"
				:on-upload-complete="onUploadComplete"
				:on-delete-complete="onDeleteComplete"
			/>

			<!-- fallback message while vuefinder import is loading or if
			     the npm package isn't installed yet. -->
			<div v-else class="finderLoading">
				<p v-if="loadError">
					<strong>Asset browser failed to load.</strong><br>
					Make sure <code>npm install vuefinder</code> has been run, then reload the app.
				</p>
				<p v-else>Loading file browser…</p>
			</div>

		</div>

		<!-- right: preview sidebar (collapsible) -->
		<aside v-if="previewOpen" class="previewPane">

			<div class="previewHeader">
				<span class="previewLabel">Preview</span>
				<button
					class="previewClose"
					title="Hide preview"
					@click="previewOpen = false"
				>
					<span class="material-icons">close</span>
				</button>
			</div>

			<div v-if="previewableAssetId" class="previewBody">
				<FilePreview
					:fileId="previewableAssetId"
					:assetManager="ctApp.assetsMgr"
					:height="previewHeight"
					:autoPlay="false"
					:border="false"
				/>
				<div class="previewMeta">
					<div class="metaName">{{ previewMeta.name }}</div>
					<div v-if="previewMeta.path" class="metaPath">{{ previewMeta.path }}</div>
					<div v-if="previewMeta.kind" class="metaKind">{{ previewMeta.kind }}</div>
				</div>
			</div>

			<div v-else class="previewEmpty">
				<span class="material-icons emptyIcon">image</span>
				<p>Select a single file to preview it here.</p>
			</div>

		</aside>

	</div>

</template>
<script setup>

// vue
import { ref, shallowRef, computed, inject, onMounted, getCurrentInstance } from 'vue';

// components
import FilePreview from './FilePreview.vue';

// vuefinder 4.x is loaded asynchronously. The library exports a default
// plugin (which we install on the current app) and several named
// classes (RemoteDriver, ArrayDriver, IndexedDBDriver, …). v4 requires
// a Driver instance to be passed in via :driver. We construct a
// RemoteDriver pointed at our /api/files routes.
//
// Module-scope guards so multiple AssetBrowser mounts in one session
// don't try to re-install the plugin (Vue's app.use is idempotent for
// pure plugins but app.component is not).
let _vuefinderPluginInstalled = false;
const finderReady = ref(false);
const loadError = ref(false);

// Driver instance constructed once at mount-time. shallowRef because
// the driver is a class instance, not a reactive object - we don't
// want Vue to deep-proxy it.
const finderDriver = shallowRef(null);


// props
const props = defineProps({

	/**
	 * Optional kind filter ('image' | 'sound' | '3d') applied client-side
	 * to the vuefinder display. When set, only matching files are shown.
	 * Folders are always shown (so you can still navigate into them).
	 */
	kindFilter: {
		type: String,
		default: null,
	},

	/**
	 * Initial path to open. Defaults to /My Assets/ so users see their
	 * own stuff first.
	 */
	initialPath: {
		type: String,
		default: 'assets://My Assets',
	},

	/**
	 * When true (picker mode), only a single file selection is meaningful;
	 * we restrict vuefinder to single-select via selectionMode="single".
	 */
	singleSelect: {
		type: Boolean,
		default: false,
	},

	/**
	 * Stable identifier for vuefinder's persisted state (current path,
	 * view mode, etc.) - vuefinder writes to localStorage keyed off
	 * this id. Should be unique per usage *context* (e.g. 'picker' vs
	 * 'assetsPage'), not per *instance*. Passing the same id from
	 * multiple call sites lets them share the same persisted folder
	 * location across sessions.
	 */
	finderId: {
		type: String,
		default: 'assetBrowser',
	},

});


// events
const emit = defineEmits([
	'select',           // emitted when the focused single-file selection changes; payload: { row, assetRef } or null
]);


// the main app state - we need the server port for the API base URL,
// and the asset manager for the FilePreview component.
const ctApp = inject('ctApp');


// vuefinder uses this id as its localStorage key for persistent state
// (current path, view mode, sidebar visibility, etc.). We take it from
// the prop so callers can pin a stable id per usage context (`picker`,
// `assetsPage`, etc.) - that's what makes "remember where I was" survive
// closing and re-opening the picker modal.
const finderId = computed(() => props.finderId);


// preview-pane state, persisted across reopens within the same session.
const previewOpen = ref(true);
const previewHeight = ref(220);


// Currently-focused single-file selection, if any. Set by the vuefinder
// selection emit; null when the selection isn't exactly one file.
const focusedFile = ref(null);


// Asset id we can hand to the existing FilePreview (which reads from
// ctApp.assetsMgr by id). Falls back to null when nothing's previewable.
// In v4, our backend ferries the asset_ref directly as a top-level
// property on the DirEntry (vuefinder ignores unknown fields).
const previewableAssetId = computed(() => {
	const f = focusedFile.value;
	if (!f) return null;
	return f.asset_ref || null;
});


/**
 * Metadata shown beneath the FilePreview. Pulled from the focused file's
 * vuefinder shape rather than re-querying the DB.
 *
 * @returns {{ name: string, path: string, kind: string }}
 */
const previewMeta = computed(() => {
	const f = focusedFile.value;
	if (!f) return { name: '', path: '', kind: '' };
	return {
		name: f.basename || '',
		path: f.path || '',
		kind: f.asset_kind || f.mime_type || '',
	};
});


/**
 * Vuefinder feature flags. v4 takes a FeaturesConfig map
 * (`{ featureName: boolean }`). We turn OFF features we don't support
 * on the backend OR don't want to expose to users (settings, themes,
 * archive/zip, inline file editor, pinned-folders sidebar, language
 * picker, history nav, new-empty-file). Everything else stays on.
 *
 * Available features (from FeatureName type): edit, newfile, newfolder,
 * preview, archive, unarchive, search, rename, upload, delete,
 * fullscreen, download, language, move, copy, history, theme, pinned.
 *
 * @returns {Object}
 */
const enabledFeatures = computed(() => ({
	// kept on:
	preview:    true,
	search:     true,
	rename:     true,
	upload:     true,
	delete:     true,
	newfolder:  true,
	move:       true,
	copy:       true,
	fullscreen: true,
	// turned off - either server-side unsupported, or chrome we don't want:
	edit:       false,
	newfile:    false,
	archive:    false,
	unarchive:  false,
	language:   false,
	history:    false,
	theme:      false,
	pinned:     false,
	// download is a Chromium native-flow that triggers a transient
	// blank window in Electron; we intercept that in setWindowOpenHandler
	// but the download itself doesn't always survive intact. Disabling
	// since users have the originals on disk and can find the imported
	// uuid in %APPDATA% anyway.
	download:   false,
}));


/**
 * Vuefinder `config` prop - the per-instance store of UI / behavior
 * settings (also what its Settings dialog would expose; we hide the
 * dialog, but the defaults still take effect).
 *
 *   showMenuBar:  hidden. The File/Edit/View/Go/Help menubar gives access
 *                 to features we want disabled (Settings, About, etc.)
 *                 and shows shortcuts that don't work cleanly inside an
 *                 Electron-modal-inside-modal context. The toolbar at
 *                 the top of the explorer is enough.
 *   showToolbar:  kept on. That's where the icon buttons live.
 *   persist:      ON - vuefinder writes the current path to localStorage
 *                 (keyed by our `finderId`) on every nav, so reopening
 *                 the picker / assets page returns to where the user
 *                 was last looking.
 *   path:         the initial path. With persist=on, this only applies
 *                 if there's no stored path yet for this finderId.
 *   showThumbnails:  ON - the previewUrl we emit for image rows.
 *
 * @returns {Object} ConfigDefaults shape
 */
const finderConfig = computed(() => ({
	showMenuBar:    false,
	showToolbar:    true,
	persist:        true,
	path:           props.initialPath,
	showThumbnails: true,
	view:           'grid',
}));


/**
 * Vuefinder v4 `onSelect` callback is fired with an array of DirEntry
 * objects (the current selection). We treat exactly one FILE as
 * "focused" for preview / picker-save purposes; folder selections and
 * empty / multi selections clear the focus.
 *
 * @param {Array<Object>} items - current selection (DirEntry array)
 */
function onSelect(items) {
	const arr = Array.isArray(items) ? items : [];
	if (arr.length === 1 && arr[0].type === 'file') {
		const assetRef = arr[0].asset_ref || null;

		// If this asset_ref isn't yet in the renderer's AssetManager
		// shadow (typical immediately after a vuefinder upload), force
		// a refresh so the FilePreview component AND the picker's
		// `getFileData` Save handler can find it. Idempotent.
		if (assetRef && !ctApp?.assetsMgr?.getFileData?.(assetRef)) {
			ctApp?.assetsMgr?.refreshAssetsFromDB?.();
		}

		focusedFile.value = arr[0];
		emit('select', { row: arr[0], assetRef });
	} else {
		focusedFile.value = null;
		emit('select', null);
	}
}


/**
 * Vuefinder fires this once the server has accepted each batch of
 * uploads. We refresh the AssetManager so any subsequent picker save
 * or FilePreview render finds the new uuid - even if the user never
 * clicks the row (and so onSelect's refresh wouldn't fire).
 *
 * @param {Array<Object>} _files - the newly-uploaded DirEntries
 */
function onUploadComplete(_files) {
	ctApp?.assetsMgr?.refreshAssetsFromDB?.();
}


/**
 * Vuefinder fires this once delete operations are confirmed by the
 * server. We refresh too so the AssetManager's cache drops the wiped
 * uuids - keeps `getFileData` from handing back stale entries to any
 * toy whose settings still reference them.
 *
 * @param {Array<Object>} _deleted - the removed DirEntries
 */
function onDeleteComplete(_deleted) {
	ctApp?.assetsMgr?.refreshAssetsFromDB?.();
}


// Async-import vuefinder and:
//   1) install its default-export plugin against the current Vue app
//      so <vue-finder> resolves as a global component.
//   2) construct a RemoteDriver pointed at our /api/files routes and
//      stash it in `finderDriver` for the template's :driver binding.
//
// We capture the active Vue app instance SYNCHRONOUSLY before any await -
// `getCurrentInstance()` only returns the right thing while we're still
// inside the synchronous portion of a hook. Once we cross an `await`
// boundary the active instance is unset.
//
// Failures (e.g. package not installed) flip `loadError` so the template
// shows a friendly install-needed message.
onMounted(async () => {

	// SYNCHRONOUS phase - must run before the first await.
	const inst = getCurrentInstance();
	const app  = inst && inst.appContext && inst.appContext.app;

	try {
		const mod = await import('vuefinder');
		// CSS is loaded eagerly so vuefinder's panel chrome is styled
		// the moment the component mounts. The package's installed
		// stylesheet is dist/vuefinder.css (we saw this by inspecting
		// node_modules/vuefinder/dist).
		await import('vuefinder/dist/vuefinder.css');

		// Pull in the bundled English locale so we can spread it under
		// our key overrides - vuefinder's i18n option REPLACES the
		// active locale rather than merging, so we have to provide a
		// complete dictionary.
		const enMod = await import('vuefinder/dist/locales/en.js');
		const enLocale = enMod.default || enMod;

		// default export is the plugin; named exports include the
		// Driver classes (RemoteDriver, ArrayDriver, IndexedDBDriver).
		const plugin       = mod.default || mod.VueFinderPlugin || mod;
		const RemoteDriver = mod.RemoteDriver;

		if (!RemoteDriver) throw new Error('vuefinder module did not export RemoteDriver');

		// Idempotent install. The module-scope flag covers the common
		// case, but Vite HMR can reset module state mid-session - we
		// double-check by asking the app whether <VueFinder> is already
		// registered. Avoids Vue's noisy "Plugin has already been
		// applied to target app." warning every time the picker opens.
		const alreadyInstalled = _vuefinderPluginInstalled || !!(app && app.component && app.component('VueFinder'));
		if (!alreadyInstalled) {
			if (!app) throw new Error('No Vue app context available at mount time');
			if (plugin && typeof plugin.install === 'function') {
				// Override the verbiage Chat-Toys users will find more
				// natural - this is a local app, not a remote storage
				// service, so "Import"/"Export" reads better than
				// "Upload"/"Download". Spread the bundled `en` locale so
				// the keys we don't touch keep their original strings.
				app.use(plugin, {
					locale: 'en',
					i18n: {
						en: {
							...enLocale,
							Upload:             'Import',
							Download:           'Export',
							'Upload Files':     'Import Files',
							'Pending upload':   'Pending import',
							'Copy Download URL': 'Copy Export URL',
						},
					},
				});
			} else {
				throw new Error('vuefinder default export has no install()');
			}
		}
		_vuefinderPluginInstalled = true;

		// Build the driver. baseURL points at the express routes the
		// main process added; the per-operation URL paths default to
		// vuefinder's expected `/upload`, `/delete`, `/rename`, etc.
		const port = ctApp?.serverPort?.value;
		finderDriver.value = new RemoteDriver({
			baseURL: `http://localhost:${port}/api/files`,
		});

		finderReady.value = true;
	} catch (err) {
		console.error('[AssetBrowser] failed to load vuefinder:', err);
		loadError.value = true;
	}
});


/**
 * Expose a save-side helper for the picker. Returns the currently-
 * focused file row (or null), so AssetPickerModal can resolve a save
 * to a concrete asset_ref to hand back to SettingsAssetRow.
 *
 * @returns {Object|null}
 */
function getFocusedFile() {
	return focusedFile.value;
}
defineExpose({ getFocusedFile });

</script>
<style lang="scss" scoped>

	// Outer split layout - finder on the left, preview on the right.
	// The split is flex so the host modal/page controls overall sizing.
	.assetBrowser {

		position: relative;
		display: flex;
		gap: 0;

		width: 100%;
		height: 100%;

		.finderHost {

			// main column flex-grows
			position: relative;
			flex: 1;
			min-width: 0;

			// vuefinder mounts fill the entire host
			:deep(.vuefinder),
			:deep(.vf-explorer) {
				width: 100%;
				height: 100%;
			}

			.previewToggle {

				// floats bottom-right of the finder host - safe space
				// once we've hidden vuefinder's own status bar (see the
				// unscoped CSS at the bottom). Sits above vuefinder's
				// stacking context so it stays clickable.
				position: absolute;
				bottom: 10px;
				right: 12px;
				z-index: 20;

				background: rgba(255, 255, 255, 0.96);
				border: 1px solid rgba(0, 0, 0, 0.15);
				border-radius: 5px;
				padding: 5px 12px;
				cursor: pointer;

				color: rgba(0, 0, 0, 0.7);
				font-size: 12px;
				font-weight: 500;

				box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);

				&:hover {
					background: white;
					color: rgba(0, 0, 0, 0.9);
					border-color: rgba(0, 0, 0, 0.3);
				}
			}// .previewToggle

			.finderLoading {

				display: flex;
				align-items: center;
				justify-content: center;
				height: 100%;
				padding: 40px;
				text-align: center;
				color: rgba(0, 0, 0, 0.55);

				code {
					background: rgba(0, 0, 0, 0.06);
					padding: 2px 6px;
					border-radius: 4px;
					font-family: 'Courier New', Courier, monospace;
				}
			}// .finderLoading

		}// .finderHost

		.previewPane {

			width: 300px;
			min-width: 300px;
			flex-shrink: 0;

			background: #f6f7f9;
			border-left: 1px solid rgba(0, 0, 0, 0.1);

			display: flex;
			flex-direction: column;

			.previewHeader {

				display: flex;
				justify-content: space-between;
				align-items: center;
				padding: 8px 12px;
				background: white;
				border-bottom: 1px solid rgba(0, 0, 0, 0.08);

				.previewLabel {
					font-size: 12px;
					font-weight: 600;
					text-transform: uppercase;
					letter-spacing: 0.6px;
					color: rgba(0, 0, 0, 0.6);
				}

				.previewClose {

					background: none;
					border: none;
					padding: 2px;
					cursor: pointer;
					color: rgba(0, 0, 0, 0.5);

					.material-icons {
						font-size: 18px;
					}

					&:hover {
						color: rgba(0, 0, 0, 0.9);
					}
				}// .previewClose

			}// .previewHeader

			.previewBody {

				padding: 14px;
				display: flex;
				flex-direction: column;
				gap: 12px;
				overflow-y: auto;

				.previewMeta {

					font-size: 12.5px;
					line-height: 1.4;

					.metaName {
						font-weight: 600;
						color: #1f2240;
						word-break: break-all;
					}

					.metaPath {
						margin-top: 4px;
						color: rgba(0, 0, 0, 0.55);
						font-family: 'Courier New', Courier, monospace;
						font-size: 11px;
						word-break: break-all;
					}

					.metaKind {
						margin-top: 6px;
						display: inline-block;
						padding: 2px 7px;
						background: rgba(0, 171, 174, 0.12);
						color: #003e3f;
						border-radius: 4px;
						font-size: 11px;
						font-weight: 500;
					}
				}// .previewMeta

			}// .previewBody

			.previewEmpty {

				flex: 1;
				display: flex;
				flex-direction: column;
				justify-content: center;
				align-items: center;
				padding: 30px;
				text-align: center;
				color: rgba(0, 0, 0, 0.45);

				.emptyIcon {
					font-size: 48px;
					opacity: 0.4;
					margin-bottom: 10px;
				}

				p {
					font-size: 13px;
					margin: 0;
				}

			}// .previewEmpty

		}// .previewPane

	}// .assetBrowser

</style>

<!--
	UNSCOPED global stylesheet that wins z-index against the host app's
	modal layer. Vuefinder uses Teleport to render its own modals, drop-
	downs, and context menus at the body level - that means scoped
	styles (above) can't reach them. Jenesius-vue-modal places its
	modal-container at z-index: 1000, but vuefinder's modal layout
	tops out at z-index: 50, so without this override, vuefinder's
	rename/search/upload dialogs disappear behind our picker modal.

	We push every vuefinder layer above 10000 (still well below the
	bundled Sonner toaster at 999999999, so toasts continue to surface
	correctly). Selectors are taken from vuefinder.css.
-->
<style lang="scss">

	.vuefinder__modal-layout         { z-index: 10000 !important; }
	.vuefinder__modal-layout__container { z-index: 10001 !important; }
	.vuefinder__modal-drag-overlay   { z-index: 10010 !important; }
	.vuefinder__external-drop-overlay { z-index: 10010 !important; }
	.vuefinder__menubar__dropdown,
	.vuefinder__toolbar__dropdown,
	.vuefinder__breadcrumb__hidden-dropdown,
	.vuefinder__upload-actions__menu { z-index: 10000 !important; }
	.vuefinder__context-menu         { z-index: 10005 !important; }
	.vuefinder__search-modal__dropdown { z-index: 10006 !important; }
	.vuefinder__search-modal__item-dropdown { z-index: 10007 !important; }

	// Vuefinder bundles Sonner for toast notifications. Sonner's default
	// z-index is 999999999 which would normally win, but in some host-
	// app stacking contexts the host modal still ends up on top. Force
	// the toaster well above our own modal layer and vuefinder's own.
	[data-sonner-toaster] {
		z-index: 1000000 !important;
	}

	// Hide the bottom status bar (storage dropdown + item count). We only
	// have a single storage (`assets://`) so the dropdown is noise, and
	// the item count isn't useful enough to justify keeping a whole bar.
	.vuefinder__statusbar {
		display: none !important;
	}

	// Toolbar polish - the bundled buttons sit too close to each other
	// and to the edges. Add breathing room without changing button size.
	.vuefinder__toolbar {
		padding: 6px 10px !important;
		gap: 6px !important;
	}
	.vuefinder__toolbar > * {
		margin: 0 !important;
	}

</style>
