<!--
	SpotlightSearch.vue
	-------------------

	A fullscreen quick-jump (Spotlight-style) launcher. Type to filter the app's
	navigable destinations - the permanent pages plus every ADDED toy/game/tool -
	and arrow/enter (or click) to jump there. Backed by ctApp.getNavDestinations()
	+ ctApp.navigateTo(), so it routes the main tab AND the box side-tab in one go.

	Controlled by MainWindow via `open` + `@close`. Opens on the top-right search
	icon or Ctrl/Cmd+K.
-->
<template>
	<transition name="spotFade">
		<div v-if="open" class="spotlightOverlay" @click.self="close">
			<div class="spotlightBox">

				<div class="spotInputRow">
					<span class="material-icons searchIcon">search</span>
					<input
						ref="inputEl"
						v-model="query"
						class="spotInput"
						type="text"
						placeholder="Jump to a page, toy, game, or tool…"
						@keydown="onKey"
					/>
					<span class="spotHint">esc</span>
				</div>

				<ul v-if="results.length" class="spotResults">
					<li
						v-for="(d, i) in results"
						:key="d.id"
						class="spotItem"
						:class="{ active: i === selected }"
						@click="choose(d)"
						@mouseenter="selected = i"
					>
						<img
							v-if="iconFor(d).type === 'img'"
							:src="iconFor(d).src"
							class="spotItemIcon"
							alt=""
							@error="(e) => e.target.style.visibility = 'hidden'"
						/>
						<span v-else class="material-icons spotItemIcon mat">{{ iconFor(d).name }}</span>

						<span class="spotItemLabel">{{ d.label }}</span>
						<span class="spotItemKind">{{ kindFor(d) }}</span>
					</li>
				</ul>

				<div v-else class="spotEmpty">No matches</div>

			</div>
		</div>
	</transition>
</template>
<script setup>

import { ref, computed, watch, nextTick, inject } from 'vue';

const props = defineProps({
	open: { type: Boolean, default: false },
});
const emit = defineEmits(['close']);

const ctApp = inject('ctApp');

const inputEl = ref(null);
const query = ref('');
const selected = ref(0);

// material icon per permanent page
const TAB_ICONS = {
	'tab:help': 'menu_book',
	'tab:settings': 'settings_ethernet',
	'tab:toy': 'toys',
	'tab:game': 'sports_esports',
	'tab:tool': 'build',
	'tab:system': 'storage',
};


// filtered, ranked destinations
const results = computed(() => {
	const all = ctApp.getNavDestinations();
	const q = query.value.trim().toLowerCase();
	if (!q)
		return all;

	const scored = [];
	for (const d of all) {
		const label = d.label.toLowerCase();
		const hay = `${label} ${(d.keywords || []).join(' ')}`.toLowerCase();
		if (!hay.includes(q)) continue;
		// rank: label startsWith > label includes > keyword-only
		let score = 2;
		if (label.startsWith(q)) score = 0;
		else if (label.includes(q)) score = 1;
		scored.push({ d, score });
	}
	scored.sort((a, b) => a.score - b.score);
	return scored.map((s) => s.d).slice(0, 40);
});


/**
 * Icon descriptor for a destination.
 *
 * @param {Object} d
 * @returns {{type:string, src?:string, name?:string}}
 */
function iconFor(d) {
	if (d.slug) {
		const c = ctApp.toysData.asObject[d.slug];
		return { type: 'img', src: (c && c.iconURL) || `assets/icons/${d.slug}.png` };
	}
	return { type: 'mat', name: TAB_ICONS[d.id] || 'tab' };
}

/**
 * @param {Object} d
 * @returns {string}
 */
function kindFor(d) {
	if (d.slug)
		return ({ toy: 'Toy', game: 'Game', tool: 'Tool' })[d.toyClass] || 'Toy';
	return 'Page';
}


function close() {
	emit('close');
}

/**
 * @param {Object} d
 */
function choose(d) {
	if (!d) return;
	ctApp.navigateTo(d);
	close();
}


/**
 * @param {KeyboardEvent} e
 */
function onKey(e) {
	if (e.key === 'Escape') { e.preventDefault(); close(); return; }
	const list = results.value;
	if (e.key === 'ArrowDown') {
		e.preventDefault();
		selected.value = Math.min(selected.value + 1, list.length - 1);
	} else if (e.key === 'ArrowUp') {
		e.preventDefault();
		selected.value = Math.max(selected.value - 1, 0);
	} else if (e.key === 'Enter') {
		e.preventDefault();
		choose(list[selected.value]);
	}
}


// keep the selection in range as results change
watch(results, () => {
	if (selected.value > results.value.length - 1)
		selected.value = Math.max(0, results.value.length - 1);
});

// reset + focus on open
watch(() => props.open, async (o) => {
	if (!o) return;
	query.value = '';
	selected.value = 0;
	await nextTick();
	if (inputEl.value) inputEl.value.focus();
});

</script>
<style lang="scss" scoped>

	.spotlightOverlay {
		position: fixed;
		inset: 0;
		z-index: 2000;
		background: rgba(0, 0, 0, 0.45);
		backdrop-filter: blur(4px);
		display: flex;
		justify-content: center;
		align-items: flex-start;
		padding-top: 12vh;
	}

	.spotlightBox {
		width: min(640px, 92vw);
		max-height: 70vh;
		background: #fff;
		border-radius: 14px;
		box-shadow: 0 24px 60px rgba(0, 0, 0, 0.4);
		overflow: hidden;
		display: flex;
		flex-direction: column;
	}

	.spotInputRow {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 14px 16px;
		border-bottom: 1px solid rgba(0, 0, 0, 0.08);

		.searchIcon { color: #888; font-size: 24px; }
		.spotHint {
			font-size: 11px;
			color: #999;
			border: 1px solid #ddd;
			border-radius: 5px;
			padding: 1px 6px;
		}
	}

	.spotInput {
		flex: 1 1 auto;
		border: 0;
		outline: none;
		font-size: 19px;
		background: transparent;
	}

	.spotResults {
		list-style: none;
		margin: 0;
		padding: 6px;
		overflow-y: auto;
	}

	.spotItem {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 9px 12px;
		border-radius: 8px;
		cursor: pointer;

		.spotItemIcon {
			width: 28px;
			height: 28px;
			object-fit: contain;
			&.mat { font-size: 24px; color: #555; text-align: center; }
		}
		.spotItemLabel { flex: 1 1 auto; font-size: 15px; font-weight: 600; }
		.spotItemKind {
			font-size: 11px;
			font-weight: 700;
			text-transform: uppercase;
			letter-spacing: 0.03em;
			color: #999;
		}
	}
	.spotItem.active {
		background: #E0A21F;
		.spotItemLabel { color: #fff; }
		.spotItemKind { color: rgba(255, 255, 255, 0.85); }
		.spotItemIcon.mat { color: #fff; }
	}

	.spotEmpty {
		padding: 28px;
		text-align: center;
		color: #999;
	}

	// transition
	.spotFade-enter-active, .spotFade-leave-active { transition: opacity 0.12s ease; }
	.spotFade-enter-from, .spotFade-leave-to { opacity: 0; }

</style>
