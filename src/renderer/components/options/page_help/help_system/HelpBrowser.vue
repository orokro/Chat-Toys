<!--
	HelpBrowser.vue
	---------------

	The shell that drives the in-app help SPA. Built on top of the
	auto-discovery registry (helpRegistry.js) - this file knows nothing
	about specific topics and never needs editing when a topic is
	added/removed/renamed.

	Pass 1 (this version):
	  - Auto-built TOC sidebar (collapsible sections)
	  - Single-topic body area
	  - Live search input (title / tag / keyword / body text)
	  - Breadcrumbs above the body
	  - Back / Forward / Home navigation buttons
	  - Persists current topic + history via chromeRef so reopening
	    the app lands you where you left off
	  - Provides `helpNav` via Vue inject so <HelpLink> can drive nav
	  - Dev-time broken-link warnings to the console

	Pass 2 will layer on: deeper search UI (results list with snippets),
	keyboard shortcuts, in-topic section anchors in the breadcrumbs,
	share-to-clipboard for help: links.
-->
<template>

	<div class="helpBrowser">

		<!-- left: table of contents + search -->
		<aside class="tocPane">

			<div class="searchBox">
				<span class="material-icons searchIcon">search</span>
				<input
					ref="searchInputEl"
					v-model="searchQuery"
					type="text"
					placeholder="Search help..."
					class="searchInput"
				/>
				<button
					v-if="searchQuery"
					class="searchClear"
					title="Clear search"
					@click="searchQuery = ''"
				>
					<span class="material-icons">close</span>
				</button>
			</div>

			<!-- Search results take over when a query is active. The
			     normal TOC tree resumes once the query is cleared. -->
			<div v-if="searchQuery && searchResults.length > 0" class="searchResults">
				<div class="searchHeader">
					{{ searchResults.length }} match<span v-if="searchResults.length !== 1">es</span>
				</div>
				<ul class="searchList">
					<li
						v-for="result in searchResults"
						:key="result.id"
						class="searchResultItem"
						:class="{ active: result.id === currentTopicId }"
						@click="goto(result.id)"
					>
						<div class="resultTitle">{{ result.title }}</div>
						<div class="resultPath">{{ pathLabel(result.id) }}</div>
					</li>
				</ul>
			</div>

			<div v-else-if="searchQuery" class="searchEmpty">
				No matches for <em>{{ searchQuery }}</em>.
			</div>

			<nav v-else class="tocTree" aria-label="Help contents">
				<TocNode
					v-for="root in rootTopics"
					:key="root.id"
					:node="root"
					:currentId="currentTopicId"
					@select="goto"
				/>
			</nav>

		</aside>

		<!-- right: breadcrumbs + topic body -->
		<main class="bodyPane">

			<!-- top nav strip -->
			<div class="bodyNav">

				<div class="navButtons">
					<button
						class="navBtn"
						:disabled="!canGoBack"
						title="Back"
						@click="goBack"
					>
						<span class="material-icons">arrow_back</span>
					</button>
					<button
						class="navBtn"
						:disabled="!canGoForward"
						title="Forward"
						@click="goForward"
					>
						<span class="material-icons">arrow_forward</span>
					</button>
					<button
						class="navBtn"
						title="Home"
						@click="goHome"
					>
						<span class="material-icons">home</span>
					</button>
				</div>

				<nav class="breadcrumbs" aria-label="Breadcrumbs">
					<template v-for="(crumb, idx) in breadcrumbs" :key="crumb.id">
						<span
							class="crumb"
							:class="{ leaf: idx === breadcrumbs.length - 1 }"
							@click="idx === breadcrumbs.length - 1 ? null : goto(crumb.id)"
						>
							{{ crumb.title }}
						</span>
						<span
							v-if="idx !== breadcrumbs.length - 1"
							class="crumbSep material-icons"
						>chevron_right</span>
					</template>
				</nav>

			</div>

			<!-- topic body -->
			<article class="topicBody">

				<h1 v-if="currentTopic" class="topicTitle">{{ currentTopic.title }}</h1>

				<component
					v-if="currentTopic && currentTopic.component"
					:is="currentTopic.component"
				/>

				<!-- Fallback: section landing with no body, OR an
				     id that doesn't resolve. We auto-render a child
				     index in that case so the section is still
				     navigable. -->
				<div v-else-if="currentTopic" class="topicSectionLanding">
					<p class="landingBlurb">
						This section contains the following topics:
					</p>
					<ul class="landingList">
						<li
							v-for="child in childrenOfCurrent"
							:key="child.id"
							@click="goto(child.id)"
						>
							<span class="landingTitle">{{ child.title }}</span>
							<span v-if="child.summary" class="landingSummary">{{ child.summary }}</span>
						</li>
					</ul>
				</div>

				<div v-else class="topicMissing">
					<p>That topic doesn't exist (anymore?). Try one from the menu on the left.</p>
				</div>

			</article>

		</main>

	</div>

