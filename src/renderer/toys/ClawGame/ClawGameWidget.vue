<!--
	ClawGameWidget.vue
	------------------

	OBS-side rendering for the Claw Game toy. Ported nearly 1:1 from the
	standalone claw-game-demo (misc/claw-game-demo/src/App.vue), with the
	following adaptations for chat-toys:

	  - Player name comes from the chatter who called !drop, not a modal.
	  - Drop position comes from currentDrop.targetX (chat command),
	    not a typed cmd-input.
	  - Tilde dev menu, cmd input, name modal, status HUD, mobile block,
	    and animated background video are all removed. Background is fully
	    transparent so OBS chroma / scenes can show through.
	  - Tunables (slip / push / scale / prize list) come from the toy's
	    settings socket, not local refs.
	  - When the drop sequence completes, the widget writes back to the
	    `dropAck` socket so the toy can pop the next drop in the queue.
	  - Renders into a fixed 1280x720 coord space and lets FixedAutoSizer
	    scale to fit the OBS browser-source dimensions.
-->
<template>

	<!--
		Responsive wrapper: takes up whatever the widget box / OBS browser
		source gives it. A ResizeObserver inside the script updates stageW /
		stageH from this element's clientWidth / clientHeight so the matter
		world matches the actual rendered size - more space gives the prizes
		more room to spread out, no letterboxing.
	-->
	<div ref="wrapper" class="claw-machine-wrapper">

		<div v-if="ready" class="claw-stage">

			<!-- Layer 1: back_grip canvas (drawn BEHIND prizes) -->
			<canvas
				ref="bgCanvas"
				class="bg-canvas"
				:width="stageW"
				:height="stageH"
			></canvas>

			<!-- Layer 2: matter.js prizes + foreground claw sprites -->
			<canvas
				ref="canvas"
				:width="stageW"
				:height="stageH"
			></canvas>

			<!-- Layer 3: win chute (purely visual; the physics chute wall
				 is built inside the Matter.js world) -->
			<div class="shoot" :style="{ width: chuteWidth + 'px' }">
				<div class="shoot-text">WIN AREA</div>
				<div class="shoot-wins">PRIZES WON: {{ wonPrizesCount }}</div>
			</div>

		</div>
	</div>

</template>
<script setup>

// vue
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { socketShallowRef, socketShallowRefReadOnly } from 'socket-ref';

// chat-toys plumbing
import { useToySettings } from '@toys/useToySettings';
import { keepAliveSocket } from '../keepAliveSocket.js';
import { v4 as uuidv4 } from 'uuid';

// physics
import Matter from 'matter-js';
import decomp from 'poly-decomp';

// Expose poly-decomp to Matter for concave-hull prize bodies.
window.decomp = decomp;
Matter.Common.setDecomp(decomp);

const {
	Engine,
	Render,
	Runner,
	Bodies,
	Composite,
	Body,
	Events,
	Vertices,
} = Matter;


// ── Stage size (responsive) ─────────────────────────────────────────────────
// The matter world matches the actual rendered size of the wrapper element,
// so a wider widget box gives prizes more horizontal room (rather than
// letterboxing a fixed-resolution stage). Updated by a ResizeObserver in
// onMounted - see resizeStage(). 1080p defaults are placeholders used until
// the first observer callback fires.
const stageW = ref(1920);
const stageH = ref(1080);

// Plain-JS aliases that we read from non-reactive callbacks (matter render
// loop, drop sequence, etc.). resizeStage() keeps them in sync with the refs.
let stageWidth = stageW.value;
let stageHeight = stageH.value;


// ── Claw sprite metadata (matches misc/claw-game-demo) ──────────────────────
/** claw_top.png: 290x299, pivot at (145,16), grip attach points at y=228 */
const CLAW_TOP_META = {
	w: 290, h: 299,
	pivX: 145, pivY: 16,
	lgAttachX: 10,  lgAttachY: 228,
	rgAttachX: 279, rgAttachY: 228,
	bgAttachX: 145, bgAttachY: 228,
};
/** left_grip.png: 190x357, pivot at (165,25) - rotates CCW when closing */
const LEFT_GRIP_META  = { w: 190, h: 357, pivX: 165, pivY: 25 };
/** right_grip.png: 190x357, pivot at (25,25) - rotates CW when closing */
const RIGHT_GRIP_META = { w: 190, h: 357, pivX: 25,  pivY: 25 };
/** back_grip.png: 65x305, pivot at (31,14) - no rotation, shifts vertically */
const BACK_GRIP_META  = { w: 65,  h: 305, pivX: 31,  pivY: 14 };

/** Native grip length in pixels (pivot-to-tip) */
const GRIP_LENGTH_NATIVE   = 332;
/** Native distance from claw_top pivot down to grip attach point */
const GRIP_ATTACH_NATIVE_Y = 212;
/** Max closing angle for left/right grips (degrees) */
const CLOSE_ANGLE_DEG = 20;
/** How far back_grip shifts down when fully closed (px) */
const BACK_GRIP_CLOSE_OFFSET = 20;


// ── Claw base constants (matches demo, native at prizeScale=0.45) ───────────
const ARM_LENGTH_BASE      = 100;
const MAX_SPREAD_BASE      = 65;
const SENSOR_Y_OFFSET_BASE = 42;
const INTERIOR_HALF_W_BASE = 18;
const INTERIOR_BOT_BASE    = 48;
const OPEN_ANIM_MS         = 420;


// ── Collision categories ─────────────────────────────────────────────────────
const PRIZE_CATEGORY = 0x0004;
const WALL_CATEGORY  = 0x0001;


// ── chat-toys plumbing ───────────────────────────────────────────────────────
const thisSlug = 'clawGame';
const widgetSlug = 'machine';
const slugify = (text) => thisSlug + '__' + text.toLowerCase();

// Heartbeat so the main app knows this widget is alive.
keepAliveSocket(thisSlug, widgetSlug);

