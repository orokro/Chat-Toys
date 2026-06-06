<!--
	StoreModal.vue
	--------------

	Unified "store" for adding toys, games, and tools (built-in now; remote
	plugins once the server index exists). One storefront for every class with
	off-by-default class + status filters and a search box, app-store-style:
	a grid of cards that open an in-modal detail page, and an action button
	that adds the item then routes the app to its page.

	Remote-ready: items carry a `source` ('builtin' | 'installed' | 'remote')
	and the action button already branches to Get/Update; the remote index +
	download wiring lands with the server.
-->
<template>

	<ModalWindowFrame title="Add to your Stream" :width="'min(1100px, 94vw)'" :height="'min(760px, 90vh)'">

		<div class="store">

			<!-- ============ GRID VIEW ============ -->
			<template v-if="view === 'grid'">

				<div class="toolbar">
					<!-- status radio on the left; the search box splits the two groups -->
					<div class="chipRow">
						<button
							v-for="s in statusChips"
							:key="s.value"
							class="chip"
							:class="{ active: statusFilter === s.value }"
							@click="statusFilter = s.value"
						>{{ s.label }}</button>
					</div>
					<input
						class="searchBox"
						v-model="search"
						type="text"
						placeholder="Search toys, games, tools…"
					/>
					<div class="chipRow">
						<button
							v-for="c in classChips"
							:key="c.value"
							class="chip"
							:class="{ active: classFilter === c.value }"
							@click="classFilter = c.value"
						>{{ c.label }}</button>
					</div>

					<!-- import a private (non-store) plugin .zip from disk -->
					<button class="importBtn" @click="importZip" title="Import a plugin .zip from your computer">
						<span class="material-icons">folder_open</span>
						<span>Import .zip</span>
					</button>
				</div>

				<div class="cardGrid">

					<div
						v-for="item in filteredItems"
						:key="item.slug"
						class="card"
						@click="openDetail(item)"
					>
						<!-- tinted top band: icon + class badge (top-right) -->
						<div class="cardTop" :style="{ background: tint(item.themeColor) }">
							<img class="cardIcon" :src="item.icon" alt="" @error="onIconError" />
							<span class="badge classBadge">{{ classLabel(item.toyClass) }}</span>
						</div>

						<div class="cardBody">
							<div class="cardName">{{ item.name }}</div>
							<div class="cardDesc">{{ item.desc }}</div>

							<div class="cardFooter">
								<span v-if="item.source === 'remote'" class="badge remote">Remote</span>
								<button
									class="actionBtn"
									:class="actionClass(item)"
									@click.stop="onAction(item)"
								>{{ actionLabel(item) }}</button>
							</div>
						</div>
					</div>

					<div v-if="filteredItems.length === 0" class="emptyState">
						Nothing matches your filters.
					</div>

				</div>
			</template>

			<!-- ============ DETAIL VIEW ============ -->
			<template v-else-if="view === 'detail' && selected">

				<div class="detail">

					<button class="backBtn" @click="view = 'grid'">
						<span class="material-icons">arrow_back</span> Back
					</button>

					<div class="detailHeader">
						<img class="detailIcon" :src="selected.icon" alt="" @error="onIconError" />
						<div class="detailMeta">
							<div class="detailName">{{ selected.name }}</div>
							<div class="detailSub">
								<span class="badge" style="background: #ffffff; color: #000000;">{{ classLabel(selected.toyClass) }}</span>
								<span v-if="selected.author" class="muted">by {{ selected.author }}</span>
								<span v-if="selected.version" class="muted">v{{ selected.version }}</span>
							</div>
							<button
								class="actionBtn big"
								:class="actionClass(selected)"
								@click="onAction(selected)"
							>{{ actionLabel(selected) }}</button>
						</div>
					</div>

					<div v-if="selected.thumbnails && selected.thumbnails.length" class="thumbs">
						<img v-for="t in selected.thumbnails" :key="t" :src="t" class="thumb" alt="" />
					</div>

					<MarkdownBlock
						v-if="selected.longDescription"
						:source="selected.longDescription"
						class="detailBody"
					/>
					<p v-else class="detailBody">{{ selected.desc }}</p>

					<div v-if="selected.permissions && selected.permissions.length" class="perms">
						<div class="permsTitle">This plugin can:</div>
						<ul>
							<li v-for="p in selected.permissions" :key="p">{{ permLabel(p) }}</li>
						</ul>
					</div>

				</div>
			</template>

		</div>
	</ModalWindowFrame>
