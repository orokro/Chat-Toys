/*
	chatThemeHarness.js
	-------------------

	The Streamlabs-compatibility chat harness (Mode 3).

	A Streamlabs chat theme is just markup + CSS + a "Fields" settings blob, plus
	(usually obfuscated) JS that clones a template per message. Per the chat-
	theming spec we DELIBERATELY do not run the theme's own JS - instead this
	harness owns the message loop the same way Streamlabs' platform does:

	  1. read the theme's `#chatlist_item` <script type="text/template"> markup,
	  2. substitute {field} tokens (from the user's Fields values) into the CSS
	     and the template once,
	  3. for each incoming chat message, clone the template, substitute the
	     per-message tokens ({from}, {message}, {messageId}), optionally layer on
	     OUR features (avatar stub, channel-points-after-name), and append it to
	     `#log`, enforcing the message limit.

	This file is served into the compat iframe as a plain browser script. It is
	written UMD-style so the pure helpers can also be unit-tested under Node/jsdom
	without a real iframe or parent window.

	Runtime protocol (parent <-> iframe, via postMessage):
	  parent -> iframe:
	    { type: 'ct-init',  css, template, options }   // one-time setup
	    { type: 'ct-fields', fields }                  // field values (re-render CSS)
	    { type: 'ct-options', options }                // feature toggles changed
	    { type: 'ct-chat',  messages: [ msg, ... ] }   // append these messages
	    { type: 'ct-clear' }                           // wipe the log
	  where msg = { id, from, message, color?, points?, pfpUrl?, badges?, system? }
*/