const emit = defineEmits(['boxChange']);


// ── State refs ───────────────────────────────────────────────────────────────
const wrapper = ref(null);
const canvas = ref(null);
const bgCanvas = ref(null);

// useToySettings flips `ready` once the settings socket has arrived.
// (The wrapper element is rendered before the inner stage so the
// ResizeObserver has something to observe even when ready is still false.)
const ready = ref(false);
const settings = useToySettings(thisSlug, 'widgetBox', emit, () => {
	ready.value = true;
});

// State from the toy.
const currentDrop = socketShallowRefReadOnly(slugify('currentDrop'), null);
const resolvedPrizes = socketShallowRefReadOnly(slugify('resolvedPrizes'), []);
const respawnNonce = socketShallowRefReadOnly(slugify('respawnNonce'), 0);

// Acknowledgement back to the toy. Writable; the toy watches it to advance the queue.
const dropAck = socketShallowRef(slugify('dropAck'), null);

// Win event back-channel. Writable; the toy watches it and pays out points
// once per unique `id`. Shape: { id, userId, username, prizeName, value, t }.
const lastWin = socketShallowRef(slugify('lastWin'), null);


// ── Tunable accessors (pulled from settings socket; safe defaults) ──────────
const prizeScale  = computed(() => settings.value?.prizeScale  ?? 0.9);
const uiScale     = computed(() => settings.value?.uiScale     ?? 1.0);
const slipChance  = computed(() => settings.value?.slipChance  ?? 50);
const slipMinTime = computed(() => settings.value?.slipMinTime ?? 1.5);
const slipMaxTime = computed(() => settings.value?.slipMaxTime ?? 3);
const pushStrength = computed(() => settings.value?.pushStrength ?? 100);
const pushOnGrab  = computed(() => settings.value?.pushOnGrab  ?? true);
const pushOnMiss  = computed(() => settings.value?.pushOnMiss  ?? true);
const spawnCount  = computed(() => settings.value?.spawnCount  ?? 18);


// ── Dynamic chute width (scales with prize size + UI scale) ─────────────────
const chuteWidth = computed(() => {
	const cs = Math.max(0.8, prizeScale.value / 0.45) * uiScale.value;
	return Math.round(180 * cs);
});


// ── Win-tracking UI state ────────────────────────────────────────────────────
const wonPrizesCount = ref(0);


// ── Matter.js globals (kept outside reactivity on purpose) ──────────────────
let engine, render, runner, world;
/** @type {Array<Matter.Body>} */
let prizes = [];

// Claw runtime state.
let clawX = 0;
let clawY = 0;
let clawOpenAmount = 1.0;

// Open/close animation state.
let openAnimActive = false;
let openAnimStart = 0;
let openAnimFrom = 1.0;
let openAnimTo = 0.0;

// Fake-physics state for the held prize (swings in claw-local space).
let grabbedPrize = null;
let fakeRelX = 0;
let fakeRelY = 0;
let fakeVelX = 0;
let fakeVelY = 0;

// Slip mechanic state.
let isSlipping = false;
let slipStartTime = 0;
let slipDuration = 0;

// Loaded sprite images.
let clawTopImg = null;
let leftGripImg = null;
let rightGripImg = null;
let backGripImg = null;

// Physics chute divider wall (rebuilt when chuteWidth or stage changes).
let chuteWall = null;

// Outer world boundaries (left / right / floor). Rebuilt on resize so the
// physics world tracks the actual rendered widget size.
let outerWalls = [];

// ResizeObserver instance, kept so onBeforeUnmount can disconnect.
let resizeObserver = null;

/**
 * Base prize width in pixels at prizeScale=1.0, uiScale=1.0. Derived from
 * the demo's `targetWidth = window.innerWidth / 9` at a ~1920px stage, so
 * the default look matches the demo when the widget runs at 1080p.
 */
const PRIZE_BASE_WIDTH_PX = 1920 / 9;

// Currently displayed name on the claw housing.
let activeUsername = '';

// Drop-cycle bookkeeping so we don't double-fire on a single currentDrop change.
let activeDropId = null;
let isDropping = false;


// ── Canvas drawing helpers ──────────────────────────────────────────────────

/**
 * Draws a rounded rectangle path onto ctx (no fill/stroke, caller does that).
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {number} w
 * @param {number} h
 * @param {number} r - corner radius
 */
const roundRectPath = (ctx, x, y, w, h, r) => {
	ctx.beginPath();
	ctx.moveTo(x + r, y);
	ctx.lineTo(x + w - r, y);
	ctx.arcTo(x + w, y,     x + w, y + r,     r);
	ctx.lineTo(x + w, y + h - r);
	ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
	ctx.lineTo(x + r, y + h);
	ctx.arcTo(x,      y + h, x,      y + h - r, r);
	ctx.lineTo(x, y + r);
	ctx.arcTo(x,      y,     x + r,  y,         r);
	ctx.closePath();
};


/**
 * Resolve scaled claw dimensions for the current prizeScale + uiScale.
 *
 * @returns {{ cs:number, armLen:number, maxSpread:number, sensorYOff:number,
 *   grabHalfW:number, intHalfW:number, intBot:number, clawRenderScale:number,
 *   attachOffset:number }}
 */
const getDims = () => {
	const cs              = Math.max(0.8, prizeScale.value / 0.45) * uiScale.value;
	const armLen          = ARM_LENGTH_BASE * cs;
	const clawRenderScale = armLen / GRIP_LENGTH_NATIVE;
	const attachOffset    = GRIP_ATTACH_NATIVE_Y * clawRenderScale;
	const maxSpread       = MAX_SPREAD_BASE * cs;
	return {
		cs,
		armLen,
		maxSpread,
		sensorYOff: SENSOR_Y_OFFSET_BASE * cs,
		grabHalfW:  maxSpread * 0.85,
		intHalfW:   INTERIOR_HALF_W_BASE * cs,
		intBot:     INTERIOR_BOT_BASE    * cs,
		clawRenderScale,
		attachOffset,
	};
};