</template>
<script setup>

// vue
import { ref, reactive, computed, inject, onMounted } from 'vue';

// components
import ModalWindowFrame from './ModalWindowFrame.vue';
import MarkdownBlock from '../MarkdownBlock.vue';
import PluginPermsModal from './PluginPermsModal.vue';

// app
import { registerOrUpdatePlugin } from '../../plugins/PluginManager';
import { getGrantedPerms, grantPerms, permLabel } from '../../plugins/pluginPerms';

// lib
import { closeModal, promptModal } from 'jenesius-vue-modal';

const ctApp = inject('ctApp');

// remote shop catalog (fetched via main; empty until the server index exists)
const remoteItems = ref([]);

// slugs currently downloading/installing
const busy = reactive({});

onMounted(async () => {
	try {
		// force a fresh fetch each time the store opens so newly-published
		// versions show up without an app restart
		remoteItems.value = (await window.electronAPI.invoke('get-remote-plugins', { force: true })) || [];
	} catch (e) {
		remoteItems.value = [];
	}
});

// view state
const view = ref('grid');
const selected = ref(null);

// filters (off by default = 'all')
const search = ref('');
const classFilter = ref('all');
const statusFilter = ref('not-added');

const classChips = [
	{ value: 'all', label: 'All' },
	{ value: 'toy', label: 'Toys' },
	{ value: 'game', label: 'Games' },
	{ value: 'tool', label: 'Tools' },
];
const statusChips = [
	{ value: 'all', label: 'All' },
	{ value: 'not-added', label: 'Not added' },
	{ value: 'added', label: 'Added' },
];

const serverPort = (typeof window !== 'undefined' && window.initPort) || 3001;


/**
 * Resolve a plugin-relative asset (thumbnail) to its served URL.
 *
 * @param {string} slug
 * @param {string} rel
 * @returns {string}
 */
function pluginAsset(slug, rel) {
	return `http://localhost:${serverPort}/plugins/${slug}/${String(rel).replace(/^\/+/, '')}`;
}


/**
 * Numeric semver compare (ignores pre-release tags).
 *
 * @param {string} a
 * @param {string} b
 * @returns {boolean} true if a > b
 */
function semverGt(a, b) {
	const pa = String(a || '0').split('.').map((x) => parseInt(x, 10) || 0);
	const pb = String(b || '0').split('.').map((x) => parseInt(x, 10) || 0);
	for (let i = 0; i < 3; i++) {
		if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) > (pb[i] || 0);
	}
	return false;
}

function basename(u) {
	return String(u || '').split('/').pop();
}


// the full catalog: built-in toys + installed plugins, merged with the remote
// shop (remote-only items + update flags on installed ones)
const items = computed(() => {

	const enabled = ctApp.enabledToys.value;
	const map = new Map();

	// local: built-in toys + installed plugins
	for (const c of ctApp.toysData) {
		const m = c.manifest; // present only for plugins
		map.set(c.slug, {
			slug: c.slug,
			name: c.name,
			desc: c.desc || '',
			longDescription: (m && m.longDescription) || '',
			toyClass: c.toyClass || 'toy',
			themeColor: c.themeColor || '#888888',
			icon: c.iconURL || `assets/icons/${c.slug}.png`,
			thumbnails: (m && Array.isArray(m.thumbnails)) ? m.thumbnails.map((t) => pluginAsset(c.slug, t)) : [],
			author: (m && m.author && m.author.name) || '',
			version: (m && m.version) || '',
			tags: (m && m.tags) || [],
			permissions: (m && m.permissions) || [],
			source: m ? 'installed' : 'builtin',
			added: enabled.includes(c.slug),
			updateAvailable: false,
		});
	}

	// remote: annotate updates on installed plugins, add remote-only entries
	for (const r of remoteItems.value) {
		const existing = map.get(r.slug);
		if (existing && existing.source !== 'builtin') {
			if (semverGt(r.version, existing.version)) {
				existing.updateAvailable = true;
				existing.zip = r.zip;
				existing.zipFilename = basename(r.zip);
				existing.remoteVersion = r.version;
			}
		} else if (!existing) {
			map.set(r.slug, {
				slug: r.slug,
				name: r.name,
				desc: r.description || '',
				longDescription: r.longDescription || '',
				toyClass: r.class || 'toy',
				themeColor: r.themeColor || '#888888',
				icon: r.icon || '',
				thumbnails: r.thumbnails || [],
				author: (r.author && r.author.name) || '',
				version: r.version || '',
				tags: r.tags || [],
				permissions: r.permissions || [],
				source: 'remote',
				added: enabled.includes(r.slug),
				updateAvailable: false,
				zip: r.zip,
				zipFilename: basename(r.zip),
			});
		}
	}

	return Array.from(map.values());
});


