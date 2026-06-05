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
				</div>

				<div class="cardGrid">

					<div
						v-for="item in filteredItems"
						:key="item.slug"
						class="card"
						@click="openDetail(item)"
					>
						<img class="cardIcon" :src="item.icon" alt="" @error="onIconError" />

						<div class="cardMain">
							<div class="cardName">{{ item.name }}</div>
							<div class="cardDesc">{{ item.desc }}</div>
						</div>

						<div class="cardFooter">
							<span class="badge" :style="{ background: item.themeColor }">{{ classLabel(item.toyClass) }}</span>
							<span v-if="item.source === 'remote'" class="badge remote">Remote</span>
							<button
								class="actionBtn"
								:class="actionClass(item)"
								@click.stop="onAction(item)"
							>{{ actionLabel(item) }}</button>
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
								<span class="badge" :style="{ background: selected.themeColor }">{{ classLabel(selected.toyClass) }}</span>
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

// app
import { refreshInstalledPlugins } from '../../plugins/PluginManager';

// lib
import { closeModal } from 'jenesius-vue-modal';

const ctApp = inject('ctApp');

// remote shop catalog (fetched via main; empty until the server index exists)
const remoteItems = ref([]);

// slugs currently downloading/installing
const busy = reactive({});

onMounted(async () => {
	try {
		remoteItems.value = (await window.electronAPI.invoke('get-remote-plugins')) || [];
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
		await getRemote(it, true);
		return;
	}

	if (it.added) {
		ctApp.navigateToToy(it.slug);
		closeModal();
		return;
	}

	if (it.source === 'remote') {
		await getRemote(it, false);
		return;
	}

	// local (built-in or already-installed plugin): add + route to it
	ctApp.addToy(it.slug);
	ctApp.navigateToToy(it.slug);
	closeModal();
}


/**
 * Download + install (or update) a remote plugin via the main process, then
 * register it on the renderer. On a fresh install we also add + route to it.
 *
 * @param {Object} it
 * @param {boolean} isUpdate
 */
async function getRemote(it, isUpdate) {

	busy[it.slug] = true;
	try {
		await window.electronAPI.invoke('install-remote-plugin', { url: it.zip, filename: it.zipFilename });
		await refreshInstalledPlugins();

		if (!isUpdate) {
			ctApp.addToy(it.slug);
			ctApp.navigateToToy(it.slug);
		}
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
	.searchBox:focus { border-color: #E0A21F; }

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

	// ---- card grid ----
	.cardGrid {
		flex: 1 1 auto;
		overflow-y: auto;
		padding: 14px;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
		gap: 14px;
		align-content: start;
	}

	.card {
		background: #fff;
		border: 1px solid rgba(0, 0, 0, 0.12);
		border-radius: 12px;
		padding: 14px;
		display: flex;
		flex-direction: column;
		gap: 10px;
		cursor: pointer;
		transition: box-shadow 0.15s ease, transform 0.1s ease;
	}
	.card:hover {
		box-shadow: 0 6px 18px rgba(0, 0, 0, 0.12);
		transform: translateY(-2px);
	}

	.cardIcon {
		width: 56px;
		height: 56px;
		object-fit: contain;
	}

	.cardMain { flex: 1 1 auto; }
	.cardName { font-weight: 700; font-size: 15px; margin-bottom: 4px; }
	.cardDesc {
		font-size: 12.5px;
		color: #555;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.cardFooter {
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
		background: #E0A21F;
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
	.backBtn:hover { color: #E0A21F; }

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

</style>