// ── Sprite loading ──────────────────────────────────────────────────────────

/**
 * Resolve the path to a claw sprite. A *relative* path is intentional - in
 * Vite dev (live.html served from `/`) it resolves to `/assets/...`, and in
 * the packaged OBS browser source (live.html served from `/live/`) it
 * resolves to `/live/assets/...`. Both paths are correctly served (Vite via
 * publicDir, Express via the /live static mount).
 *
 * @param {string} filename
 * @returns {string}
 */
const clawSpritePath = (filename) => `assets/claw_game/${filename}`;


/**
 * Preloads the four claw PNGs.
 *
 * @returns {Promise<void>}
 */
const loadClawImages = () => {
	return new Promise(resolve => {
		let loaded = 0;
		const onLoad = () => { if (++loaded === 4) resolve(); };

		clawTopImg   = new Image();
		leftGripImg  = new Image();
		rightGripImg = new Image();
		backGripImg  = new Image();

		clawTopImg.onload   = onLoad;
		leftGripImg.onload  = onLoad;
		rightGripImg.onload = onLoad;
		backGripImg.onload  = onLoad;

		clawTopImg.src   = clawSpritePath('claw_top.png');
		leftGripImg.src  = clawSpritePath('left_grip.png');
		rightGripImg.src = clawSpritePath('right_grip.png');
		backGripImg.src  = clawSpritePath('back_grip.png');
	});
};


// ── Engine init ─────────────────────────────────────────────────────────────

/**
 * Build the Matter.js engine + renderer, world boundaries, chute wall, and
 * initial prize pile. Hook the per-frame callbacks for fake-physics and
 * claw rendering.
 */
const initPhysics = () => {

	clawX = stageWidth / 2;
	clawY = 100;

	engine = Engine.create();
	world  = engine.world;
	world.gravity.y = 1.0;

	render = Render.create({
		canvas: canvas.value,
		engine,
		options: {
			width: stageWidth,
			height: stageHeight,
			wireframes: false,
			background: 'transparent',
		},
	});

	Render.run(render);
	runner = Runner.create();
	Runner.run(runner, engine);

	rebuildWalls();
	rebuildChute();
	spawnPrizes();

	Events.on(engine, 'afterUpdate', onPhysicsUpdate);

	// afterRender listeners fire in registration order, so labels draw
	// first and the claw goes on top (it already covers the grabbed prize
	// label which we also skip in drawPrizeLabels).
	Events.on(render, 'afterRender', drawPrizeLabels);
	Events.on(render, 'afterRender', drawClaw);
};


/**
 * (Re)build the outer world boundaries (floor, left wall, right wall) for
 * the current stage size. Called once at init and again whenever the widget
 * is resized, so the matter world stays in lockstep with the rendered size.
 */
const rebuildWalls = () => {
	if (!world) return;

	outerWalls.forEach(w => Composite.remove(world, w));
	outerWalls = [];

	const wallOpts = {
		isStatic: true,
		collisionFilter: { category: WALL_CATEGORY },
		render: { visible: false },
	};

	outerWalls = [
		Bodies.rectangle(stageWidth / 2, stageHeight + 25, stageWidth, 50, wallOpts),
		Bodies.rectangle(-25, stageHeight / 2, 50, stageHeight, wallOpts),
		Bodies.rectangle(stageWidth + 25, stageHeight / 2, 50, stageHeight, wallOpts),
	];
	Composite.add(world, outerWalls);
};


/**
 * React to a wrapper size change: update the stage refs + non-reactive
 * aliases, resize the canvas / render, rebuild the walls + chute, and clamp
 * the claw so it doesn't end up outside the new bounds. Existing prizes are
 * left where they are (physics will settle them) - the streamer can hit
 * "Re-spawn Prizes" if the pile gets weird after a big resize.
 *
 * @param {number} w - new wrapper width in CSS pixels
 * @param {number} h - new wrapper height in CSS pixels
 */
const resizeStage = (w, h) => {

	const newW = Math.max(200, Math.floor(w));
	const newH = Math.max(200, Math.floor(h));
	if (newW === stageWidth && newH === stageHeight) return;

	stageWidth = newW;
	stageHeight = newH;
	stageW.value = newW;
	stageH.value = newH;

	// If physics isn't running yet (first resize before initPhysics()), the
	// new size will be picked up by init itself - nothing else to do.
	if (!engine || !render) return;

	// Resize the matter renderer's canvas + options. Both have to update or
	// matter will draw into a clipped/stale viewport.
	if (render.canvas) {
		render.canvas.width = newW;
		render.canvas.height = newH;
	}
	if (render.options) {
		render.options.width = newW;
		render.options.height = newH;
	}
	if (bgCanvas.value) {
		bgCanvas.value.width = newW;
		bgCanvas.value.height = newH;
	}

	rebuildWalls();
	rebuildChute();

	// Keep the claw inside the new viewport. Don't yank it mid-drop, just
	// clamp - the drop sequence's own moveClaw() targets are recomputed off
	// the current stage on the next drop anyway.
	clawX = Math.min(Math.max(50, clawX), stageWidth - 50);
	clawY = Math.min(Math.max(50, clawY), stageHeight - 200);
};


/**
 * Removes the old chute divider wall and recreates it at the current chuteWidth.
 * Called on init and whenever prizeScale (and therefore chuteWidth) changes.
 */
const rebuildChute = () => {
	if (!world) return;
	if (chuteWall) Composite.remove(world, chuteWall);
	const w = chuteWidth.value;
	chuteWall = Bodies.rectangle(w, stageHeight - 150, 15, 400, {
		isStatic: true,
		collisionFilter: { category: WALL_CATEGORY },
		render: { fillStyle: '#2c3e50' },
	});
	Composite.add(world, chuteWall);
};