</template>
<script setup>

// vue
import { ref, computed, provide, onMounted, watch, nextTick } from 'vue';
import { chromeRef } from '@scripts/chromeRef';

// registry + search
import { getTopicMap, getChildrenOf, breadcrumbsFor, findBrokenHelpLinks } from './helpRegistry';
import { searchTopics } from './helpSearchIndex';

// local TOC tree node
import TocNode from './TocNode.vue';


// -- state ----------------------------------------------------------------

// Currently-displayed topic id. Persisted across app restarts so the
// reader returns to where they left off.
const currentTopicId = chromeRef('helpBrowserTopic', '');

// Local nav history stack. Index points at the *current* entry.
// Browser-style: back pops backward, forward re-applies a previously
// popped entry. New navigations truncate the forward stack.
const navHistory = ref([currentTopicId.value]);
const navIndex   = ref(0);

// Search query bound to the input. When non-empty the TOC is replaced
// with a results list.
const searchQuery = ref('');

// dom ref for autofocus + keyboard shortcuts
const searchInputEl = ref(null);


// -- derived ---------------------------------------------------------------

// Live topic map. Re-read on each render so HMR additions appear.
const topicMap = computed(() => getTopicMap());

// Root-level topics (the children of the empty-string root).
const rootTopics = computed(() => buildTree(''));

/**
 * Recursively build a TOC tree node for the given parent id.
 *
 * @param {string} pid - parent id
 * @returns {Array<{ topic: Object, children: Array }>} tree nodes
 */
function buildTree(pid) {
	const children = getChildrenOf(pid);
	return children.map(t => ({
		topic: t,
		children: buildTree(t.id),
	}));
}

// Current topic record (or null while loading / for missing ids).
const currentTopic = computed(() => topicMap.value[currentTopicId.value] || null);

// Children of the current section - used by the auto-rendered section
// landing fallback when a section has no index.vue body.
const childrenOfCurrent = computed(() => {
	if (!currentTopic.value) return [];
	return getChildrenOf(currentTopic.value.id);
});

// Breadcrumb chain for the current topic.
const breadcrumbs = computed(() => breadcrumbsFor(currentTopicId.value));

// Search results - empty array when query is blank.
const searchResults = computed(() => searchTopics(searchQuery.value));

// Back / forward availability for the toolbar.
const canGoBack    = computed(() => navIndex.value > 0);
const canGoForward = computed(() => navIndex.value < navHistory.value.length - 1);


// -- navigation API -------------------------------------------------------

/**
 * Navigate to a topic id, optionally scrolling to a section anchor.
 * Truncates the forward history if we were mid-stack.
 *
 * @param {string} id - target topic id
 * @param {string|null} [fragment] - optional section anchor
 */
function goto(id, fragment = null) {

	// no-op if already on this exact target
	if (id === currentTopicId.value && !fragment) return;

	// truncate forward history then push the new entry
	navHistory.value = navHistory.value.slice(0, navIndex.value + 1);
	navHistory.value.push(id);
	navIndex.value = navHistory.value.length - 1;

	currentTopicId.value = id;

	// scroll to fragment after the new topic mounts. The double rAF
	// is to let the component render its <HelpSection>s first.
	if (fragment) {
		nextTick(() => requestAnimationFrame(() => {
			const el = document.getElementById(fragment);
			if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
		}));
	} else {
		// scroll body pane to top so the new topic starts fresh
		nextTick(() => requestAnimationFrame(() => {
			const main = document.querySelector('.helpBrowser .bodyPane');
			if (main) main.scrollTop = 0;
		}));
	}
}


/**
 * Back one step in history.
 */
function goBack() {
	if (!canGoBack.value) return;
	navIndex.value -= 1;
	currentTopicId.value = navHistory.value[navIndex.value];
}


/**
 * Forward one step in history (only meaningful after a back).
 */
function goForward() {
	if (!canGoForward.value) return;
	navIndex.value += 1;
	currentTopicId.value = navHistory.value[navIndex.value];
}


/**
 * Jump to the welcome landing.
 */
function goHome() {
	goto('gettingStarted.welcome');
}


/**
 * Resolve a topic id to its title - used by HelpLink for default
 * link text and tooltips.
 *
 * @param {string} id
 * @returns {string|null}
 */
