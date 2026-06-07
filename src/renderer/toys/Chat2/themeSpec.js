/*
	themeSpec.js
	------------

	Parsing + normalization for the Chat2 theming system.

	This is the shared "dynamic settings from JSON" backbone described in the
	chat-theming spec (§5). It turns the various theme payloads we support into
	ONE normalized shape so the rest of the toy (settings page, widget, token
	substitution) never has to care where a theme came from:

	  - ChatToys theme spec v2  (native  -> parseThemeSpec)
	  - ChatToys theme blob v1  (legacy  -> parseThemeSpec, auto-upgraded)
	  - Streamlabs `Fields`     (Mode 3  -> adaptStreamlabsFields)

	A "normalized field" looks like:
	  { key, label, type, value, group, options?, min?, max?, step?, desc? }

	where `type` is one of the input types our existing Settings*Row components
	understand: 'boolean' | 'number' | 'float' | 'text' | 'color' | 'options' |
	'asset'. Anything we can't render is dropped (and reported by the caller).
*/

// the field `type` values our settings rows can actually render
export const SUPPORTED_FIELD_TYPES = new Set([
	'boolean', 'number', 'float', 'text', 'color', 'options', 'asset',
]);

// the empty set of inject slots a theme can fill (keeps render code branch-free)
export const EMPTY_INJECTS = Object.freeze({
	styleInjects: '',
	chatRowInjects: '',
	pfpInjects: '',
	contentsInjects: '',
	userNameInjects: '',
	messageBodyInjects: '',
});


/**
 * Lenient JSON parser that tolerates literal newlines inside string values.
 *
 * Themes are hand-authored (and often contain big multi-line CSS strings), so
 * raw JSON.parse() chokes on the unescaped newlines. This walks the string and
 * escapes newlines that live *inside* quotes before handing it to JSON.parse.
 * (Ported verbatim from the original ChatBoxWidget so v1 blobs keep parsing.)
 *
 * @param {String} jsonString - the raw theme text
 * @returns {Object} the parsed object
 */
export function parseMultilineJSON(jsonString) {

	// normalize tabs to spaces so they don't break inside JSON strings
	jsonString = jsonString.replace(/\t/g, '  ');

	// escape literal newlines that occur inside double-quoted strings
	const fixedString = jsonString.replace(/("(?:[^"\\]|\\.)*")/g, (match) => {
		return match.replace(/\n/g, '\\n');
	});

	return JSON.parse(fixedString);
}


/**
 * Coerce one raw field descriptor into our normalized field shape.
 *
 * Accepts the small spelling variations we see across formats (e.g. `name` vs
 * `label`, `default` vs `value`) and maps loose type aliases onto the types our
 * Settings*Row components render. Returns null for anything unrenderable.
 *
 * @param {Object} raw - a single field descriptor from a theme/manifest
 * @param {Number} index - position in the list (used to synthesize a key)
 * @returns {?Object} normalized field, or null if it can't be rendered
 */
export function normalizeField(raw, index = 0) {

	if (!raw || typeof raw !== 'object')
		return null;

	// key is required for value storage + token substitution
	const key = raw.key || raw.name || raw.id || `field_${index}`;

	// map loose type aliases onto our supported render types
	const type = mapFieldType(raw.type);
	if (!type)
		return null;

	// build the normalized descriptor
	const field = {
		key,
		label: raw.label || raw.title || raw.name || key,
		type,
		value: raw.value !== undefined ? raw.value : raw.default,
		group: raw.group || raw.groupLabel || '',
		desc: raw.desc || raw.description || '',
	};

	// options can arrive as an array of {value,name} OR a {value:name} map
	if (type === 'options')
		field.options = normalizeOptions(raw.options);

	// numeric extras
	if (type === 'number' || type === 'float') {
		if (raw.min !== undefined) field.min = Number(raw.min);
		if (raw.max !== undefined) field.max = Number(raw.max);
		if (raw.step !== undefined) field.step = Number(raw.step);
	}

	// asset extras (kind filter for the picker)
	if (type === 'asset')
		field.accept = raw.accept || raw.kind || null;

	return field;
}


/**
 * Map a loose theme/manifest field type string onto one of our render types.
 *
 * @param {String} t - the raw type (may be a StreamElements/Streamlabs alias)
 * @returns {?String} a SUPPORTED_FIELD_TYPES value, or null if unsupported
 */
export function mapFieldType(t) {

	switch (String(t || '').toLowerCase()) {

		case 'boolean':
		case 'checkbox':
		case 'toggle':
			return 'boolean';

		case 'number':
		case 'slider':
			return 'number';

		case 'float':
			return 'float';

		case 'color':
		case 'colorpicker':
		case 'colour':
			return 'color';

		case 'options':
		case 'dropdown':
		case 'select':
			return 'options';

		case 'asset':
		case 'image':
			return 'asset';

		case 'text':
		case 'string':
		case 'textfield':
		case 'textarea':
		case 'googlefont':
		case 'font':
			return 'text';

		// 'button', 'hidden', and anything else we can't meaningfully edit
		default:
			return null;
	}
}


