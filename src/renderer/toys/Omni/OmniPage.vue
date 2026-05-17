<!--
	OmniPage.vue
	------------

	Settings page for the Omni toy.

	The streamer manages omni groups via a drag-and-drop UI. A pool of every
	alert-eligible toy ("chips") sits at the top; each configured group has
	a drop box below. A chip can only physically exist in one container at a
	time (pool, or one group), which is what prevents the "same toy in two
	groups" overlap problem - the rule emerges from the UI mechanic rather
	than being enforced as an afterthought.

	Uses native HTML5 drag-and-drop (`draggable="true"` + drag events). Each
	drag carries the toy slug; the drop handler removes it from wherever it
	came from and adds it to the destination.
-->
<template>

	<PageBox
		title="Omni Widget Settings"
		:themeColor="toy.static.themeColor"
		themeImage="assets/bg_tiles/omni.png"
		bgThemePos="35px"
	>
		<div class="picBox" :style="{ height: '350px' }">
			<img src="/assets/icons/omni.png" height="300px" style="float:right" onerror="this.style.display='none'"/>
		</div>

		<br>
		<p>
			Bundle multiple alert-style widgets into one OBS browser source.
			When a toy is in a group, its alerts will take turns sharing the
			group's slot - if a donation is showing when a shout fires, the
			shout holds until the donation finishes.
			<br><br>
			Drag a toy chip from the pool below into a group to include it.
			Drag back to the pool to remove. A toy can only be in one group
			at a time.
		</p>

		<WidgetSection :toy="toy" />

		<SectionHeader title="Available Alert Toys"/>
		<p class="small">
			Toys currently in chat-toys with <code>isAlertToy = true</code>.
			Drag any of these into a group below.
		</p>

		<div
			class="chip-pool"
			@dragover.prevent="onDragOver"
			@drop="onDropToPool"
		>
			<ToyChip
				v-for="slug in poolToys"
				:key="slug"
				:toySlug="slug"
				@dragstart="onDragStart(slug, null, $event)"
			/>
			<div v-if="poolToys.length === 0" class="empty-pool-hint">
				All alert toys are currently assigned. Drag one back here to remove it from its group.
			</div>
		</div>

		<SectionHeader title="Omni Groups"/>
		<p class="small">
			Each group renders as a separate OBS browser source URL (see the
			Widget section above). Click a group's name to rename it.
		</p>

		<div class="group-list">
			<div
				v-for="(group, gi) in omniGroups"
				:key="group.id"
				class="group"
			>
				<div class="group-header">
					<input
						class="group-name"
						type="text"
						:value="group.name"
						@change="renameGroup(group.id, $event.target.value)"
						@keydown.enter="$event.target.blur()"
					/>
					<button class="delete-btn" @click="deleteGroup(group.id)" title="Delete this group">×</button>
				</div>

				<div
					class="group-drop"
					:class="{ empty: (group.includedToys?.length || 0) === 0 }"
					@dragover.prevent="onDragOver"
					@drop="onDropToGroup(group.id, $event)"
				>
					<ToyChip
						v-for="slug in (group.includedToys || [])"
						:key="slug"
						:toySlug="slug"
						@dragstart="onDragStart(slug, group.id, $event)"
					/>
					<div v-if="(group.includedToys?.length || 0) === 0" class="empty-group-hint">
						Drop alert toys here
					</div>
				</div>
			</div>

			<button class="add-group-btn" @click="addGroup">+ Add Group</button>
		</div>

	</PageBox>

</template>
<script setup>

// vue
import { inject, computed } from 'vue';

// lib/misc
import { v4 as uuidv4 } from 'uuid';

// components
import PageBox from '@components/options/PageBox.vue';
import SectionHeader from '@components/options/SectionHeader.vue';
import WidgetSection from '@components/options/WidgetSection.vue';
import ToyChip from './ToyChip.vue';

// our app
import Omni from './Omni';


const ctApp = inject('ctApp');
const toy = ctApp.toyManager.toys[Omni.slug];
const { omniGroups } = toy.settings;


/**
 * All slugs of toys with `static isAlertToy = true` in the registry.
 * Doesn't include the Omni itself.
 *
 * @type {import('vue').ComputedRef<string[]>}
 */
const allAlertSlugs = computed(() => {
	const out = [];
	for (const T of ctApp.toysData) {
		if (T.slug === Omni.slug) continue;
		if (T.isAlertToy === true) out.push(T.slug);
	}
	return out;
});


/**
 * Slugs that are currently NOT in any group - i.e., what shows in the
 * pool at the top of the page.
 */
const poolToys = computed(() => {
	const assigned = new Set();
	for (const g of omniGroups.value) {
		for (const s of (g.includedToys || [])) assigned.add(s);
	}
	return allAlertSlugs.value.filter(s => !assigned.has(s));
});


/**
 * The most recently dragged chip's metadata. Stored on dragstart, consumed
 * on drop. Uses a closure variable rather than dataTransfer because IE-era
 * DnD APIs are fiddly across browsers and we control both ends.
 *
 * @type {?{ slug:string, fromGroupId:?string }}
 */
let dragPayload = null;


/**
 * Drag start - record the source. Empty event.dataTransfer placeholder so
 * Firefox actually starts the drag (it requires *some* data to be set).
 *
 * @param {string} slug
 * @param {?string} fromGroupId - null if dragging from the pool
 * @param {DragEvent} ev
 */