function resolveTitle(id) {
	return topicMap.value[id]?.title || null;
}


/**
 * Compose a "breadcrumb-flavored" path label for a topic id, used in
 * search results to show where a topic lives in the tree.
 *
 *   'toys.horseRacing' -> 'Toys › Horse Racing'
 *
 * @param {string} id
 * @returns {string}
 */
function pathLabel(id) {
	const chain = breadcrumbsFor(id);
	return chain.map(c => c.title).join(' › ');
}


// expose the nav API to descendants (HelpLink uses this)
provide('helpNav', {
	goto,
	resolveTitle,
});


// -- lifecycle ------------------------------------------------------------

onMounted(() => {

	// If we have no persisted topic yet, default to welcome.
	if (!currentTopicId.value || !topicMap.value[currentTopicId.value]) {
		const welcomeId = 'gettingStarted.welcome';
		if (topicMap.value[welcomeId]) {
			currentTopicId.value = welcomeId;
			navHistory.value = [welcomeId];
			navIndex.value = 0;
		}
	}

	// Dev sanity check - log any dangling HelpLink targets.
	if (import.meta.env && import.meta.env.DEV) {
		const broken = findBrokenHelpLinks();
		if (broken.length > 0) {
			// eslint-disable-next-line no-console
			console.warn('[help] broken HelpLink targets:', broken);
		}
	}
});


// Clear the forward stack and re-anchor history when the user picks a
// brand new topic via search. The watch fires after `goto` already
// mutated currentTopicId, so we only need to sanity-bound the index.
watch(currentTopicId, (val) => {
	if (navHistory.value[navIndex.value] !== val) {
		// Out-of-band update (e.g. external `onShowHelp` jump). Treat
		// it as a fresh navigation entry.
		navHistory.value = navHistory.value.slice(0, navIndex.value + 1);
		navHistory.value.push(val);
		navIndex.value = navHistory.value.length - 1;
	}
});

