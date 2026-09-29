/*
	danceCrew.js
	------------
	Plans one !dance: which dance(s), where the crew stands on the floor and
	when each dancer is tossed in, starts dancing and hops off. Pure logic
	(no DOM, no Vue) so it runs in the toy and in node tests.

	Timeline of one dancer, in seconds after the command:
		[delay, delay + TOSS_IN)          tossed in from below the screen
		[.., danceStart)                  landed, bobbing (waiting for the crew)
		[danceStart, danceStart + danceSecs)   dancing (whole loops only)
		[.., exitAt)                      a beat of rest
		[exitAt, exitAt + TOSS_OUT)       hops off, down past the bottom edge
*/

export const TOSS_IN = 0.9;
export const TOSS_OUT = 0.9;
export const STAGGER = 0.18;   // between dancers being tossed in
export const SETTLE = 0.3;     // after the last one lands, before the music starts
export const EXIT_STAGGER = 0.12;

// dancer width as a fraction of its height (arms out, spacing included)
const WIDTH_PER_HEIGHT = 0.62;

const norm = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]/g, '');


/**
 * Find a dance named in the chat text ("!dance 😎 floss", "... the twist",
 * "gangnam style"), among the allowed ones.
 *
 * @param {string} text
 * @param {Object} meta - danceMeta.json
 * @param {string[]} allowed - ids
 * @returns {?string} dance id
 */
export function matchDance(text, meta, allowed) {
	const words = String(text || '').toLowerCase().split(/[\s,.!?]+/).map(norm).filter(Boolean);
	if (!words.length) return null;
	const names = new Map();
	for (const id of allowed) {
		const d = meta.dances[id];
		if (!d) continue;
		for (const n of [id, d.name, String(d.name).replace(/^the\s+/i, ''), ...(d.aliases || [])])
			names.set(norm(n), id);
	}
	for (let len = 3; len >= 1; len--) {
		for (let i = 0; i + len <= words.length; i++) {
			const id = names.get(words.slice(i, i + len).join(''));
			if (id) return id;
		}
	}
	return null;
}


/**
 * @param {Object} o
 * @param {Array} o.emojis - one dancer per emoji (already capped)
 * @param {Object} o.meta - danceMeta.json ({ order, dances: { id: { name, duration } } })
 * @param {string[]} o.allowed - dance ids that may be picked
 * @param {Array<{left:number, right:number, dances:string[]}>} [o.active] - crews still on screen (x in %)
 * @param {'same'|'mixed'} [o.sync] - same dance in sync for the crew, or one each
 * @param {number} [o.danceSeconds] - roughly how long to dance (rounded to whole loops)
 * @param {number} [o.height] - dancer height as a fraction of the widget height
 * @param {number} [o.aspect] - widget width / height
 * @param {?string} [o.request] - a dance id asked for by name
 * @param {Function} [o.rng]
 * @returns {{error: string} | {crew: {left:number, right:number, dances:string[], endsAt:number}, dancers: Array}}
 */
export function planCrew(o) {
	const rng = o.rng || Math.random;
	const pool = (o.allowed || []).filter((id) => o.meta.dances[id]);
	if (!pool.length) return { error: 'No dances are turned on' };
	const n = o.emojis.length;
	if (!n) return { error: 'No emoji to dance' };

	const active = o.active || [];
	const busy = new Set(active.flatMap((c) => c.dances || []));
	const pick = (avoid) => {
		const fresh = pool.filter((id) => !avoid.has(id));
		const from = fresh.length ? fresh : pool;
		return from[Math.floor(rng() * from.length) % from.length];
	};

	// dances
	const dances = [];
	if (o.request && pool.includes(o.request)) {
		for (let i = 0; i < n; i++) dances.push(o.request);
	} else if ((o.sync || 'same') === 'same') {
		const d = pick(busy);
		for (let i = 0; i < n; i++) dances.push(d);
	} else {
		const used = new Set(busy);
		for (let i = 0; i < n; i++) {
			const d = pick(used);
			used.add(d);
			dances.push(d);
		}
	}

	// room on the floor, in % of the widget width
	const height = o.height > 0 ? o.height : 0.35;
	const aspect = o.aspect > 0 ? o.aspect : 16 / 9;
	let spacing = (WIDTH_PER_HEIGHT * height / aspect) * 100;
	if (spacing * n > 96) spacing = 96 / n;
	const width = spacing * n;
	const lo = width / 2 + 2, hi = 100 - width / 2 - 2;
	let center = 50;
	if (hi > lo) {
		let best = null;
		for (let k = 0; k < 24; k++) {
			const c = lo + (hi - lo) * (k < 21 ? k / 20 : rng());
			const l = c - width / 2, r = c + width / 2;
			let overlap = 0;
			for (const a of active) overlap += Math.max(0, Math.min(r, a.right) - Math.max(l, a.left));
			// prefer less overlap, then a little randomness
			const score = overlap + rng() * 0.5;
			if (!best || score < best.score) best = { score, c };
		}
		center = best.c;
	}

	// timing
	const sync = (o.sync || 'same') === 'same' || !!o.request;
	const secs = o.danceSeconds > 0 ? o.danceSeconds : 8;
	const lastLanding = (n - 1) * STAGGER + TOSS_IN;
	const crewFlip = rng() < 0.5;
	const order = Array.from({ length: n }, (_, i) => i);
	// toss them in from the middle out, so the crew fills in symmetrically
	order.sort((a, b) => Math.abs(a - (n - 1) / 2) - Math.abs(b - (n - 1) / 2));

	let endsAt = 0;
	const dancers = [];
	for (let i = 0; i < n; i++) {
		const rank = order.indexOf(i);
		const dance = dances[i];
		const clip = o.meta.dances[dance].duration;
		const loops = Math.max(1, Math.round(secs / clip));
		const delay = rank * STAGGER;
		const danceStart = sync ? lastLanding + SETTLE : delay + TOSS_IN + SETTLE;
		const danceSecs = loops * clip;
		const exitAt = danceStart + danceSecs + 0.25 + rank * EXIT_STAGGER;
		const duration = exitAt + TOSS_OUT;
		endsAt = Math.max(endsAt, duration);
		dancers.push({
			emoji: o.emojis[i],
			dance,
			x: center - width / 2 + spacing * (i + 0.5),
			flip: sync ? crewFlip : rng() < 0.5,
			delay, danceStart, danceSecs, exitAt, duration,
		});
	}

	return { crew: { left: center - width / 2, right: center + width / 2, dances: Array.from(new Set(dances)), endsAt }, dancers };
}