function onDragStart(slug, fromGroupId, ev) {
	dragPayload = { slug, fromGroupId };
	if (ev?.dataTransfer) {
		ev.dataTransfer.effectAllowed = 'move';
		ev.dataTransfer.setData('text/plain', slug);
	}
}


/**
 * Prevent default on dragover so the drop is accepted. Marks the cursor
 * as a "move" indicator.
 *
 * @param {DragEvent} ev
 */
function onDragOver(ev) {
	if (ev.dataTransfer) ev.dataTransfer.dropEffect = 'move';
}


/**
 * Drop into the pool: remove the chip from whichever group it came from.
 * Drop is a no-op if the chip was already in the pool (no source group).
 */
function onDropToPool() {
	const payload = dragPayload;
	dragPayload = null;
	if (!payload || !payload.fromGroupId) return;

	updateGroups(groups => groups.map(g => {
		if (g.id !== payload.fromGroupId) return g;
		return { ...g, includedToys: (g.includedToys || []).filter(s => s !== payload.slug) };
	}));
}


/**
 * Drop onto a group: remove from source (pool or another group) and add
 * to this group. No-op if dropping onto the same group it came from.
 *
 * @param {string} targetGroupId
 */
function onDropToGroup(targetGroupId) {
	const payload = dragPayload;
	dragPayload = null;
	if (!payload) return;
	if (payload.fromGroupId === targetGroupId) return;

	updateGroups(groups => groups.map(g => {
		if (g.id === payload.fromGroupId) {
			// Remove from source group
			return { ...g, includedToys: (g.includedToys || []).filter(s => s !== payload.slug) };
		}
		if (g.id === targetGroupId) {
			// Add to target group (skip duplicate just in case)
			const list = g.includedToys || [];
			if (list.includes(payload.slug)) return g;
			return { ...g, includedToys: [...list, payload.slug] };
		}
		return g;
	}));
}


/**
 * Add a new empty omni group. Names are non-unique; the streamer can
 * rename inline.
 */
function addGroup() {
	const n = (omniGroups.value?.length || 0) + 1;
	updateGroups(groups => [
		...groups,
		{ id: uuidv4(), name: `Omni Group ${n}`, includedToys: [] },
	]);
}


/**
 * Remove a group entirely. Its toys fall back into the pool.
 *
 * @param {string} groupId
 */
function deleteGroup(groupId) {
	updateGroups(groups => groups.filter(g => g.id !== groupId));
}


/**
 * Rename a group inline. Empty names fall back to a sensible default so
 * the URL list in WidgetSection doesn't have a blank label.
 *
 * @param {string} groupId
 * @param {string} newName
 */
function renameGroup(groupId, newName) {
	const name = (newName || '').trim() || 'Untitled group';
	updateGroups(groups => groups.map(g =>
		g.id === groupId ? { ...g, name } : g
	));
}


/**
 * Helper to apply an immutable update to the omniGroups ref. Always
 * replaces the array reference (not in-place) so the shallowRef-based
 * settings socket sees a change.
 *
 * @param {(groups:Array<Object>) => Array<Object>} fn
 */
function updateGroups(fn) {
	omniGroups.value = fn(omniGroups.value || []);
}

</script>
<style lang="scss" scoped>

	.small {
		font-size: 0.9em;
		color: #555;
	}

	// Pool: full-width strip of available chips.
	.chip-pool {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		padding: 12px;
		background: #f5f5f5;
		border: 2px dashed #aaa;
		border-radius: 8px;
		min-height: 70px;
		align-items: center;
	}

	.empty-pool-hint {
		color: #888;
		font-style: italic;
		font-size: 0.9em;
		padding: 8px;
	}

	// Group list: stacked group cards.
	.group-list {
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 8px 0;
	}

	.group {
		background: rgba(123, 44, 191, 0.05);
		border: 2px solid #7B2CBF;
		border-radius: 10px;
		overflow: hidden;
	}

	.group-header {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 6px 10px;
		background: #7B2CBF;
		color: white;

		.group-name {
			flex: 1;
			background: rgba(255, 255, 255, 0.15);
			color: white;
			border: 1px solid rgba(255, 255, 255, 0.3);
			border-radius: 4px;
			padding: 4px 8px;
			font-size: 1em;
			font-weight: bold;

			&:focus {
				outline: 2px solid #fff;
				outline-offset: -1px;
			}
		}

		.delete-btn {
			background: rgba(255, 255, 255, 0.15);
			color: white;
			border: 1px solid rgba(255, 255, 255, 0.3);
			border-radius: 50%;
			width: 26px;
			height: 26px;
			cursor: pointer;
			font-size: 1.1em;
			line-height: 1;
			padding: 0;

			&:hover {
				background: rgba(255, 0, 0, 0.4);
			}
		}
	}

	.group-drop {
		min-height: 70px;
		padding: 12px;
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		align-items: center;
		background: #fafafa;

		&.empty {
			background: #f0f0f0;
		}
	}

	.empty-group-hint {
		color: #999;
		font-style: italic;
		font-size: 0.9em;
		padding: 8px;
	}

	.add-group-btn {
		align-self: flex-start;
		padding: 8px 14px;
		background: #7B2CBF;
		color: white;
		border: 2px solid black;
		border-radius: 8px;
		cursor: pointer;
		font-weight: bold;

		&:hover {
			background: #5e1da0;
		}
	}

</style>