</script>
<style lang="scss" scoped>

	// Whole help browser sits inside the existing help-tab content
	// area. We claim full height of that area and split into a fixed-
	// width left rail (TOC + search) and a flexible body pane.
	.helpBrowser {

		// fill the host content area
		position: relative;
		display: flex;
		gap: 0;

		// the host (.contentPageArea > .actualContent) gives us a
		// generous min-height; help is meant to read like a manual,
		// so we want at least one full screen of "page"
		min-height: calc(100vh - 120px);

		// book-paper feel
		background: #fdfcf8;
		border: 1px solid rgba(0, 0, 0, 0.12);
		border-radius: 8px;
		overflow: hidden;

		.tocPane {

			// fixed-ish width left rail
			width: 280px;
			min-width: 280px;
			max-width: 280px;
			flex-shrink: 0;

			// subtle paper-edge separation
			background: #f4f1ea;
			border-right: 1px solid rgba(0, 0, 0, 0.1);

			// own scroll so the TOC can be long
			overflow-y: auto;
			max-height: calc(100vh - 80px);

			// search box at the top
			.searchBox {

				position: sticky;
				top: 0;
				z-index: 2;

				display: flex;
				align-items: center;
				gap: 6px;

				padding: 10px;
				background: #f4f1ea;
				border-bottom: 1px solid rgba(0, 0, 0, 0.08);

				.searchIcon {
					color: rgba(0, 0, 0, 0.4);
					font-size: 18px;
				}

				.searchInput {

					flex: 1;
					min-width: 0;

					padding: 6px 8px;
					font-size: 13.5px;

					border: 1px solid rgba(0, 0, 0, 0.15);
					border-radius: 5px;
					background: white;
					outline: none;

					&:focus {
						border-color: #00abae;
						box-shadow: 0 0 0 2px rgba(0, 171, 174, 0.18);
					}

				}// .searchInput

				.searchClear {

					background: none;
					border: none;
					padding: 2px;
					cursor: pointer;

					color: rgba(0, 0, 0, 0.45);

					&:hover {
						color: rgba(0, 0, 0, 0.8);
					}

					.material-icons {
						font-size: 18px;
					}

				}// .searchClear

			}// .searchBox

			.tocTree {

				padding: 6px 8px 20px 8px;

			}// .tocTree

			.searchResults {

				padding: 10px 8px 20px 8px;

				.searchHeader {
					font-size: 11.5px;
					color: rgba(0, 0, 0, 0.55);
					text-transform: uppercase;
					letter-spacing: 0.5px;
					padding: 0 6px 8px 6px;
				}

				.searchList {

					list-style: none;
					padding: 0;
					margin: 0;

					.searchResultItem {

						padding: 6px 10px;
						margin-bottom: 2px;
						border-radius: 5px;
						cursor: pointer;

						&:hover {
							background: rgba(0, 0, 0, 0.06);
						}

						&.active {
							background: rgba(0, 171, 174, 0.15);
						}

						.resultTitle {
							font-size: 13.5px;
							font-weight: 500;
							color: #1f2240;
						}

						.resultPath {
							font-size: 11.5px;
							color: rgba(0, 0, 0, 0.5);
							margin-top: 2px;
						}

					}// .searchResultItem

				}// .searchList

			}// .searchResults

			.searchEmpty {

				padding: 20px 14px;
				font-size: 13px;
				color: rgba(0, 0, 0, 0.5);
				font-style: italic;

			}// .searchEmpty

		}// .tocPane

		.bodyPane {

			flex: 1;
			min-width: 0;

			// own scroll so the body pane can be long
			overflow-y: auto;
			max-height: calc(100vh - 80px);

			.bodyNav {

				position: sticky;
				top: 0;
				z-index: 2;

				display: flex;
				align-items: center;
				gap: 12px;

				padding: 8px 16px;
				background: rgba(253, 252, 248, 0.92);
				backdrop-filter: blur(4px);
				border-bottom: 1px solid rgba(0, 0, 0, 0.08);

				.navButtons {

					display: flex;
					gap: 4px;

					.navBtn {

						background: none;
						border: 1px solid rgba(0, 0, 0, 0.12);
						border-radius: 5px;
						padding: 3px 6px;
						cursor: pointer;

						color: rgba(0, 0, 0, 0.65);

						.material-icons {
							font-size: 18px;
							vertical-align: middle;
						}

						&:hover:not(:disabled) {
							background: rgba(0, 0, 0, 0.05);
							color: rgba(0, 0, 0, 0.85);
						}

						&:disabled {
							opacity: 0.35;
							cursor: default;
						}

					}// .navBtn

				}// .navButtons

				.breadcrumbs {

					flex: 1;
					min-width: 0;

					display: flex;
					align-items: center;
					flex-wrap: wrap;
					gap: 4px;

					font-size: 13px;
					color: rgba(0, 0, 0, 0.55);

					.crumb {

						cursor: pointer;
						padding: 2px 4px;
						border-radius: 4px;

						&:hover {
							background: rgba(0, 0, 0, 0.06);
							color: rgba(0, 0, 0, 0.85);
						}

						&.leaf {
							color: #1f2240;
							font-weight: 500;
							cursor: default;

							&:hover {
								background: none;
							}
						}

					}// .crumb

					.crumbSep {
						font-size: 16px;
						color: rgba(0, 0, 0, 0.3);
					}

				}// .breadcrumbs

			}// .bodyNav

			.topicBody {

				padding: 24px 40px 60px 40px;
				max-width: 780px;

				.topicTitle {

					// the topic's H1 - reserved for this shell, not
					// for HelpSection (which starts at h2).
					font-family: Georgia, 'Times New Roman', serif;
					font-size: 32px;
					font-weight: 700;
					color: #14163a;
					margin: 0 0 24px 0;
					line-height: 1.2;

					padding-bottom: 12px;
					border-bottom: 2px solid rgba(38, 34, 98, 0.25);

				}// .topicTitle

				.topicSectionLanding {

					.landingBlurb {
						color: rgba(0, 0, 0, 0.65);
						margin-bottom: 16px;
					}

					.landingList {

						list-style: none;
						padding: 0;
						margin: 0;

						li {

							display: block;
							padding: 12px 14px;
							margin-bottom: 8px;

							background: white;
							border: 1px solid rgba(0, 0, 0, 0.1);
							border-radius: 6px;
							cursor: pointer;

							transition: background 0.12s ease, border-color 0.12s ease;

							&:hover {
								background: #f1f8ff;
								border-color: #b8d6f5;
							}

							.landingTitle {
								display: block;
								font-weight: 600;
								color: #1f2240;
								font-size: 15px;
							}

							.landingSummary {
								display: block;
								margin-top: 4px;
								font-size: 13.5px;
								color: rgba(0, 0, 0, 0.6);
							}

						}// li

					}// .landingList

				}// .topicSectionLanding

				.topicMissing {

					padding: 40px 0;
					color: rgba(0, 0, 0, 0.55);
					font-style: italic;

				}// .topicMissing

			}// .topicBody

		}// .bodyPane

	}// .helpBrowser

</style>