// ── Per-frame callbacks ─────────────────────────────────────────────────────

const onPhysicsUpdate = () => {

	if (openAnimActive) {
		const elapsed = performance.now() - openAnimStart;
		const t       = Math.min(elapsed / OPEN_ANIM_MS, 1.0);
		const ease    = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
		clawOpenAmount = openAnimFrom + (openAnimTo - openAnimFrom) * ease;
		if (t >= 1.0) {
			openAnimActive = false;
			clawOpenAmount = openAnimTo;
		}
	}

	if (grabbedPrize) tickFakePhysics();

	checkWin();
};


/**
 * Simulates the held prize swinging in claw-local space (spring + gravity +
 * damping). During a slip the spring weakens and the floor expands until the
 * prize falls free.
 */
const tickFakePhysics = () => {

	const GRAVITY       = 0.30;
	const DAMPING       = 0.88;
	const BASE_SPRING_K = 0.038;
	const { cs, attachOffset, armLen, intHalfW, intBot } = getDims();

	let springK      = BASE_SPRING_K;
	let effectiveBot = intBot;

	if (isSlipping) {
		const elapsed  = (performance.now() - slipStartTime) / 1000;
		const progress = Math.min(elapsed / slipDuration, 1.0);
		springK      = BASE_SPRING_K * (1 - progress * 0.95);
		effectiveBot = intBot + progress * armLen * 1.5;
		if (progress >= 1.0) {
			isSlipping = false;
			releasePrize();
			return;
		}
	}

	fakeVelY += GRAVITY;
	fakeVelX -= fakeRelX * springK;
	fakeVelY -= fakeRelY * springK;
	fakeVelX *= DAMPING;
	fakeVelY *= DAMPING;
	fakeRelX += fakeVelX;
	fakeRelY += fakeVelY;

	const halfW = intHalfW + clawOpenAmount * 28 * cs;
	if (fakeRelX >  halfW)  { fakeRelX =  halfW;  fakeVelX *= -0.45; }
	if (fakeRelX < -halfW)  { fakeRelX = -halfW;  fakeVelX *= -0.45; }
	if (fakeRelY < 0)       { fakeRelY = 0;        fakeVelY *= -0.30; }
	if (fakeRelY > effectiveBot) { fakeRelY = effectiveBot; fakeVelY *= -0.50; }

	const holdY = clawY + attachOffset + armLen * 0.62;
	Body.setPosition(grabbedPrize, { x: clawX + fakeRelX, y: holdY + fakeRelY });
	Body.setVelocity(grabbedPrize, { x: 0, y: 0 });
	Body.setAngularVelocity(grabbedPrize, 0);
};


/**
 * Sweep free prizes - anything inside the chute and below the chute mouth
 * counts as won. Stripped from the world, counter ticks up, and a win event
 * is pushed up to the toy via the `lastWin` socket-ref so it can pay out
 * points + log the win to the chat-toys log.
 */
const checkWin = () => {
	const cw = chuteWidth.value;
	for (let i = prizes.length - 1; i >= 0; i--) {
		const p = prizes[i];
		if (p === grabbedPrize) continue;
		if (p.position.x < cw && p.position.y > stageHeight - 200) {
			const tag = p.plugin?.clawGame || {};

			// Send the win up to the toy. The toy de-dupes by id so it pays
			// out exactly once per unique win - re-renders or socket re-syncs
			// can't double-credit a viewer.
			lastWin.value = {
				id: uuidv4(),
				userId: tag.grabbedByUserID || null,
				username: tag.grabbedBy || null,
				prizeName: tag.name || 'a prize',
				value: tag.value || 0,
				t: Date.now(),
			};

			Composite.remove(world, p);
			prizes.splice(i, 1);
			wonPrizesCount.value++;
		}
	}
};


// ── Prize value labels ──────────────────────────────────────────────────────

/**
 * Draw a "₱<value>" pill on each prize, scaled with the prize's rendered
 * width so it stays readable regardless of prizeScale / uiScale. Drawn as
 * an afterRender step on the matter Render context so it lives on the same
 * canvas as the prize sprites; labels for the currently-grabbed prize are
 * skipped (the claw / housing covers that area).
 */
const drawPrizeLabels = () => {
	const ctx = render?.context;
	if (!ctx) return;

	for (const p of prizes) {
		if (p === grabbedPrize) continue;
		const tag = p.plugin?.clawGame;
		if (!tag || tag.value == null) continue;

		// Font sizes scale with the prize's rendered width so the label
		// looks proportional whether the streamer cranked up uiScale or
		// dropped prizeScale way down. Floored so we don't render fractional
		// font sizes at very small scales.
		const fontSize = Math.max(11, Math.floor((tag.targetWidth || 100) * 0.22));
		const cx = p.position.x;
		const cy = p.position.y;
		const text = `₱${tag.value}`;

		ctx.save();
		ctx.font = `bold ${fontSize}px Rajdhani, sans-serif`;
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';

		const textWidth = ctx.measureText(text).width;
		const padX = fontSize * 0.5;
		const padY = fontSize * 0.22;
		const pillW = textWidth + padX * 2;
		const pillH = fontSize + padY * 2;
		const pillR = pillH / 2;
		const pillX = cx - pillW / 2;
		const pillY = cy - pillH / 2;

		ctx.fillStyle = 'rgba(0, 0, 0, 0.72)';
		roundRectPath(ctx, pillX, pillY, pillW, pillH, pillR);
		ctx.fill();

		ctx.fillStyle = '#fff';
		ctx.shadowColor = '#000';
		ctx.shadowOffsetX = 1;
		ctx.shadowOffsetY = 1;
		ctx.fillText(text, cx, cy);

		ctx.shadowColor = 'transparent';
		ctx.shadowOffsetX = 0;
		ctx.shadowOffsetY = 0;
		ctx.restore();
	}
};


