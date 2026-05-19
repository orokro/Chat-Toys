<!--
	WidgetsPage.vue
	---------------

	Master list of every widget URL across every currently-enabled toy and
	tool. One row per widget with a live-status light, a label, and a
	copyable URL.

	Reactivity: the row list is a `computed` that calls
	`toy.getWidgetURLs()` for every enabled toy. Because:
	  - enabling/disabling a toy changes `chatToysApp.enabledToys.value`,
	  - WidgetGroup / Omni override getWidgetURLs() to read their respective
	    `groups` / `omniGroups` setting refs,
	  - and Vue tracks reactive reads inside the computed,
	the master list automatically refreshes when:
	  - a toy is added or removed from the chat-toys app,
	  - a Group or Omni instance gets a new named sub-group,
	  - the OBS server port changes (rare, but covered).

	Each row reuses the existing WidgetRow component (status light + URL +
	copy button) - we just enrich `desc` with the parent toy's name so a
	row reads "Donations Popup - The popup that appears..." instead of just
	the widget description.
-->
<template>

	<PageBox
		title="Widgets"
		themeColor="#69457f"
		:limitWidth="true"
		themeImage="assets/bg_tiles/widgets.png"
	>
		<div class="picBox" :style="{ height: '350px' }">
			<img src="/assets/icons/widgetGroup.png" height="300px" style="float:right" onerror="this.style.display='none'"/>
		</div>

		<br><br>
		<p>
			Every widget across every toy and tool you've added to chat-toys,
			in one place. Drop any of these URLs into OBS as a browser source
			(or into a regular browser tab for testing).
		</p>
		<p>
			The status light at the start of each row tells you whether the
			widget is currently live somewhere — gray means nobody's
			rendering it, yellow means a regular browser tab, green means
			OBS. The list updates automatically when you add or remove toys,
			or when you configure new groups in the Group Widget or Omni
			Widget.
		</p>

		<SectionHeader title="All Active Widgets" />

		<div v-if="masterRows.length === 0" class="empty-state">
			You haven't added any toys or tools yet. Pop over to the
			<strong>Toy Box</strong> or <strong>Tool Box</strong> tab to add
			some — their widget URLs will show up here.
		</div>

		<div v-else class="widget-list">
			<WidgetRow
				v-for="row in masterRows"
				:key="row.url"
				:urlData="row"
			/>
		</div>

	</PageBox>

</template>
<script setup>

// vue
import { inject, computed } from 'vue';

// components
import PageBox from '@components/options/PageBox.vue';
import SectionHeader from '@components/options/SectionHeader.vue';
import WidgetRow from '@components/options/WidgetRow.vue';


const ctApp = inject('ctApp');


/**
 * Flat list of every widget URL currently exposed by an enabled toy.
 *
 * Each entry has the shape WidgetRow expects:
 *   { url, desc, toySlug, widgetSlug }
 *
 * We enrich `desc` with the parent toy's name so the master list rows
 * are self-identifying (without this, you'd see e.g. "Shows when a
 * chatter uses the !shout command" with no hint of which toy it belongs
 * to).
 */
const masterRows = computed(() => {

	const out = [];

	// Iterate the live toy instances rather than enabledToys.value because
	// toyManager.toys is what holds the constructed Toy objects with their
	// getWidgetURLs methods. We also touch enabledToys.value below so the
	// computed re-tracks when toys are enabled / disabled.
	const enabledSlugs = ctApp?.enabledToys?.value || [];
	const toys = ctApp?.toyManager?.toys || {};

	for (const slug of enabledSlugs) {
		const toy = toys[slug];
		if (!toy) continue;

		// getWidgetURLs is overridden by WidgetGroup + Omni to return one
		// entry per configured sub-group; reading their settings refs here
		// (inside the computed) is what makes new sub-groups auto-appear.
		const urls = toy.getWidgetURLs?.() || [];
		const toyName = toy.static?.name || slug;

		for (const url of urls) {
			out.push({
				...url,
				desc: `${toyName} — ${url.desc || ''}`,
			});
		}
	}

	return out;
});

</script>
<style lang="scss" scoped>

	.empty-state {
		padding: 20px;
		background: rgba(0, 0, 0, 0.04);
		border-radius: 8px;
		color: #444;
		font-size: 0.95em;
		line-height: 1.5;
	}

	.widget-list {
		// Match the spacing pattern used by WidgetSection so rows visually
		// group like they do on each toy's own settings page.
		display: flex;
		flex-direction: column;
	}

</style>
