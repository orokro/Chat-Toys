/*
	helpSearchIndex.js
	------------------

	Builds a lightweight in-memory search index over every topic.
	The corpus comes directly from each topic's raw SFC source (slurped
	via Vite's `?raw` glob in helpRegistry.js) - so there is exactly
	one source of truth (the topic file itself).

	Index shape, per topic:
	    {
	      id, title,
	      tags: ['game', 'betting', ...],
	      keywords: ['mutuel', ...],   // synonyms not in body text
	      bodyText: 'pari-mutuel horse racing where chatters bet ...',
	    }

	Search itself is a simple weighted substring match across:
	    title    (highest weight)
	    tags     (high)
	    keywords (high)
	    bodyText (medium)

	Returns results sorted by score, capped to a reasonable limit so
	the dropdown stays usable.
*/

import { getTopicMap } from './helpRegistry';


/**
 * Strip Vue SFC chrome from a raw source string and return just the
 * human-readable body text from the <template>.
 *
 * The general approach:
 *   1. Pull out the contents of the *first* top-level <template> tag.
 *   2. Remove the contents of <script> and <style> blocks anywhere in
 *      that template (rare, but Vue allows nested SFCs in tests).
 *   3. Convert HelpSection / HelpLink etc. into their visible text by
 *      preserving their text children + their `title` attribute.
 *   4. Drop all other tags.
 *   5. Decode the common HTML entities and collapse whitespace.
 *
 * @param {string} raw - the SFC source
 * @returns {string} body text suitable for substring search
 */
function extractBodyText(raw) {

	if (!raw) return '';

	// 1) grab the first <template>...</template> block
	const tplMatch = raw.match(/<template[^>]*>([\s\S]*?)<\/template>/i);
	let tpl = tplMatch ? tplMatch[1] : '';
	if (!tpl) return '';

	// 2) drop nested <script>/<style> blocks just in case
	tpl = tpl
		.replace(/<script[\s\S]*?<\/script>/gi, ' ')
		.replace(/<style[\s\S]*?<\/style>/gi, ' ');

	// 3) preserve `title` attribute values (HelpSection title="..."
	//    HelpLink title="...") because the section title is genuinely
	//    body content, not chrome - merge into the text stream.
	//    We pull them out into a sidecar string first.
	let attrText = '';
	tpl = tpl.replace(/\btitle\s*=\s*["']([^"']*)["']/gi, (_, val) => {
		attrText += ' ' + val;
		return ''; // drop the attribute itself
	});

	// 4) strip all remaining tags. Self-closing or paired - regex
	//    handles both since we don't care about pairing for text.
	let text = tpl.replace(/<[^>]+>/g, ' ');

	// 5) decode common HTML entities and collapse whitespace
	text = text
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&nbsp;/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();

	return (text + attrText).trim();
}


let _index = null;


/**
 * Build the search index lazily. Cached after first run; the cache is
 * fresh as long as the module hasn't been re-evaluated (which Vite
 * does for HMR when any topic file changes).
 *
 * @returns {Array<{
 *   id: string,
 *   title: string,
 *   tags: string[],
 *   keywords: string[],
 *   bodyText: string,
 * }>}
 */
export function getSearchIndex() {

	if (_index) return _index;

	const out = [];
	const map = getTopicMap();

	for (const topic of Object.values(map)) {
		out.push({
			id:       topic.id,
			title:    topic.title,
			tags:     topic.tags,
			keywords: topic.keywords,
			bodyText: extractBodyText(topic.rawSource),
		});
	}

	_index = out;
	return out;
}


/**
 * Score a topic against a single query. Returns 0 for no match.
 * Higher = better.
 *
 * Weights:
 *   title    full match: 100, contains: 50
 *   tag      contains:   40
 *   keyword  contains:   35
 *   body     contains:   10
 *
 * @param {Object} entry - a search index entry
 * @param {string} q     - lowercased query string
 * @returns {number} score (0 = no match)
 */
function scoreEntry(entry, q) {

	if (!q) return 0;

	let score = 0;
	const lcTitle = entry.title.toLowerCase();

	if (lcTitle === q) score += 100;
	else if (lcTitle.includes(q)) score += 50;

	for (const t of entry.tags) {
		if (t.toLowerCase().includes(q)) {
			score += 40;
			break; // one tag is enough to count
		}
	}

	for (const k of entry.keywords) {
		if (k.toLowerCase().includes(q)) {
			score += 35;
			break;
		}
	}

	if (entry.bodyText.toLowerCase().includes(q))
		score += 10;

	return score;
}


/**
 * Run a query against the help search index. Multi-word queries are
 * AND-ed across tokens (each token must match SOMETHING on the
 * entry - the entry's title, tags, keywords, or body) and the scores
 * are summed.
 *
 * @param {string} query - user input
 * @param {number} [limit=20] - max results
 * @returns {Array<{ topic: Object, score: number }>} sorted, limited
 */
export function searchTopics(query, limit = 20) {

	const q = String(query || '').trim().toLowerCase();
	if (!q) return [];

	const tokens = q.split(/\s+/).filter(Boolean);
	const index = getSearchIndex();

	const scored = [];
	for (const entry of index) {

		let total = 0;
		let allTokensMatched = true;

		for (const tok of tokens) {
			const s = scoreEntry(entry, tok);
			if (s === 0) {
				allTokensMatched = false;
				break;
			}
			total += s;
		}

		if (allTokensMatched && total > 0)
			scored.push({ id: entry.id, title: entry.title, score: total });

	}// next entry

	scored.sort((a, b) => b.score - a.score);
	return scored.slice(0, limit);
}