// ── Claw rendering ──────────────────────────────────────────────────────────

/**
 * Draws the full claw assembly using PNG sprites.
 *
 * Layers (back to front):
 *   bgCanvas      - back_grip (behind prizes); shifts down as the claw closes
 *   main canvas   - left_grip + right_grip (rotate when closing)
 *                 - claw_top housing (over the grips)
 *                 - active chatter's name pill (centered in the housing)
 */
const drawClaw = () => {

	if (!clawTopImg || !leftGripImg || !rightGripImg || !backGripImg) return;

	const ctx   = render.context;
	const bgCtx = bgCanvas.value?.getContext('2d');
	if (!bgCtx) return;

	const { clawRenderScale: s } = getDims();
	const cx = clawX;
	const cy = clawY;

	const lgX = cx + (CLAW_TOP_META.lgAttachX - CLAW_TOP_META.pivX) * s;
	const lgY = cy + (CLAW_TOP_META.lgAttachY - CLAW_TOP_META.pivY) * s;
	const rgX = cx + (CLAW_TOP_META.rgAttachX - CLAW_TOP_META.pivX) * s;
	const rgY = cy + (CLAW_TOP_META.rgAttachY - CLAW_TOP_META.pivY) * s;
	const bgX = cx + (CLAW_TOP_META.bgAttachX - CLAW_TOP_META.pivX) * s;
	const bgY = cy + (CLAW_TOP_META.bgAttachY - CLAW_TOP_META.pivY) * s;

	const closeAngle      = (1 - clawOpenAmount) * CLOSE_ANGLE_DEG * (Math.PI / 180);
	const backGripOffsetY = (1 - clawOpenAmount) * BACK_GRIP_CLOSE_OFFSET;

	// Cable
	ctx.save();
	ctx.strokeStyle = '#555';
	ctx.lineWidth   = Math.max(6, 12 * s);
	ctx.beginPath();
	ctx.moveTo(cx, 0);
	ctx.lineTo(cx, cy - CLAW_TOP_META.pivY * s);
	ctx.stroke();
	ctx.restore();

	// back_grip on background canvas (behind prizes)
	bgCtx.clearRect(0, 0, bgCtx.canvas.width, bgCtx.canvas.height);
	bgCtx.save();
	bgCtx.translate(bgX, bgY + backGripOffsetY);
	bgCtx.drawImage(
		backGripImg,
		-BACK_GRIP_META.pivX * s, -BACK_GRIP_META.pivY * s,
		BACK_GRIP_META.w * s,      BACK_GRIP_META.h * s,
	);
	bgCtx.restore();

	// left_grip (CCW)
	ctx.save();
	ctx.translate(lgX, lgY);
	ctx.rotate(-closeAngle);
	ctx.drawImage(
		leftGripImg,
		-LEFT_GRIP_META.pivX * s, -LEFT_GRIP_META.pivY * s,
		LEFT_GRIP_META.w * s,      LEFT_GRIP_META.h * s,
	);
	ctx.restore();

	// right_grip (CW)
	ctx.save();
	ctx.translate(rgX, rgY);
	ctx.rotate(closeAngle);
	ctx.drawImage(
		rightGripImg,
		-RIGHT_GRIP_META.pivX * s, -RIGHT_GRIP_META.pivY * s,
		RIGHT_GRIP_META.w * s,      RIGHT_GRIP_META.h * s,
	);
	ctx.restore();

	// claw_top housing (on top of grips)
	ctx.save();
	ctx.translate(cx, cy);
	ctx.drawImage(
		clawTopImg,
		-CLAW_TOP_META.pivX * s, -CLAW_TOP_META.pivY * s,
		CLAW_TOP_META.w * s,      CLAW_TOP_META.h * s,
	);
	ctx.restore();

	// Active chatter's name pill
	if (activeUsername) {
		const labelY  = cy + (CLAW_TOP_META.lgAttachY / 2 - CLAW_TOP_META.pivY) * s;
		const fontSize = Math.max(11, Math.round(10 + s * 14));

		ctx.save();
		ctx.font         = `bold ${fontSize}px Rajdhani, sans-serif`;
		ctx.textAlign    = 'center';
		ctx.textBaseline = 'middle';

		const textW = ctx.measureText(activeUsername).width;
		const padX  = Math.max(6, 8 * s);
		const padY  = Math.max(3, 4 * s);
		const pillW = textW + padX * 2;
		const pillH = fontSize + padY * 2;
		const pillR = pillH / 2;
		const pillX = cx - pillW / 2;
		const pillY = labelY - pillH / 2;

		ctx.fillStyle = 'rgba(0, 0, 0, 0.60)';
		roundRectPath(ctx, pillX, pillY, pillW, pillH, pillR);
		ctx.fill();

		ctx.shadowColor   = '#000';
		ctx.shadowBlur    = 0;
		ctx.shadowOffsetX = 1.5;
		ctx.shadowOffsetY = 1.5;
		ctx.fillStyle     = '#ffffff';
		ctx.fillText(activeUsername, cx, labelY);

		ctx.shadowColor   = 'transparent';
		ctx.shadowOffsetX = 0;
		ctx.shadowOffsetY = 0;
		ctx.restore();
	}
};


// ── Sensor + grab ───────────────────────────────────────────────────────────

/**
 * Detect a prize inside the claw opening. Hybrid test:
 *   vertical = prize CENTER within opening band
 *   horizontal = prize BOUNDS within arm span
 *
 * @returns {Matter.Body|null}
 */
