/*
	commandLookup.js
	----------------

	Which toy answers a typed chat command, and where two toys want the same
	word. Pure functions (no Vue, no app), shared by the CommandProcessor, the
	command config UI, the plugin registrar and the tests.

	Every command lives in one saved list keyed by `<toySlug>__<key>`. Toys
	add their defaults the first time they're added, and removing a toy does
	NOT delete them (so the user's renames / costs survive re-adding it). That
	means the saved list always contains commands for toys that aren't running.

	The rules:
	  - Only commands of RUNNING toys (in enabledToys) take part. A removed
	    toy can never answer, or block, a command.
	  - Two running toys may still share a word. Then an enabled command beats
	    a disabled one, and otherwise the toy that was added first wins. The
	    others are "shadowed" and listed as a conflict so the UI can say so.
	  - Toys that aren't both running may share a word freely.
*/


/**
 * The toy slug a command belongs to (the part before '__').
 *
 * @param {Object} cmd - a saved command record
 * @returns {string}
 */
export function toySlugOf(cmd) {
	const slug = String((cmd && cmd.slug) || '');
	const i = slug.indexOf('__');
	return i === -1 ? slug : slug.slice(0, i);
}


/**
 * The per-toy key of a command (the part after '__'), e.g. 'joinrace'.
 *
 * @param {Object} cmd
 * @returns {string}
 */
export function commandKeyOf(cmd) {
	const slug = String((cmd && cmd.slug) || '');
	const i = slug.indexOf('__');
	return i === -1 ? slug : slug.slice(i + 2);
}


/**
 * @param {Object} cmd
 * @returns {boolean} true unless explicitly disabled
 */
function isOn(cmd) {
	return cmd.enabled !== false;
}


/**
 * Build the typed-word lookup for the running toys.
 *
 * @param {Object<string, Object>} commands - the saved commands, keyed by slug
 * @param {Array<string>} enabledToySlugs - running toys, in the order they were added
 * @returns {{
 *   map: Object<string, Object>,
 *   conflicts: Object<string, Array<string>>,
 *   bySlug: Object<string, {word: string, active: boolean, winner: string, others: Array<string>}>
 * }}
 *   map       word -> the command that answers it
 *   conflicts word -> slugs of the ENABLED commands sharing it (winner first);
 *             only words with 2+ enabled commands appear
 *   bySlug    every running toy's command -> its standing
 */
export function buildCommandLookup(commands, enabledToySlugs) {

	const order = new Map();
	(enabledToySlugs || []).forEach((s, i) => { if (!order.has(s)) order.set(s, i); });

	// word -> candidate commands of running toys
	const byWord = new Map();
	for (const cmd of Object.values(commands || {})) {
		if (!cmd || typeof cmd.command !== 'string' || !cmd.command || !cmd.slug)
			continue;
		if (!order.has(toySlugOf(cmd)))
			continue;
		let list = byWord.get(cmd.command);
		if (!list) byWord.set(cmd.command, list = []);
		list.push(cmd);
	}

	const map = {};
	const conflicts = {};
	const bySlug = {};

	for (const [word, list] of byWord) {

		// enabled first, then the toy added first; ties (same toy) keep the
		// saved order so the result is stable
		const ranked = list
			.map((cmd, i) => ({ cmd, i }))
			.sort((a, b) =>
				(Number(isOn(b.cmd)) - Number(isOn(a.cmd)))
				|| (order.get(toySlugOf(a.cmd)) - order.get(toySlugOf(b.cmd)))
				|| (a.i - b.i))
			.map((x) => x.cmd);

		const winner = ranked[0];
		map[word] = winner;

		const live = ranked.filter(isOn);
		if (live.length > 1)
			conflicts[word] = live.map((c) => c.slug);

		for (const cmd of ranked) {
			bySlug[cmd.slug] = {
				word,
				active: cmd === winner && isOn(cmd),
				winner: winner.slug,
				// the OTHER enabled commands competing for this word
				others: live.length > 1 ? live.filter((c) => c !== cmd).map((c) => c.slug) : [],
			};
		}
	}

	return { map, conflicts, bySlug };
}


