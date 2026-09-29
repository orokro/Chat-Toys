/*
	danceDraw.js
	------------
	Plays and draws the stick-figure dance loops in dances.json (built by
	scripts/dance/build_dances.py). Plain functions, no Vue, so the widget,
	the preview page and tests share them.

	dances.json:
		{ fps, scale, joints: [18 names], depth: [6 part names], order: [ids],
		  dances: { id: { name, source, frames, data: [ints] } } }

	Each frame in `data` is 18 joints (x, y) then 6 depth values, all ints
	in 1/scale units. Units: the floor is y = 0 and a standing dancer is ~100
	tall (head base at 86), x = 0 is the dancer's spot, y up. Depth: bigger =
	nearer the viewer.
*/

export const JOINTS = [
	'pelvis', 'chest', 'neck', 'head',
	'lShoulder', 'lElbow', 'lWrist', 'rShoulder', 'rElbow', 'rWrist',
	'lHip', 'lKnee', 'lAnkle', 'lToe', 'rHip', 'rKnee', 'rAnkle', 'rToe',
];
export const J = Object.fromEntries(JOINTS.map((n, i) => [n, i]));
export const DEPTH = ['lArm', 'rArm', 'lLeg', 'rLeg', 'torso', 'head'];
const NJ = JOINTS.length;
const STRIDE = NJ * 2 + DEPTH.length;

// looks (units: dancer ~100 tall)
export const LOOK = {
	limb: 7,          // arm / leg thickness
	torso: 12,        // body thickness
	head: 26,         // emoji head size
	headLift: 9,      // emoji centre above the head joint, along the neck
	shoe: '#26262b',
};


/**
 * Unpack one dance from the JSON document.
 *
 * @param {Object} doc - parsed dances.json
 * @param {string} id
 * @returns {?{id, name, fps, frames, duration, data: Float32Array}}
 */
export function decodeDance(doc, id) {
	const d = doc && doc.dances && doc.dances[id];
	if (!d || !Array.isArray(d.data) || d.frames < 2) return null;
	const inv = 1 / (doc.scale || 10);
	const data = new Float32Array(d.data.length);
	for (let i = 0; i < data.length; i++) data[i] = d.data[i] * inv;
	const fps = doc.fps || 15;
	return { id, name: d.name, fps, frames: d.frames, duration: d.frames / fps, data };
}


/**
 * The pose at time t (seconds, loops), linearly blended between frames.
 *
 * @param {Object} dance - from decodeDance
 * @param {number} t
 * @param {Float32Array} [out] - STRIDE floats, reused if given
 * @returns {Float32Array}
 */
export function samplePose(dance, t, out) {
	out = out || new Float32Array(STRIDE);
	const n = dance.frames;
	let f = (t * dance.fps) % n;
	if (f < 0) f += n;
	const i0 = Math.floor(f);
	const i1 = (i0 + 1) % n;
	const w = f - i0;
	const a = i0 * STRIDE, b = i1 * STRIDE, d = dance.data;
	for (let k = 0; k < STRIDE; k++)
		out[k] = d[a + k] + (d[b + k] - d[a + k]) * w;
	return out;
}


// parts: [depth index, color key, joint chain]
const PARTS = {
	lLeg: [2, 'pants', ['pelvis', 'lHip', 'lKnee', 'lAnkle'], ['lAnkle', 'lToe']],
	rLeg: [3, 'pants', ['pelvis', 'rHip', 'rKnee', 'rAnkle'], ['rAnkle', 'rToe']],
	lArm: [0, 'shirt', ['lShoulder', 'lElbow', 'lWrist']],
	rArm: [1, 'shirt', ['rShoulder', 'rElbow', 'rWrist']],
};


/**
 * Draw one dancer.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {Float32Array} pose - from samplePose
 * @param {Object} o
 * @param {number} o.x - screen x of the dancer's spot
 * @param {number} o.y - screen y of the floor under the dancer
 * @param {number} o.scale - px per unit (dancer height / 100)
 * @param {boolean} [o.flip] - mirror left/right
 * @param {string} o.shirt - CSS color (torso + arms)
 * @param {string} o.pants - CSS color (legs)
 * @param {number} [o.outline] - outline width in px (0 = none)
 * @param {number} [o.squash] - 0..1 landing squash
 * @param {number} [o.tilt] - whole-body rotation (radians), e.g. a flip mid-hop
 * @param {number} [o.pivot] - height (units) the tilt turns around (0 = the feet)
 * @param {Function} [o.drawHead] - (ctx, cx, cy, size, angle) draws the emoji head
 */