const checkSensor = () => {

	const { attachOffset, armLen, maxSpread, sensorYOff } = getDims();
	const pivotY     = clawY + attachOffset;
	const openingTop = pivotY + sensorYOff;
	const openingBot = pivotY + armLen + 10;

	let closest     = null;
	let closestDist = Infinity;

	for (const p of prizes) {
		if (p === grabbedPrize) continue;

		const cy = p.position.y;
		if (cy < openingTop || cy > openingBot) continue;

		const b = p.bounds;
		if (b.max.x < clawX - maxSpread * 1.1 || b.min.x > clawX + maxSpread * 1.1) continue;

		const dx   = p.position.x - clawX;
		const dy   = cy - (openingTop + openingBot) / 2;
		const dist = Math.sqrt(dx * dx + dy * dy);
		if (dist < closestDist) {
			closestDist = dist;
			closest     = p;
		}
	}

	return closest;
};


/**
 * Returns true when the closed arms are realistically around the prize.
 *
 * @param {Matter.Body} prize
 * @returns {boolean}
 */
const clawCanGrab = (prize) => {
	const { attachOffset, armLen, grabHalfW } = getDims();
	const px      = prize.position.x;
	const py      = prize.position.y;
	const horizOk = Math.abs(px - clawX) < grabHalfW;
	const vertTop = clawY + attachOffset;
	const vertBot = clawY + attachOffset + armLen + 20;
	return horizOk && py > vertTop && py < vertBot;
};


/**
 * Moves a prize into fake-physics grab mode and optionally starts a slip.
 *
 * @param {Matter.Body} prize
 */
const grabPrize = (prize) => {

	const { attachOffset, armLen } = getDims();
	grabbedPrize = prize;
	const holdY  = clawY + attachOffset + armLen * 0.62;
	fakeRelX     = prize.position.x - clawX;
	fakeRelY     = prize.position.y - holdY;
	fakeVelX     = 0;
	fakeVelY     = 0;
	isSlipping   = false;
	Body.set(prize, { collisionFilter: { category: 0, mask: 0 } });

	// Tag the prize with whoever is currently dropping so checkWin can
	// attribute the eventual win when (if) the prize crosses the chute. We
	// tag at grab time rather than at chute entry because by the time the
	// prize falls into the chute the active drop may have already cleared.
	const drop = currentDrop.value;
	const tag = prize.plugin?.clawGame;
	if (drop && tag) {
		tag.grabbedBy = drop.username || '';
		tag.grabbedByUserID = drop.userID || null;
	}

	if (Math.random() * 100 < slipChance.value) {
		const minT    = Math.min(slipMinTime.value, slipMaxTime.value);
		const maxT    = Math.max(slipMinTime.value, slipMaxTime.value);
		slipDuration  = minT + Math.random() * (maxT - minT);
		isSlipping    = true;
		slipStartTime = performance.now();
	}
};


/**
 * Returns the held prize to real physics with exit velocity.
 */
const releasePrize = () => {

	if (!grabbedPrize) return;
	isSlipping = false;
	Body.set(grabbedPrize, {
		collisionFilter: { category: PRIZE_CATEGORY, mask: WALL_CATEGORY | PRIZE_CATEGORY },
	});
	Body.setVelocity(grabbedPrize, { x: fakeVelX * 2.5, y: fakeVelY * 2.5 });
	Body.setAngularVelocity(grabbedPrize, (Math.random() - 0.5) * 0.2);
	grabbedPrize = null;
};


/**
 * Applies a radial velocity nudge to all free prizes within `radius` px.
 * Simulates the claw disturbing the pile on grabs and misses.
 *
 * @param {number} cx
 * @param {number} cy
 * @param {number} radius
 * @param {number} strength - velocity magnitude applied at dead-center
 */
const pushNearbyPrizes = (cx, cy, radius, strength) => {
	for (const p of prizes) {
		if (p === grabbedPrize) continue;
		const dx   = p.position.x - cx;
		const dy   = p.position.y - cy;
		const dist = Math.sqrt(dx * dx + dy * dy);
		if (dist < radius && dist > 0) {
			const mag = strength * (1 - dist / radius);
			Body.setVelocity(p, {
				x: p.velocity.x + (dx / dist) * mag,
				y: p.velocity.y + (dy / dist) * mag,
			});
		}
	}
};


// ── Movement helpers ────────────────────────────────────────────────────────

/**
 * Smoothly moves the claw to (tx, ty) at the given speed in px/frame.
 *
 * @param {number} tx
 * @param {number} ty
 * @param {number} speed
 * @returns {Promise<void>}
 */
const moveClaw = (tx, ty, speed) => {
	return new Promise(resolve => {
		const step = () => {
			const dx   = tx - clawX;
			const dy   = ty - clawY;
			const dist = Math.sqrt(dx * dx + dy * dy);
			if (dist < speed) {
				clawX = tx;
				clawY = ty;
				resolve();
				return;
			}
			clawX += (dx / dist) * speed;
			clawY += (dy / dist) * speed;
			requestAnimationFrame(step);
		};
		step();
	});
};


/**
 * Animate the claw open/close to the given amount.
 *
 * @param {number} toAmount - 0 = closed, 1 = open
 * @returns {Promise<void>}
 */
const animateClawTo = (toAmount) => {
	return new Promise(resolve => {
		openAnimFrom   = clawOpenAmount;
		openAnimTo     = toAmount;
		openAnimStart  = performance.now();
		openAnimActive = true;
		setTimeout(resolve, OPEN_ANIM_MS + 50);
	});
};


// ── Drop sequence ───────────────────────────────────────────────────────────

/**
 * Full drop cycle: open -> position -> descend -> close -> grab/push ->
 * ascend -> deliver -> release. Mirrors the demo, parametrised on `targetX`
 * (0-100 horizontal percentage from the chat command).
 *
 * @param {number} targetX - 0-100 horizontal target
 * @returns {Promise<void>}
 */
