/*
	markdown.js
	-----------

	Minimal, dependency-free Markdown -> safe HTML, for plugin long-descriptions.
	Supports: headings (#..######), horizontal rules, unordered (-,*) and ordered
	(1.) lists, blockquotes, paragraphs with soft line breaks, and inline
	**bold**, *italic* / _italic_, `code`, and [text](http(s) url).

	Safety: the source is HTML-escaped BEFORE any markdown transform, and the
	result is run through DOMPurify with a tight tag/attr allow-list, so even
	untrusted markdown can't inject markup. Newlines are first-class (single
	newline -> <br>, blank line -> new paragraph), which is the main thing
	plugin authors need.
*/

import DOMPurify from 'dompurify';


/**
 * Escape the HTML-significant characters. Markdown punctuation (* _ ` [ ] etc.)
 * is intentionally left intact so the transforms below can act on it.
 *
 * @param {string} s
 * @returns {string}
 */
function escapeHtml(s) {
	return String(s)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;');
}


/**
 * Apply inline formatting to a single (already HTML-escaped) line.
 *
 * @param {string} text
 * @returns {string}
 */
function inline(text) {
	let t = text;
	t = t.replace(/`([^`]+)`/g, (m, c) => `<code>${c}</code>`);
	t = t.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
		(m, label, url) => `<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`);
	t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
	t = t.replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>');
	t = t.replace(/(^|[^_])_([^_]+)_/g, '$1<em>$2</em>');
	return t;
}


/**
 * Render a markdown string to a sanitized HTML string.
 *
 * @param {string} md
 * @returns {string} safe HTML
 */
export function renderMarkdown(md) {

	if (!md)
		return '';

	const lines = escapeHtml(String(md).replace(/\r\n/g, '\n')).split('\n');
	const html = [];
	let i = 0;
	let listType = null; // 'ul' | 'ol' | null

	const closeList = () => {
		if (listType) { html.push(`</${listType}>`); listType = null; }
	};

	const isSpecial = (s) =>
		/^(#{1,6})\s+/.test(s) || /^[-*]\s+/.test(s) || /^\d+\.\s+/.test(s) ||
		/^>\s?/.test(s) || /^(-{3,}|\*{3,}|_{3,})$/.test(s) || s === '';

	while (i < lines.length) {

		const trimmed = lines[i].trim();

		// blank line: ends the current block
		if (trimmed === '') { closeList(); i++; continue; }

		// horizontal rule
		if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) { closeList(); html.push('<hr>'); i++; continue; }

		// heading
		const h = /^(#{1,6})\s+(.*)$/.exec(trimmed);
		if (h) { closeList(); html.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`); i++; continue; }

		// blockquote
		const bq = /^>\s?(.*)$/.exec(trimmed);
		if (bq) { closeList(); html.push(`<blockquote>${inline(bq[1])}</blockquote>`); i++; continue; }

		// unordered list item
		const ul = /^[-*]\s+(.*)$/.exec(trimmed);
		if (ul) {
			if (listType !== 'ul') { closeList(); html.push('<ul>'); listType = 'ul'; }
			html.push(`<li>${inline(ul[1])}</li>`);
			i++; continue;
		}

		// ordered list item
		const ol = /^\d+\.\s+(.*)$/.exec(trimmed);
		if (ol) {
			if (listType !== 'ol') { closeList(); html.push('<ol>'); listType = 'ol'; }
			html.push(`<li>${inline(ol[1])}</li>`);
			i++; continue;
		}

		// paragraph: gather consecutive plain lines, join with soft breaks
		closeList();
		const para = [];
		while (i < lines.length && !isSpecial(lines[i].trim())) {
			para.push(inline(lines[i].trim()));
			i++;
		}
		html.push(`<p>${para.join('<br>')}</p>`);
	}

	closeList();

	return DOMPurify.sanitize(html.join('\n'), {
		ALLOWED_TAGS: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'br', 'hr', 'ul', 'ol', 'li', 'strong', 'em', 'code', 'blockquote', 'a'],
		ALLOWED_ATTR: ['href', 'target', 'rel'],
	});
}