export function drawDancer(ctx, pose, o) {
	const s = o.scale;
	const fx = o.flip ? -1 : 1;
	const sq = o.squash || 0;
	const sy = 1 - 0.18 * sq;             // squash: shorter and wider
	const sx = 1 + 0.12 * sq;
	const tilt = o.tilt || 0;
	const ct = Math.cos(tilt), st = Math.sin(tilt);
	const pv = o.pivot || 0;
	const outline = o.outline == null ? 3 : o.outline;

	const X = new Float32Array(NJ), Y = new Float32Array(NJ);
	for (let j = 0; j < NJ; j++) {
		const ux = pose[j * 2] * fx * sx, uy = pose[j * 2 + 1] * sy - pv;
		// turn around the pivot
		X[j] = o.x + (ux * ct + uy * st) * s;
		Y[j] = o.y - (uy * ct - ux * st + pv) * s;
	}
	const depth = (k) => pose[NJ * 2 + k];

	ctx.save();
	ctx.lineCap = 'round';
	ctx.lineJoin = 'round';

	const path = (names) => {
		ctx.beginPath();
		ctx.moveTo(X[J[names[0]]], Y[J[names[0]]]);
		for (let i = 1; i < names.length; i++) ctx.lineTo(X[J[names[i]]], Y[J[names[i]]]);
	};
	const stroke = (names, width, color) => {
		path(names);
		ctx.lineWidth = width;
		ctx.strokeStyle = color;
		ctx.stroke();
	};
	const limbW = LOOK.limb * s, torsoW = LOOK.torso * s;

	const drawLimb = (key) => {
		const [, colorKey, chain, foot] = PARTS[key];
		const color = o[colorKey];
		if (outline > 0) {
			if (foot) stroke(foot, limbW + outline * 2, '#000');
			stroke(chain, limbW + outline * 2, '#000');
		}
		if (foot) stroke(foot, limbW, LOOK.shoe);
		stroke(chain, limbW, color);
	};
	const drawTorso = () => {
		if (outline > 0) {
			stroke(['lShoulder', 'rShoulder'], limbW + outline * 2, '#000');
			stroke(['pelvis', 'chest', 'neck'], torsoW + outline * 2, '#000');
		}
		stroke(['lShoulder', 'rShoulder'], limbW, o.shirt);
		stroke(['pelvis', 'chest', 'neck'], torsoW, o.shirt);
	};
	const drawHead = () => {
		if (!o.drawHead) return;
		const hx = X[J.head], hy = Y[J.head];
		let dx = hx - X[J.neck], dy = hy - Y[J.neck];
		const len = Math.hypot(dx, dy) || 1;
		dx /= len; dy /= len;
		const lift = LOOK.headLift * s;
		// angle of the neck from straight up, damped a little
		const ang = Math.atan2(dx, -dy) * 0.8;
		o.drawHead(ctx, hx + dx * lift, hy + dy * lift, LOOK.head * s, ang);
	};

	// legs first (nearest last), then arms / body / head by depth; the head
	// always goes over the body
	const legs = ['lLeg', 'rLeg'].sort((a, b) => depth(PARTS[a][0]) - depth(PARTS[b][0]));
	for (const k of legs) drawLimb(k);

	const torsoZ = depth(4);
	const headZ = Math.max(depth(5), torsoZ + 0.01);
	const upper = [
		{ z: depth(0), draw: () => drawLimb('lArm') },
		{ z: depth(1), draw: () => drawLimb('rArm') },
		{ z: torsoZ, draw: drawTorso },
		{ z: headZ, draw: drawHead },
	].sort((a, b) => a.z - b.z);
	for (const p of upper) p.draw();

	ctx.restore();
}


/**
 * Height of the dancer's highest point (units, incl. the emoji head) for a
 * pose - handy for layout and tests.
 *
 * @param {Float32Array} pose
 * @returns {number}
 */
export function poseTop(pose) {
	let top = 0;
	for (let j = 0; j < NJ; j++) top = Math.max(top, pose[j * 2 + 1]);
	return Math.max(top, pose[J.head * 2 + 1] + LOOK.headLift + LOOK.head / 2);
}