const runDropSequence = async (targetX) => {

	if (grabbedPrize) releasePrize();

	const topY   = 100;
	const floorY = stageHeight - 110;
	const destX  = (targetX / 100) * (stageWidth - 500) + 400;

	await animateClawTo(1.0);
	await moveClaw(destX, topY, 8);

	// Descend until floor or sensor catch.
	let detectedPrize = null;
	await new Promise(resolve => {
		const descend = () => {
			clawY += 4;
			if (clawY >= floorY) { clawY = floorY; resolve(); return; }
			detectedPrize = checkSensor();
			if (detectedPrize) { resolve(); return; }
			requestAnimationFrame(descend);
		};
		descend();
	});

	await animateClawTo(0.0);
	await new Promise(r => setTimeout(r, 130));

	// Grab check + pile disturbance.
	const { cs, attachOffset } = getDims();
	const pushCx = clawX;
	const pushCy = clawY + attachOffset;
	const pushR  = 130 * cs;

	if (detectedPrize && clawCanGrab(detectedPrize)) {
		grabPrize(detectedPrize);
		if (pushOnGrab.value) pushNearbyPrizes(pushCx, pushCy, pushR, pushStrength.value);
	} else {
		if (pushOnMiss.value) pushNearbyPrizes(pushCx, pushCy, pushR, pushStrength.value);
	}

	await moveClaw(clawX, topY, 4);
	await moveClaw(chuteWidth.value / 2, topY, 6);

	await animateClawTo(1.0);

	if (grabbedPrize) releasePrize();

	await new Promise(r => setTimeout(r, 900));
};


/**
 * Run a drop end-to-end, with bookkeeping for the toy's queue. Skips early
 * if a drop is already in progress (defense against double-fire).
 *
 * @param {{ id:string, username:string, targetX:number }} drop
 */
const handleDrop = async (drop) => {

	if (!drop || isDropping) return;
	if (activeDropId === drop.id) return; // already handling this one

	isDropping = true;
	activeDropId = drop.id;
	activeUsername = drop.username || '';

	try {
		await runDropSequence(drop.targetX);
	} finally {
		isDropping = false;
		activeUsername = '';
		// Ack the toy so it can pop the next drop. Object identity changes
		// each time so consecutive identical IDs (shouldn't happen, but) still
		// trigger the watcher.
		dropAck.value = { id: drop.id, t: Date.now() };

		// Race protection: if the toy advanced the queue (e.g. its safety
		// timeout fired) while we were animating, the watch on currentDrop
		// already fired and was no-op'd by our isDropping guard. Pick up
		// whatever is current right now so we don't strand a queued drop.
		const next = currentDrop.value;
		if (next && next.id && next.id !== drop.id) {
			handleDrop(next);
		}
	}
};


// ── Prize spawning ──────────────────────────────────────────────────────────

/**
 * Remove all current prizes (rebuilding the chute) and spawn a fresh pile.
 * Pulls images from the resolvedPrizes socket; falls back to no-op when the
 * streamer has configured zero prizes.
 */
const spawnPrizes = async () => {

	if (!world) return;
	prizes.forEach(p => Composite.remove(world, p));
	prizes = [];
	rebuildChute();

	const pool = resolvedPrizes.value || [];
	if (pool.length === 0) return; // streamer hasn't set up any prizes yet

	const spawnMin = chuteWidth.value + 50;
	const spawnMax = stageWidth - spawnMin;
	const count = Math.max(1, Math.floor(spawnCount.value));

	for (let i = 0; i < count; i++) {
		const prize = pool[i % pool.length];
		const x = spawnMin + Math.random() * Math.max(0, spawnMax - spawnMin);
		await createPrize(prize, x, -100 - (i * 120));
	}
};


/**
 * Loads a prize image, builds a convex-hull physics body, adds it to the
 * world, and stamps it with the metadata the rest of the widget / toy needs:
 *
 *   body.plugin.clawGame = {
 *     name, value, targetWidth,    // for labels + win events
 *     grabbedBy, grabbedByUserID,  // tagged on grab; read on chute entry
 *   }
 *
 * @param {{name:string,imageUrl:string,scale:number,minValue:number,maxValue:number}} prize
 * @param {number} x
 * @param {number} y
 */
const createPrize = async (prize, x, y) => {

	const url = prize.imageUrl;
	const extraScale = prize.scale || 1;

	const img = new Image();
	// Prize images can come from the asset server on a different origin than
	// the widget host (in dev: widget @ :8080, assets @ :3001). Request the
	// load as CORS-anonymous so getImageData below doesn't trip the
	// "tainted canvas" SecurityError. The Express CORS middleware on the
	// asset server explicitly allows :8080. MUST be set before .src.
	img.crossOrigin = 'anonymous';
	img.src = url;
	try {
		await new Promise((resolve, reject) => {
			img.onload = resolve;
			img.onerror = reject;
		});
	} catch (e) {
		// Broken asset - skip rather than blowing up the whole spawn run.
		console.warn('[ClawGame] Failed to load prize image:', url);
		return;
	}

	// Prize size is an absolute pixel value (not stage-relative) so making
	// the widget bigger gives *more space* for the same-size prizes, rather
	// than just zooming everything. uiScale lets 4K streamers bump the whole
	// machine without changing per-prize relative scale.
	const targetWidth = PRIZE_BASE_WIDTH_PX * prizeScale.value * uiScale.value * extraScale;
	const scale       = targetWidth / img.width;
	const tc          = document.createElement('canvas');
	const ctx         = tc.getContext('2d');
	tc.width  = img.width;
	tc.height = img.height;
	ctx.drawImage(img, 0, 0);

	const data   = ctx.getImageData(0, 0, tc.width, tc.height);
	const points = [];
	for (let py = 0; py < tc.height; py += 12) {
		for (let px = 0; px < tc.width; px += 12) {
			if (data.data[((py * tc.width) + px) * 4 + 3] > 150) {
				points.push({ x: px * scale, y: py * scale });
			}
		}
	}
	if (points.length < 3) return; // not enough sampled pixels - skip

	const hull = Vertices.hull(points);
	const body = Bodies.fromVertices(x, y, [hull], {
		collisionFilter: { category: PRIZE_CATEGORY, mask: WALL_CATEGORY | PRIZE_CATEGORY },
		render:          { sprite: { texture: url, xScale: scale, yScale: scale } },
		friction:        0.9,
		density:         0.002,
	});
	if (body) {
		// Roll a value in [min, max] (inclusive integer). Sanitized upstream
		// in ClawGame.resolvePrizes so we don't have to defend against NaN.
		const min = Number.isFinite(prize.minValue) ? prize.minValue : 10;
		const maxCandidate = Number.isFinite(prize.maxValue) ? prize.maxValue : 50;
		const max = Math.max(min, maxCandidate);
		const value = min + Math.floor(Math.random() * (max - min + 1));

		// Stash everything matter-side so checkWin / drawPrizeLabels don't
		// have to thread it through other state.
		body.plugin = body.plugin || {};
		body.plugin.clawGame = {
			name: prize.name || 'prize',
			value,
			targetWidth,
			grabbedBy: null,
			grabbedByUserID: null,
		};

		Composite.add(world, body);
		prizes.push(body);
	}
};


