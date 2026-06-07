/*
	emoteHtml.js
	------------

	Render a ChatToys message (text + emojis[]) to an HTML string.

	The whole app encodes emotes uniformly: the message text carries &code;
	placeholders and the message carries an `emojis` array of { code, url }.
	This is true for Twitch emotes, BTTV emotes, YouTube custom/member emojis
	(see ChatProcessor._parseTwitchEmojis / _parseBTTVEmojis / _parseYouTube),
	while plain unicode emoji are left as literal characters in the text.

	ParsedMessage.vue renders that model to DOM for the native (simple/custom)
	chat. Compatibility mode (Mode 3) renders inside a Streamlabs theme via token
	substitution, which needs an HTML *string* - so this mirrors ParsedMessage's
	tokenizer and emits the same result as markup. Keeping both off the one
	convention is what makes every emote type work in every mode.
*/

/**
 * Escape text for safe HTML insertion (preserves unicode emoji characters).
 *
 * @param {String} s
 * @returns {String}
 */
export function escapeHtml(s) {
	return String(s == null ? '' : s)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}


/**
 * Render message text + emojis to an HTML string. &code; placeholders that map
 * to a known emoji become <img> tags; everything else is escaped text, and
 * newlines become <br>. Inline sizing keeps emotes aligned regardless of the
 * host theme's CSS.
 *
 * @param {String} text - the message text with &code; placeholders
 * @param {Array<{code:String,url:String}>} emojis - the message's emoji list
 * @returns {String} HTML
 */
export function renderEmotesToHtml(text, emojis) {

	if (!text) return '';

	// O(1) code -> url lookup
	const map = new Map();
	(emojis || []).forEach((e) => { if (e && e.code) map.set(e.code, e.url); });

	// split on &code; tokens (same pattern ParsedMessage uses)
	const parts = String(text).split(/(&[a-zA-Z0-9_\-:]+;)/g);

	let html = '';
	for (const part of parts) {

		if (part.startsWith('&') && part.endsWith(';')) {
			const code = part.slice(1, -1);
			const url = map.get(code);
			if (url) {
				html += '<img class="ct-emote" style="height:1.4em;width:auto;margin:0 2px;vertical-align:middle;display:inline-block;" src="'
					+ escapeHtml(url) + '" alt="' + escapeHtml(code) + '">';
				continue;
			}
			// unknown token: treat as literal text (escaped)
			html += escapeHtml(part);
			continue;
		}

		// plain text: escape, convert newlines to <br>
		html += escapeHtml(part).replace(/\n/g, '<br>');
	}

	return html;
}