(function (root) {
	'use strict';

	// ---- pure helpers (unit-testable) -------------------------------------

	/**
	 * Substitute {token} placeholders in a string from a values map. Unknown
	 * tokens are left intact so legitimate braces survive.
	 *
	 * @param {String} str - source string
	 * @param {Object} values - { token: value }
	 * @returns {String}
	 */
	function substitute(str, values) {
		if (!str) return '';
		if (!values) return String(str);
		return String(str).replace(/\{([a-zA-Z0-9_\-.]+)\}/g, function (m, key) {
			return Object.prototype.hasOwnProperty.call(values, key)
				? String(values[key])
				: m;
		});
	}

	/**
	 * Escape a string for safe insertion as HTML text/attribute content.
	 *
	 * @param {String} s
	 * @returns {String}
	 */
	function escapeHtml(s) {
		return String(s == null ? '' : s)
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&#39;');
	}

	/**
	 * Pull the Streamlabs chat-item template markup out of a theme HTML string.
	 * Streamlabs themes carry it as <script type="text/template" id="chatlist_item">.
	 * Falls back to a minimal row if the theme doesn't provide one.
	 *
	 * @param {String} html - the theme's HTML
	 * @returns {String} the template markup
	 */
	function extractTemplate(html) {
		if (!html) return defaultTemplate();
		var re = /<script[^>]*id=["']chatlist_item["'][^>]*>([\s\S]*?)<\/script>/i;
		var m = re.exec(html);
		return (m && m[1] != null) ? m[1] : defaultTemplate();
	}

	/**
	 * Pull the `#log` container markup (minus the template script) out of a
	 * theme HTML string, so we can place it as the live message container.
	 *
	 * @param {String} html - the theme's HTML
	 * @returns {String} markup for the log container (may be empty)
	 */
	function extractLog(html) {
		if (!html) return '<div id="log" class="sl__chat__layout"></div>';
		// drop the template script so it isn't rendered as content
		var stripped = html.replace(/<script[^>]*id=["']chatlist_item["'][^>]*>[\s\S]*?<\/script>/i, '');
		return stripped;
	}

	/**
	 * A minimal fallback chat-item template for themes that omit one.
	 *
	 * @returns {String}
	 */
	function defaultTemplate() {
		return '<div data-from="{from}" data-id="{messageId}">'
			+ '<span class="name">{from}</span>: <span class="message">{message}</span>'
			+ '</div>';
	}

	/**
	 * Build the per-message token map, applying OUR feature overlays:
	 *   - points appended after the display name (we can't restyle, only append)
	 *   - message text escaped unless it already carries emote/markup html
	 *
	 * @param {Object} msg - { id, from, message, points, ... }
	 * @param {Object} options - { showPoints, pointsLabel }
	 * @returns {Object} token map for substitution
	 */
	function messageTokens(msg, options) {
		options = options || {};
		// {from} must stay plain text: it is used in HTML attributes
		// (data-from="{from}") as well as element content, so injecting markup
		// here would corrupt the attribute. Points are layered on via the DOM
		// after the row is built (see appendMessage).
		var from = escapeHtml(msg.from != null ? msg.from : '');
		// message: prefer pre-rendered emote HTML if provided, else escape text
		var message = (msg.html != null) ? String(msg.html) : escapeHtml(msg.message != null ? msg.message : '');
		return {
			from: from,
			message: message,
			messageId: escapeHtml(msg.id != null ? msg.id : ''),
			amount: escapeHtml(msg.amount != null ? msg.amount : ''),
		};
	}

	/**
	 * Render one message's HTML from the (field-substituted) template.
	 *
	 * @param {String} template - field-substituted template markup
	 * @param {Object} msg - the message
	 * @param {Object} options - feature options
	 * @returns {String} the row HTML
	 */
	function renderMessageHtml(template, msg, options) {
		return substitute(template, messageTokens(msg, options));
	}


	// ---- DOM runtime (browser only) ---------------------------------------

	/**
	 * Create a live harness bound to a document. Encapsulates the field-
	 * substituted template + css, the #log element, and the append/limit loop.
	 *
	 * @param {Document} doc - the iframe document
	 * @returns {Object} harness API
	 */
	function createHarness(doc) {

		var state = {
			rawCss: '',
			rawTemplate: '',
			template: '',          // field-substituted template
			fields: {},
			options: { limit: 50, showAvatar: false, showPoints: false, pointsLabel: '', stubPfp: '' },
			seen: {},              // id -> true (de-dupe)
		};

		/**
		 * Ensure a <style id="ct-theme-style"> exists and write css into it.
		 * @param {String} css
		 */
		function writeCss(css) {
			var el = doc.getElementById('ct-theme-style');
			if (!el) {
				el = doc.createElement('style');
				el.id = 'ct-theme-style';
				(doc.head || doc.documentElement).appendChild(el);
			}
			el.textContent = css;
		}

		/** Recompute css + template from raw sources + current field values. */
		function applyFields() {
			state.template = substitute(state.rawTemplate, state.fields);
			writeCss(substitute(state.rawCss, state.fields));
		}

		/** @returns {?Element} the #log container */
		function logEl() {
			return doc.getElementById('log');
		}

		/**
		 * Initialize with the theme's css + template markup + options.
		 * @param {Object} cfg - { css, template, options }
		 */
		function init(cfg) {
			cfg = cfg || {};
			state.rawCss = cfg.css || '';
			state.rawTemplate = cfg.template || extractTemplate(cfg.html || '');
			if (cfg.options) setOptions(cfg.options);
			if (cfg.fields) state.fields = cfg.fields || {};
			applyFields();
		}

		/** @param {Object} fields - field values to merge over the current set */
		function setFields(fields) {
			state.fields = Object.assign({}, state.fields, fields || {});
			applyFields();
		}

		/** @param {Object} options - merge feature options */
		function setOptions(options) {
			for (var k in (options || {})) {
				if (Object.prototype.hasOwnProperty.call(options, k))
					state.options[k] = options[k];
			}
		}

		/**
		 * Append one message (clone template, fill tokens, overlay features).
		 * @param {Object} msg
		 * @returns {?Element} the appended row, or null
		 */
		function appendMessage(msg) {
			if (!msg) return null;
			var log = logEl();
			if (!log) return null;

			// de-dupe by id
			var id = (msg.id != null) ? String(msg.id) : '';
			if (id && state.seen[id]) return null;
			if (id) state.seen[id] = true;

			// render row html and parse into an element
			var html = renderMessageHtml(state.template, msg, state.options);
			var holder = doc.createElement('div');
			holder.innerHTML = html.trim();
			var row = holder.firstElementChild || holder;

			// feature: avatar stub - fill the first empty icon container if we
			// have a pfp (or a stub) and avatars are enabled. Constrain it to the
			// host box so themes whose icon slot is small don't render a huge
			// natural-size image.
			if (state.options.showAvatar) {
				var iconHost = row.querySelector('.iconcont, .icon, .avatar, .pfp');
				if (iconHost && !iconHost.querySelector('img')) {
					var img = doc.createElement('img');
					img.className = 'ct-avatar';
					img.src = msg.pfpUrl || state.options.stubPfp || '';
					img.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:inherit;display:block;';
					iconHost.appendChild(img);
				}
			}

			// feature: channel points appended after the name (text/DOM, never
			// injected into the {from} token - that would break attributes).
			if (state.options.showPoints && msg.points != null && msg.points !== '') {
				var nameEl = row.querySelector('.name, .username, .displayname, .nick');
				var pts = doc.createElement('span');
				pts.className = 'ct-points';
				pts.textContent = ' ' + (state.options.pointsLabel || '') + msg.points;
				(nameEl || row).appendChild(pts);
			}

			log.appendChild(row);
			enforceLimit();
			return row;
		}

		/** Trim the oldest rows beyond the configured limit. */
		function enforceLimit() {
			var log = logEl();
			if (!log) return;
			var limit = state.options.limit || 50;
			while (log.children.length > limit)
				log.removeChild(log.firstElementChild);
		}

		/** Remove all rows + reset de-dupe. */
		function clear() {
			var log = logEl();
			if (log) while (log.firstChild) log.removeChild(log.firstChild);
			state.seen = {};
		}

		return {
			state: state,
			init: init,
			setFields: setFields,
			setOptions: setOptions,
			appendMessage: appendMessage,
			clear: clear,
			applyFields: applyFields,
		};
	}


	/**
	 * Wire a harness to the parent window via postMessage + provide a demo mode
	 * (so the served page renders sample messages when opened directly with
	 * ?demo=1, making the foundation testable without the app).
	 *
	 * @param {Window} win - the iframe window
	 * @returns {Object} the harness
	 */
	function start(win) {
		win = win || root;
		var doc = win.document;
		var harness = createHarness(doc);

		win.addEventListener('message', function (ev) {
			var d = ev.data || {};
			switch (d.type) {
				case 'ct-init': harness.init(d); break;
				case 'ct-fields': harness.setFields(d.fields); break;
				case 'ct-options': harness.setOptions(d.options); break;
				case 'ct-chat':
					(d.messages || []).forEach(function (m) { harness.appendMessage(m); });
					break;
				case 'ct-clear': harness.clear(); break;
				default: break;
			}
		});

		// announce readiness to the parent (if embedded)
		try { if (win.parent && win.parent !== win) win.parent.postMessage({ type: 'ct-harness-ready' }, '*'); }
		catch (e) { /* noop */ }

		// self-init from the inlined theme payload (the served page sets
		// window.__CT_THEME); the parent then streams fields/options/chat.
		try {
			if (win.__CT_THEME) {
				var th = win.__CT_THEME;
				harness.init({
					css: th.css || '',
					template: th.template || extractTemplate((doc.body && doc.body.innerHTML) || ''),
					fields: th.fields || {},
					options: th.options || {},
				});
			}
		} catch (e) { /* noop */ }

		// demo mode for standalone testing (just streams sample messages)
		try {
			var q = (win.location && win.location.search) || '';
			if (/[?&]demo=1/.test(q)) startDemo(harness, win);
		} catch (e) { /* noop */ }

		win.ChatThemeHarnessInstance = harness;
		return harness;
	}

	/**
	 * Drive a harness with sample messages for standalone preview.
	 *
	 * @param {Object} harness
	 * @param {Window} win
	 */
	function startDemo(harness, win) {
		// the page should already carry the theme css+template inline as
		// window.__CT_THEME; fall back to whatever is in the DOM.
		// the page already self-inits from __CT_THEME; just enable demo-
		// friendly feature overlays and stream sample messages.
		harness.setOptions({ limit: 12, showAvatar: true, showPoints: true, pointsLabel: '₱ ' });
		var names = ['Dude', 'DemoGirl', 'Buddy4Real', 'gOOber', 'sn@rk'];
		var msgs = ['Hi hi', 'this theme rules', 'pog', 'true', 'no u', 'GG'];
		var n = 0;
		win.setInterval(function () {
			n++;
			harness.appendMessage({
				id: 'demo-' + n,
				from: names[n % names.length],
				message: msgs[n % msgs.length],
				points: (n * 100),
				pfpUrl: '',
			});
		}, 1200);
	}


	// ---- export (UMD) -----------------------------------------------------

	var api = {
		substitute: substitute,
		escapeHtml: escapeHtml,
		extractTemplate: extractTemplate,
		extractLog: extractLog,
		defaultTemplate: defaultTemplate,
		messageTokens: messageTokens,
		renderMessageHtml: renderMessageHtml,
		createHarness: createHarness,
		start: start,
	};

	if (typeof module !== 'undefined' && module.exports) module.exports = api;
	root.ChatThemeHarness = api;

	// auto-start when loaded in a real iframe document (not under Node test)
	if (typeof window !== 'undefined' && window.document && !window.__CT_NO_AUTOSTART)
		start(window);

})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