// ── Reactivity wiring ───────────────────────────────────────────────────────

// Run a drop whenever the toy publishes a new currentDrop. immediate: true
// so a widget reload mid-drop still picks up the active drop.
watch(currentDrop, (val) => {
	if (val && val.id) handleDrop(val);
}, { immediate: true });

// Respawn the pile when the streamer hits "Re-spawn Prizes" in settings.
watch(respawnNonce, (val, oldVal) => {
	if (val === oldVal) return;
	spawnPrizes();
});

// If the streamer changes the prize list itself, also respawn so the new
// images take effect right away.
watch(resolvedPrizes, () => {
	spawnPrizes();
});

// chuteWidth depends on both prizeScale and uiScale, so rebuild the divider
// wall whenever either of them changes.
watch(chuteWidth, () => {
	rebuildChute();
});


// ── Lifecycle ───────────────────────────────────────────────────────────────

onMounted(async () => {
	// Capture the initial wrapper size BEFORE waiting for settings - the
	// wrapper element exists from first render (it's outside v-if="ready").
	// This way the eventual initPhysics() call uses real dimensions rather
	// than the 1920x1080 placeholders.
	if (wrapper.value) {
		const rect = wrapper.value.getBoundingClientRect();
		if (rect.width > 0 && rect.height > 0) {
			stageWidth = Math.max(200, Math.floor(rect.width));
			stageHeight = Math.max(200, Math.floor(rect.height));
			stageW.value = stageWidth;
			stageH.value = stageHeight;
		}
	}

	// Wait until useToySettings flips `ready` (its socket has populated).
	const waitForReady = () => new Promise(resolve => {
		if (ready.value) return resolve();
		const stop = watch(ready, (v) => { if (v) { stop(); resolve(); } });
	});
	await waitForReady();

	// `ready` flipping triggers the template's v-if to render the canvases -
	// give Vue one tick to actually flush the DOM before initPhysics reads
	// canvas.value and bgCanvas.value.
	await nextTick();

	await loadClawImages();
	initPhysics();

	// Track wrapper resizes so the matter world stays the same size as the
	// rendered widget (responsive sizing, no letterboxing).
	if (wrapper.value && typeof window !== 'undefined' && window.ResizeObserver) {
		resizeObserver = new ResizeObserver(entries => {
			for (const entry of entries) {
				const cr = entry.contentRect;
				resizeStage(cr.width, cr.height);
			}
		});
		resizeObserver.observe(wrapper.value);
	}
});


onBeforeUnmount(() => {
	if (resizeObserver) {
		resizeObserver.disconnect();
		resizeObserver = null;
	}
	if (runner) Runner.stop(runner);
	if (render) Render.stop(render);
	if (world) {
		prizes.forEach(p => Composite.remove(world, p));
		prizes = [];
	}
});

</script>
<style lang="scss" scoped>
@import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@500;700&display=swap');

// Outer responsive wrapper - fills whatever the widget box / OBS browser
// source dimensions are. A ResizeObserver in the script tracks size changes
// and propagates them to the matter world.
.claw-machine-wrapper {
	position: relative;
	width: 100%;
	height: 100%;
	overflow: hidden;
	font-family: 'Rajdhani', sans-serif;
	// Transparent background so OBS scenes / chroma key can show through.
	background: transparent;
}

.claw-stage {
	position: relative;
	width: 100%;
	height: 100%;
	overflow: hidden;
	background: transparent;
}

// Canvas layers - matter.js + the two-layer claw composite.
canvas {
	position: absolute;
	top: 0;
	left: 0;
	width: 100%;
	height: 100%;
	pointer-events: none;
}
.bg-canvas             { z-index: 1; }
canvas:not(.bg-canvas) { z-index: 2; }


// Win chute - the visual frame for the chute area; the physics wall lives
// inside the Matter world.
.shoot {
	position: absolute;
	bottom: 0;
	left: 0;
	height: 300px;
	z-index: 3;
	background: rgba(34, 211, 238, 0.05);
	border-right: 2px solid rgba(34, 211, 238, 0.3);
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: flex-end;
	padding-bottom: 1.2rem;
	box-sizing: border-box;
	transition: width 0.3s ease;
	pointer-events: none;

	.shoot-text {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%) rotate(-90deg);
		color: rgba(34, 211, 238, 0.15);
		font-weight: bold;
		font-size: 1.4rem;
		letter-spacing: 6px;
		white-space: nowrap;
	}

	.shoot-wins {
		color: #22d3ee;
		font-size: 1.1rem;
		font-weight: bold;
		letter-spacing: 1px;
		text-shadow: 0 0 10px rgba(34, 211, 238, 0.6);
		position: relative;
		z-index: 1;
	}
}

</style>