// filtered + searched view of the catalog
const filteredItems = computed(() => {
	const q = search.value.trim().toLowerCase();
	return items.value.filter((it) => {
		if (classFilter.value !== 'all' && it.toyClass !== classFilter.value) return false;
		if (statusFilter.value === 'added' && !it.added) return false;
		if (statusFilter.value === 'not-added' && it.added) return false;
		if (q) {
			const hay = `${it.name} ${it.desc} ${(it.tags || []).join(' ')}`.toLowerCase();
			if (!hay.includes(q)) return false;
		}
		return true;
	});
});


/**
 * @param {string} c - toyClass
 * @returns {string}
 */
function classLabel(c) {
	return { toy: 'Toy', game: 'Game', tool: 'Tool' }[c] || 'Toy';
}

/**
 * A translucent tint of a #rrggbb theme color, for the card's top band.
 *
 * @param {string} hex
 * @param {number} [a]
 * @returns {string}
 */
function tint(hex, a = 0.16) {
	const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
	if (!m) return 'rgba(0,0,0,0.05)';
	const n = parseInt(m[1], 16);
	return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

/**
 * Ensure the user has consented to the permissions a plugin needs before it's
 * enabled. Returns true to proceed. Prompts only for permissions not already
 * granted (so updates only ask about NEW ones); on allow, records the full set.
 *
 * @param {Object} it - { slug, name, icon }
 * @param {Array<string>} perms - the version's full permission set
 * @param {boolean} isUpdate
 * @returns {Promise<boolean>}
 */
async function ensureConsent(it, perms, isUpdate) {

	const list = perms || [];
	const granted = getGrantedPerms(it.slug);
	const needed = list.filter((p) => !granted.includes(p));

	// nothing new to consent to
	if (needed.length === 0) {
		// ensure a grant record exists so the broker enforces granted (not grandfather)
		if (list.length) grantPerms(it.slug, list);
		return true;
	}

	const ok = await promptModal(PluginPermsModal, {
		name: it.name,
		icon: it.icon || '',
		perms: needed,
		isUpdate: !!isUpdate,
	});
	if (!ok)
		return false;

	grantPerms(it.slug, list);
	return true;
}


/**
 * Import a private (non-store) plugin .zip from disk: copy it into the plugins
 * folder, register it, add + route to it. The file picker lives in the main
 * process.
 */
async function importZip() {
	try {
		const r = await window.electronAPI.invoke('import-plugin-zip');
		if (!r || r.canceled)
			return;

		if (r.slug) {
			const manifest = (r.manifests || []).find((m) => m && m.slug === r.slug);
			if (manifest)
				registerOrUpdatePlugin(manifest);

			const perms = (manifest && manifest.permissions) || [];
			const it = {
				slug: r.slug,
				name: (manifest && manifest.name) || r.slug,
				icon: (manifest && manifest.icon) ? pluginAsset(r.slug, manifest.icon) : '',
			};
			const ok = await ensureConsent(it, perms, false);
			if (!ok) {
				// imported but left disabled - the user can Add it later
				closeModal();
				return;
			}

			ctApp.addToy(r.slug);
			ctApp.toyManager.restartToy(r.slug);
			ctApp.navigateToToy(r.slug);
			closeModal();
		} else {
			console.warn('[StoreModal] imported zip did not resolve to an installable plugin');
		}
	} catch (e) {
		console.error('[StoreModal] import failed:', e);
	}
}

/**
 * @param {Object} it
 * @returns {string}
 */
function actionLabel(it) {
	if (busy[it.slug]) return 'Installing…';
	if (it.updateAvailable) return 'Update';
	if (it.added) return 'Added ✓';
	if (it.source === 'remote') return 'Get';
	return 'Add';
}

/**
 * @param {Object} it
 * @returns {Object} class bindings
 */
function actionClass(it) {
	return {
		added: it.added && !it.updateAvailable,
		get: (it.source === 'remote' && !it.added) || it.updateAvailable,
	};
}


/**
 * Primary action for an item.
 *  - update available -> download newer + re-register
 *  - already added     -> jump to it
 *  - remote (new)       -> download + install + add + jump
 *  - local              -> add + jump
 *
 * @param {Object} it
 */
async function onAction(it) {

	if (busy[it.slug])
		return;

	if (it.updateAvailable) {
		await getRemote(it);
		return;
	}

	if (it.added) {
		ctApp.navigateToToy(it.slug);
		closeModal();
		return;
	}

	if (it.source === 'remote') {
		await getRemote(it);
		return;
	}

	// local: built-ins have no permissions; installed plugins gate on consent
	if (it.source !== 'builtin') {
		const ok = await ensureConsent(it, it.permissions, false);
		if (!ok) return;
	}

	ctApp.addToy(it.slug);
	ctApp.toyManager.restartToy(it.slug);
	ctApp.navigateToToy(it.slug);
	closeModal();
}


/**
 * Download + install (or update) a remote plugin via the main process, then
 * register/replace its class on the renderer, ensure it's enabled, restart its
 * instance so the new version is live, and route to it. Same path for a fresh
 * Get and an Update — both end with the toy added, current, and selected.
 *
 * @param {Object} it
 */
async function getRemote(it) {

	busy[it.slug] = true;
	try {
		// main downloads the zip + rescans, returning the refreshed manifest list
		const manifests = await window.electronAPI.invoke('install-remote-plugin', {
			url: it.zip,
			filename: it.zipFilename,
		});

		// register/replace the class with the just-installed version
		const manifest = (manifests || []).find((m) => m && m.slug === it.slug);
		if (manifest)
			registerOrUpdatePlugin(manifest);

		// permission consent (delta-only for updates)
		const isUpdate = !!it.updateAvailable;
		const perms = (manifest && manifest.permissions) || it.permissions || [];
		const allowed = await ensureConsent(it, perms, isUpdate);

		// a declined FRESH install stays installed-but-not-enabled; a declined
		// update still applies (new files) but keeps the old granted perms.
		if (!allowed && !isUpdate) {
			closeModal();
			return;
		}

		ctApp.addToy(it.slug);
		ctApp.toyManager.restartToy(it.slug);
		ctApp.navigateToToy(it.slug);
		closeModal();

	} catch (e) {
		console.error('[StoreModal] install failed:', e);
	} finally {
		busy[it.slug] = false;
	}
}


/**
 * @param {Object} it
 */
function openDetail(it) {
	selected.value = it;
	view.value = 'detail';
}

/**
 * Hide a broken icon rather than show the broken-image glyph.
 *
 * @param {Event} e
 */
function onIconError(e) {
	e.target.style.visibility = 'hidden';
}

</script>
<style lang="scss" scoped>

	.store {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	// ---- toolbar ----
	.toolbar {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
		align-items: center;
		padding: 12px 14px;
		border-bottom: 1px solid rgba(0, 0, 0, 0.1);
	}

	.searchBox {
		flex: 1 1 220px;
		min-width: 180px;
		padding: 8px 12px;
		border: 1px solid rgba(0, 0, 0, 0.2);
		border-radius: 8px;
		font-size: 14px;
		outline: none;
	}
	.searchBox:focus { border-color: #00ABAE; }

	.chipRow { display: flex; gap: 6px; }

	.chip {
		border: 1px solid rgba(0, 0, 0, 0.2);
		background: #fff;
		border-radius: 999px;
		padding: 5px 12px;
		font-size: 13px;
		cursor: pointer;
		transition: all 0.12s ease;
	}
	.chip:hover { background: #f3f3f3; }
	.chip.active {
		background: #2d2d2d;
		color: #fff;
		border-color: #2d2d2d;
	}

	.importBtn {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		margin-left: auto;
		border: 1px solid rgba(0, 0, 0, 0.2);
		background: #fff;
		border-radius: 8px;
		padding: 6px 12px;
		font-size: 13px;
		cursor: pointer;
		white-space: nowrap;
		.material-icons { font-size: 17px; }
	}
	.importBtn:hover { background: #f3f3f3; }

	// ---- card grid ----
	.cardGrid {
		flex: 1 1 auto;
		min-height: 0;          // let the grid actually scroll instead of squishing
		overflow-y: auto;
		padding: 14px;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
		grid-auto-rows: max-content;  // rows sized to content, never stretched
		align-items: start;
		align-content: start;
		gap: 14px;
	}

	.card {
		height: 232px;            // uniform cards (tall enough to pin footers)
		background: #fff;
		border: 1px solid rgba(0, 0, 0, 0.12);
		border-radius: 12px;
		overflow: hidden;
		display: flex;
		flex-direction: column;
		cursor: pointer;
		transition: box-shadow 0.15s ease, transform 0.1s ease;
	}
	.card:hover {
		box-shadow: 0 6px 18px rgba(0, 0, 0, 0.12);
		transform: translateY(-2px);
	}

	// tinted top band with the icon + class badge
	.cardTop {
		position: relative;
		flex: 0 0 auto;          // never shrink the top band
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 16px;
		min-height: 84px;
	}
	.badge.classBadge {
		position: absolute;
		top: 8px;
		right: 8px;
		background: #ffffff;   // white pill; bg tint carries the theme color
		color: #000000;
	}

	.cardIcon {
		width: 56px;
		height: 56px;
		object-fit: contain;
	}

	.cardBody {
		padding: 12px 14px 14px;
		display: flex;
		flex-direction: column;
		gap: 8px;
		flex: 1 1 auto;
	}
	.cardName {
		font-weight: 700;
		font-size: 15px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.cardDesc {
		font-size: 12.5px;
		color: #555;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.cardFooter {
		margin-top: auto;     // pin the action row to the bottom
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.badge {
		color: #fff;
		font-size: 11px;
		font-weight: 700;
		padding: 2px 8px;
		border-radius: 999px;
		text-transform: uppercase;
		letter-spacing: 0.03em;
	}
	.badge.remote { background: #6b7280; }

	.actionBtn {
		margin-left: auto;
		border: 0;
		background: #00ABAE;
		color: #fff;
		font-weight: 700;
		font-size: 13px;
		padding: 6px 16px;
		border-radius: 999px;
		cursor: pointer;
	}
	.actionBtn:hover { filter: brightness(1.07); }
	.actionBtn.added {
		background: #e8f5e9;
		color: #2e7d32;
	}
	.actionBtn.get { background: #2a7ae2; }
	.actionBtn.big { padding: 9px 26px; font-size: 15px; margin: 8px 0 0; }

	.emptyState {
		grid-column: 1 / -1;
		text-align: center;
		opacity: 0.6;
		padding: 40px;
	}

	// ---- detail ----
	.detail {
		flex: 1 1 auto;
		overflow-y: auto;
		padding: 16px 20px;
	}

	.backBtn {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		border: 0;
		background: transparent;
		cursor: pointer;
		font-size: 14px;
		padding: 4px 6px;
		margin-bottom: 10px;
		.material-icons { font-size: 18px; }
	}
	.backBtn:hover { color: #00ABAE; }

	.detailHeader {
		display: flex;
		gap: 18px;
		align-items: flex-start;
	}
	.detailIcon {
		width: 88px;
		height: 88px;
		object-fit: contain;
	}
	.detailName { font-size: 24px; font-weight: 800; }
	.detailSub {
		display: flex;
		align-items: center;
		gap: 10px;
		margin: 6px 0;
		.muted { color: #777; font-size: 13px; }
	}

	.thumbs {
		display: flex;
		gap: 10px;
		flex-wrap: wrap;
		margin: 16px 0;
	}
	.thumb {
		max-height: 150px;
		border-radius: 8px;
		border: 1px solid rgba(0, 0, 0, 0.12);
	}

	.detailBody {
		margin-top: 14px;
		font-size: 14px;
		color: #333;
	}

	.perms {
		margin-top: 18px;
		padding: 12px 16px;
		background: rgba(0, 0, 0, 0.04);
		border-radius: 8px;

		.permsTitle {
			font-weight: 700;
			font-size: 13px;
			margin-bottom: 6px;
		}
		ul { margin: 0; padding-left: 18px; }
		li { font-size: 13px; margin: 2px 0; }
	}

</style>