/**
 * The words already taken by running toys, optionally ignoring one toy (so a
 * toy doesn't collide with its own saved commands) and one command.
 *
 * @param {Object<string, Object>} commands
 * @param {Array<string>} enabledToySlugs
 * @param {Object} [opts]
 * @param {string} [opts.exceptToy] - ignore this toy's commands
 * @param {string} [opts.exceptSlug] - ignore this one command
 * @param {string} [opts.includeToy] - also count this toy's commands even if it isn't running
 * @returns {Set<string>}
 */
export function takenCommandWords(commands, enabledToySlugs, { exceptToy = null, exceptSlug = null, includeToy = null } = {}) {
	const running = new Set(enabledToySlugs || []);
	if (includeToy) running.add(includeToy);
	const taken = new Set();
	for (const cmd of Object.values(commands || {})) {
		if (!cmd || typeof cmd.command !== 'string' || !cmd.command)
			continue;
		const toy = toySlugOf(cmd);
		if (!running.has(toy) || toy === exceptToy || cmd.slug === exceptSlug)
			continue;
		taken.add(cmd.command.toLowerCase());
	}
	return taken;
}


/**
 * A free command word: `desired`, or `desired2`, `desired3`, ... Adds the
 * result to `taken`.
 *
 * @param {string} desired
 * @param {Set<string>} taken - lowercased words in use (mutated)
 * @returns {string}
 */
export function pickFreeCommandWord(desired, taken) {
	let name = desired;
	let n = 2;
	while (taken.has(name.toLowerCase()))
		name = `${desired}${n++}`;
	taken.add(name.toLowerCase());
	return name;
}


/**
 * A toy's own commands as { key: { command, enabled, active } } - what its
 * widgets (and plugin iframes) are told so they can show the real word.
 *
 * @param {Object<string, Object>} commands
 * @param {string} toySlug
 * @param {?Object} lookup - from buildCommandLookup (null: toy not running)
 * @returns {Object<string, {command: string, enabled: boolean, active: boolean}>}
 */
export function commandWordsForToy(commands, toySlug, lookup) {
	const out = {};
	for (const cmd of Object.values(commands || {})) {
		if (!cmd || toySlugOf(cmd) !== toySlug || typeof cmd.command !== 'string')
			continue;
		const standing = lookup && lookup.bySlug[cmd.slug];
		out[commandKeyOf(cmd)] = {
			command: cmd.command,
			enabled: isOn(cmd),
			active: !!(standing && standing.active),
		};
	}
	return out;
}


/**
 * The socket key a toy's command words are published on (dashboard ->
 * widgets / plugin iframes). Mirrors the `<slug-kebab>-settings` convention.
 *
 * @param {string} toySlug
 * @returns {string} e.g. 'horse-racing-commands'
 */
export function commandWordsSocketKey(toySlug) {
	return String(toySlug).replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase() + '-commands';
}


/**
 * The words a plugin's commands get when the plugin is added. A command that
 * is already saved keeps its saved word (the user may have renamed it). A new
 * one gets its manifest default unless a RUNNING toy (or an earlier command
 * of the same plugin) already uses it, in which case it gets default2, 3...
 * Toys that aren't running don't count: they can't answer anyway.
 *
 * @param {Array<{key: string, default: string}>} manifestCommands
 * @param {string} pluginSlug
 * @param {Object<string, Object>} saved - the saved commands
 * @param {Array<string>} enabledToySlugs
 * @returns {Object<string, string>} key -> word
 */
export function assignPluginCommandWords(manifestCommands, pluginSlug, saved, enabledToySlugs) {

	const taken = takenCommandWords(saved, enabledToySlugs, { exceptToy: pluginSlug });
	const out = {};
	const list = manifestCommands || [];

	// saved words first, so a new command can't take one of them
	for (const c of list) {
		const rec = saved && saved[`${pluginSlug}__${c.key}`];
		if (rec && typeof rec.command === 'string' && rec.command) {
			out[c.key] = rec.command;
			taken.add(rec.command.toLowerCase());
		}
	}
	for (const c of list) {
		if (!(c.key in out))
			out[c.key] = pickFreeCommandWord(String(c.default || c.key), taken);
	}
	return out;
}