/**
 * Normalize an options collection into an array of { value, name }.
 *
 * Supports both our native array form and the StreamElements/Streamlabs
 * `{ value: label }` map form.
 *
 * @param {Array|Object} options - the raw options
 * @returns {Array<Object>} array of { value, name }
 */
export function normalizeOptions(options) {

	if (Array.isArray(options)) {
		return options.map((o) => {
			if (o && typeof o === 'object')
				return { value: o.value, name: o.name || o.label || String(o.value) };
			return { value: o, name: String(o) };
		});
	}

	if (options && typeof options === 'object') {
		return Object.entries(options).map(([value, name]) => ({
			value,
			name: String(name),
		}));
	}

	return [];
}


/**
 * Parse a ChatToys theme string into the normalized theme object.
 *
 * Handles BOTH formats transparently:
 *   - v2: { name, author, version, fields:[…], injects:{…}, js }
 *   - v1: a bare injects blob like { styleInjects, messageBodyInjects, … }
 *         (auto-wrapped as v2 with empty fields/js)
 *
 * Never throws on bad input - returns a safe empty theme so the widget can keep
 * rendering. Inspect the returned `.error` to surface parse problems in the UI.
 *
 * @param {String} rawString - the raw textarea contents
 * @returns {Object} { name, author, version, fields, injects, js, error }
 */
export function parseThemeSpec(rawString) {

	// start from a fully-populated safe default
	const theme = {
		name: '',
		author: '',
		version: '',
		fields: [],
		injects: { ...EMPTY_INJECTS },
		js: '',
		error: null,
	};

	// empty input -> empty theme (not an error)
	if (!rawString || !String(rawString).trim())
		return theme;

	// parse leniently; capture any failure for the UI
	let parsed;
	try {
		parsed = parseMultilineJSON(rawString);
	} catch (e) {
		theme.error = e.message || String(e);
		return theme;
	}

	if (!parsed || typeof parsed !== 'object')
		return theme;

	// v2 themes carry an explicit `injects` object; v1 blobs are themselves
	// the injects map (styleInjects/messageBodyInjects/… at the top level).
	const isV2 = parsed.injects && typeof parsed.injects === 'object';
	const injectSource = isV2 ? parsed.injects : parsed;

	// copy only known inject slots so a theme can't smuggle extra keys through
	for (const slot of Object.keys(EMPTY_INJECTS)) {
		if (typeof injectSource[slot] === 'string')
			theme.injects[slot] = injectSource[slot];
	}

	// v2 metadata + fields + js (all optional)
	if (isV2) {
		theme.name = parsed.name || '';
		theme.author = parsed.author || '';
		theme.version = parsed.version || '';
		theme.js = typeof parsed.js === 'string' ? parsed.js : '';
		theme.fields = normalizeFields(parsed.fields);
	}

	return theme;
}


/**
 * Normalize an array of raw field descriptors, dropping unrenderable ones.
 *
 * @param {Array} rawFields - the theme's declared fields
 * @returns {Array<Object>} normalized fields
 */
export function normalizeFields(rawFields) {

	if (!Array.isArray(rawFields))
		return [];

	const out = [];
	rawFields.forEach((raw, i) => {
		const f = normalizeField(raw, i);
		if (f) out.push(f);
	});
	return out;
}


/**
 * Adapt a Streamlabs (or StreamElements) `Fields` object to normalized fields.
 *
 * Both platforms key fields by name in an object:
 *   { fieldName: { type, label, value, group, options? }, … }
 *
 * This is the Mode 3 entry point for the §5 backbone. (Mode 3's render harness
 * isn't built yet, but the field adapter is shared, so it lives here now.)
 *
 * @param {Object} fields - the platform `Fields`/`fields` object
 * @returns {Array<Object>} normalized fields
 */
export function adaptStreamlabsFields(fields) {

	if (!fields || typeof fields !== 'object')
		return [];

	const out = [];
	let i = 0;
	for (const [key, raw] of Object.entries(fields)) {
		const f = normalizeField({ ...raw, key }, i++);
		if (f) out.push(f);
	}
	return out;
}


/**
 * Build a { key: value } map of default values from normalized fields.
 *
 * @param {Array<Object>} fields - normalized fields
 * @returns {Object} default value map
 */
export function defaultFieldValues(fields) {

	const values = {};
	if (!Array.isArray(fields))
		return values;

	for (const f of fields) {
		if (f && f.key !== undefined)
			values[f.key] = f.value;
	}
	return values;
}


/**
 * Substitute `{fieldKey}` tokens in a string with their current values.
 *
 * Used for CSS/HTML token interpolation in both our v2 themes and (later) the
 * Streamlabs/StreamElements `{fieldName}` convention. Unknown tokens are left
 * untouched so legitimate CSS braces aren't mangled by a missing value.
 *
 * @param {String} str - the source string (CSS/HTML/etc.)
 * @param {Object} values - a { key: value } map
 * @returns {String} the interpolated string
 */
export function substituteTokens(str, values) {

	if (!str || !values)
		return str || '';

	return String(str).replace(/\{([a-zA-Z0-9_\-.]+)\}/g, (match, key) => {
		return Object.prototype.hasOwnProperty.call(values, key)
			? String(values[key])
			: match;
	});
}
