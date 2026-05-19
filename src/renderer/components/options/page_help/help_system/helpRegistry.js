/*
	helpRegistry.js
	---------------

	Auto-discovery registry for the in-app help system. Topic files
	dropped into the `topics/` folder are automatically picked up,
	classified by folder, and indexed - no edits needed here per topic.

	How it works
	------------

	`import.meta.glob('./topics/...', { eager: true })` makes Vite
	eager-import every match at module-eval time. We get a map of
	    `./topics/toys/horseRacing.vue` -> module
	from which we read:
	    - module.default (the Vue component)
	    - module.meta    (the named export with title/tags/etc)

	A second glob (with `?raw`) gives us each file as a *string*, which
	is what powers the body-text search index (see helpSearchIndex.js).

	Topic id is derived from the file's path under `topics/`:
	    topics/toys/horseRacing.vue        -> id: 'toys.horseRacing'
	    topics/concepts/textSettings.vue   -> id: 'concepts.textSettings'
	    topics/toys/index.vue              -> id: 'toys'         (section landing)

	Parent is the same id minus the last segment. Override with
	`meta.parent` if the conceptual home differs from the folder.

	HMR
	---

	Vite re-evaluates the glob when topic files are added, removed, or
	edited. The registry is reactive in the sense that we call
	`buildRegistry()` lazily and cache the result, but on each HMR
	round the module is reloaded, so consumers that import from this
	file pick up the new tree on next render. The HelpBrowser wraps
	its registry access in a `ref` keyed off `import.meta.hot` so the
	UI updates without a manual reload.
*/


// Eager-import every topic SFC. The glob pattern intentionally targets
// only `.vue` files directly under `topics/**/` - no recursion guard
// needed, glob already restricts to that shape.
const topicModules = import.meta.glob('./topics/**/*.vue', { eager: true });

// Same set of files but pulled in as raw text - used by the search
// index builder to extract body text without having to render anything.
const topicSources = import.meta.glob('./topics/**/*.vue', {
	query: '?raw',
	import: 'default',
	eager: true,
});


/**
 * Convert a file path under `topics/` into a dot-separated topic id.
 *
 *   ./topics/toys/horseRacing.vue        -> 'toys.horseRacing'
 *   ./topics/toys/index.vue              -> 'toys'
 *   ./topics/concepts/textSettings.vue   -> 'concepts.textSettings'
 *   ./topics/index.vue                   -> '' (the root)
 *
 * @param {string} filePath - the glob key
 * @returns {string} dot-separated id, or '' for the root
 */
function pathToId(filePath) {

	// Strip leading './topics/' and trailing '.vue'
	const stripped = filePath
		.replace(/^\.\/topics\//, '')
		.replace(/\.vue$/, '');

	// `index` means the section/root landing - drop that final segment
	const segments = stripped.split('/');
	if (segments[segments.length - 1] === 'index')
		segments.pop();

	return segments.join('.');
}


/**
 * Derive the parent id from a child id.
 *
 *   'toys.horseRacing' -> 'toys'
 *   'toys'             -> ''     (root)
 *   ''                 -> null   (root has no parent)
 *
 * @param {string} id - the child id
 * @returns {string|null} parent id, or null if the input is root
 */
function parentId(id) {
	if (!id) return null;
	const dotIdx = id.lastIndexOf('.');
	if (dotIdx < 0) return '';
	return id.slice(0, dotIdx);
}


/**
 * Build the flat topic map from the glob results. Cached after first
 * build so consumers don't keep redoing the work.
 *
 * @returns {Object<string, {
 *   id: string,
 *   title: string,
 *   parent: (string|null),
 *   tags: string[],
 *   keywords: string[],
 *   summary: string,
 *   order: number,
 *   component: import('vue').Component,
 *   sourcePath: string,
 *   rawSource: string,
 * }>}
 */
let _topicMap = null;
export function getTopicMap() {

	if (_topicMap) return _topicMap;

	const map = {};

	for (const [filePath, mod] of Object.entries(topicModules)) {

		const id = pathToId(filePath);
		const meta = mod.meta || {};

		// derive parent: explicit meta.parent wins, else fall back to
		// the folder-derived parent. A root id ('') has parent null.
		const derivedParent = parentId(id);
		const parent = (typeof meta.parent === 'string') ? meta.parent : derivedParent;

		map[id] = {
			id,
			title:      meta.title    || (id || 'Help'),
			parent,
			tags:       Array.isArray(meta.tags)     ? meta.tags     : [],
			keywords:   Array.isArray(meta.keywords) ? meta.keywords : [],
			summary:    meta.summary  || '',
			order:      Number.isFinite(meta.order) ? meta.order : 999,
			component:  mod.default,
			sourcePath: filePath,
			rawSource:  topicSources[filePath] || '',
		};

	}// next module

	_topicMap = map;
	return map;
}


/**
 * Get a topic record by id. Returns null if the id isn't in the
 * registry (e.g. a HelpLink target was renamed).
 *
 * @param {string} id - topic id
 * @returns {Object|null}
 */
export function getTopic(id) {
	const map = getTopicMap();
	return map[id] || null;
}


/**
 * Get the direct children of a topic id, sorted by `meta.order` then
 * alphabetically by title. Pass '' to get the root-level sections.
 *
 * @param {string} parentIdent - the parent id, or '' for root
 * @returns {Array<Object>} sorted child topic records
 */
export function getChildrenOf(parentIdent) {

	const map = getTopicMap();
	const out = [];

	for (const topic of Object.values(map)) {
		if (topic.parent === parentIdent && topic.id !== parentIdent)
			out.push(topic);
	}

	out.sort((a, b) => {
		if (a.order !== b.order) return a.order - b.order;
		return a.title.localeCompare(b.title);
	});

	return out;
}


/**
 * Walk from the root down to a topic, returning the chain of records.
 * Used by the HelpBrowser to render breadcrumbs.
 *
 *   breadcrumbsFor('toys.horseRacing')
 *     -> [<root>, <toys>, <toys.horseRacing>]
 *
 * Gracefully tolerates missing parents (returns what it can).
 *
 * @param {string} id - target topic id
 * @returns {Array<Object>} chain of topic records, leaf-last
 */
export function breadcrumbsFor(id) {

	const map = getTopicMap();
	const chain = [];

	let cur = id;
	while (cur != null) {
		const t = map[cur];
		if (t) chain.unshift(t);
		else if (cur !== '') {
			// no topic record exists for this id - synthesize a stub
			// so the chain at least has the right shape and the user
			// sees what they're walking through.
			chain.unshift({
				id: cur,
				title: cur.split('.').pop(),
				parent: parentId(cur),
				synthetic: true,
			});
		}
		// stop at the root (parent is null)
		cur = t ? t.parent : parentId(cur);
		if (cur === null) break;
	}

	return chain;
}


/**
 * Dev-only sanity check: scan every topic's raw source for
 * <HelpLink to="..."> targets and report any that don't resolve in
 * the registry. Run this lazily from the HelpBrowser on mount so a
 * topic rename surfaces immediately in the dev console.
 *
 * @returns {Array<{ from: string, to: string }>} broken links
 */
export function findBrokenHelpLinks() {

	const map = getTopicMap();
	const broken = [];

	// Match <HelpLink to="..."> in any of the raw source strings.
	// Single OR double quotes; allows for a #fragment after the id.
	const re = /<HelpLink\s+[^>]*\bto\s*=\s*["']([^"']+)["']/g;

	for (const topic of Object.values(map)) {
		const src = topic.rawSource;
		if (!src) continue;
		let m;
		while ((m = re.exec(src)) !== null) {
			const target = m[1];
			const targetId = target.split('#')[0];
			if (!map[targetId]) {
				broken.push({ from: topic.id, to: target });
			}
		}
	}

	return broken;
}
