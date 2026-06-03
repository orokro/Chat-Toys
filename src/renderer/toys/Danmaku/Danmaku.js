/*
	Danmaku.js
	----------

	This class handles the state for the Danmaku (NicoNico-style "bullet
	curtain") comment system.

	IMPORTANT - where the work happens:
	-----------------------------------
	Unlike toys whose entire state lives on the electron side (the toy
	updating socket refs frame-by-frame for a "dumb" widget), this toy acts
	purely as a SCHEDULER. It listens to chat, filters out commands (exactly
	like the Chat widget does), and pushes a small rolling list of comments
	onto a single socket ref.

	All of the heavy lifting - measuring comment widths, the collision /
	track-allocation math, and the actual scrolling animation - lives inside
	DanmakuWidget.vue, which keeps its own internal queue (the same way the
	Chat widget owns its own render state). This keeps the socket pipe quiet:
	we only emit when a new comment arrives, never per frame.
*/

// vue
import { ref, shallowRef } from 'vue';
import { socketShallowRef } from 'socket-ref';

// our app
import Toy from '../Toy';
import { ChatPointsHelper } from '../Chat/ChatPointsHelper';

// components
import DanmakuPage from './DanmakuPage.vue';
import DanmakuWidget from './DanmakuWidget.vue';

// main export
export default class Danmaku extends Toy {

	// static info
	static name = 'Danmaku Comments';
	static slug = 'danmaku';
	static desc = 'NicoNico-style scrolling comments that fly across the screen in multiple rows.';
	static optionsPageComponent = DanmakuPage;
	static themeColor = '#7C5CFF';
	static widgetComponents = [
		{
			component: DanmakuWidget,
			key: 'danmakuBox',
			allowResize: true,
			lockAspectRatio: false,
			description: 'Full-screen scrolling comment curtain. Place over your whole scene.',
			slug: 'danmaku'
		},
	];

	/**
	 * The list of font families offered in the text-settings dropdown.
	 * Declared before `textSettings` (below) because static fields initialize
	 * in textual order, and the textSettings descriptor references it.
	 *
	 * @type {Array<{ value: String, name: String }>}
	 */
	static FONT_OPTIONS = [
		{ value: "'Open Sans', sans-serif",                name: 'Open Sans' },
		{ value: "'Rajdhani', sans-serif",                 name: 'Rajdhani' },
		{ value: "Arial, Helvetica, sans-serif",           name: 'Arial' },
		{ value: "'Segoe UI', Tahoma, Geneva, sans-serif", name: 'Segoe UI' },
		{ value: "'Comic Sans MS', 'Comic Sans', cursive", name: 'Comic Sans' },
		{ value: "Impact, Haettenschweiler, sans-serif",   name: 'Impact' },
		{ value: "Georgia, 'Times New Roman', serif",      name: 'Georgia' },
		{ value: "'Courier New', Courier, monospace",      name: 'Courier New' },
	];

	// Text-style settings, grouped for the consolidated text-settings modal.
	// Keys here MUST match the refs declared in initSettings() below; this is
	// purely a presentation descriptor for SettingsTextRow + TextSettingsModal.
	// `fontFamily` uses the `options` field type - the modal was extended to
	// forward an `options` array through to the underlying SettingsInputRow.
	static textSettings = [
		{
			groupKey: 'comment',
			groupLabel: 'Comment Text',
			groupDescription: 'Font, size, color, and outline for the scrolling comments. Font size also determines how tall each row (track) is, and therefore how many rows fit on screen.',
			fields: [
				{
					key: 'fontFamily',
					label: 'Font',
					type: 'options',
					options: Danmaku.FONT_OPTIONS,
				},
				{ key: 'fontSize',   label: 'Font size',  type: 'number', min: 12, max: 72 },
				{ key: 'fontColor',  label: 'Text color', type: 'color' },
				{ key: 'fontOutline', label: 'Outline',   type: 'boolean' },
			],
			defaults: {
				fontFamily:  "'Open Sans', sans-serif",
				fontSize:    32,
				fontColor:   '#FFFFFF',
				fontOutline: true,
			},
		},
		{
			groupKey: 'name',
			groupLabel: 'Chatter Name',
			groupDescription: 'Style for the chatter name (and points) shown in front of each comment, when those toggles are enabled below. Uses the same font and size as the comment text.',
			fields: [
				{ key: 'nameColor',   label: 'Name color', type: 'color' },
				{ key: 'nameOutline', label: 'Outline',    type: 'boolean' },
			],
			defaults: {
				nameColor:   '#00ABAE',
				nameOutline: true,
			},
		},
	];


	/**
	 * Constructs the Danmaku object
	 *
	 * @param {import('../../scripts/ToyManager').ToyManager} toyManager - reference to the toy manager
	 */
	constructor(toyManager) {

		// call the parent constructor
		super(toyManager);

		// Monotonic id counter for outgoing comments. The widget diffs the
		// rolling list by id to discover which comments are newly arrived.
		this.nextId = 1;

		// The single socket ref this toy publishes to. A rolling, append-only
		// list of recent comments - shape:
		//   { id, text, emojis, author, authorUniqueID, createdAt }
		// We trim it to MAX_LIST so a freshly-loaded widget doesn't replay
		// ancient chat.
		this.comments = socketShallowRef(this.static.slugify('comments'), []);

		// Channel-points balances for recently-seen chatters, published for the
		// widget to read when "show points" is enabled. Same batched/debounced
		// DB pipeline the Chat box uses (ChatPointsHelper), so we don't hammer
		// the database. Shape: [{ id, points }].
		this.pointsData = socketShallowRef(this.static.slugify('pointsData'), []);
		this.chatPointsHelper = new ChatPointsHelper(this, (pointsData) => {
			this.pointsData.value = pointsData;
		});

		// listen for incoming chat messages from the chat processor
		this.handleChatMessage = this.handleChatMessage.bind(this);
		this.chatToysApp.chatProcessor.onNewChats(this.handleChatMessage);
	}


	/**
	 * Clean up when the toy is removed.
	 */
	end() {
		super.end();
		if (this.handleChatMessage)
			this.chatToysApp.chatProcessor.removeNewChatsListener(this.handleChatMessage);
		if (this.chatPointsHelper)
			this.chatPointsHelper.destroy();
	}


	/**
	 * Initialize the settings for this toy.
	 *
	 * Note: the text-style settings (fontFamily / fontSize / fontColor /
	 * fontOutline) are declared here AND mirrored in the static textSettings
	 * descriptor above - the descriptor drives the modal UI, these refs hold
	 * the live values.
	 */
	initSettings() {

		this.buildSettingsBlock({

			// --- core scroll behavior ---

			// Constant on-screen lifetime for every comment, in seconds. This
			// is the "speed" knob: lower = faster & more chaotic. Speed itself
			// is derived per-comment from width / duration, so longer comments
			// move faster (the NicoNico illusion).
			displayDuration: ref(5),

			// 'rtl' = enter from the right, scroll left (classic Danmaku).
			// 'ltr' = enter from the left, scroll right.
			direction: ref('rtl'),

			// Track allocation scan order. true = fill rows from the top down,
			// false = fill from the bottom up.
			stackFromTop: ref(true),

			// --- layout / readability ---

			// Maximum fraction of the screen height (0-100%) the comment
			// curtain is allowed to cover. Streamers rarely want the whole
			// screen used; this caps how many rows the engine creates.
			screenCoverage: ref(60),

			// Overall opacity of the comment layer (0-100%) so the model /
			// cam underneath isn't fully obscured.
			opacity: ref(85),

			// --- overflow ---

			// What to do when every legal track is busy:
			//  'despawn'   - drop the comment (better perf, no overlap)
			//  'overwrite' - print over the oldest track anyway (NicoNico hype)
			overflowMode: ref('despawn'),

			// --- chatter name / points ---

			// Show the chatter's name in front of their comment (styled with
			// the separate "Chatter Name" text group).
			showChatterName: ref(false),

			// Also show the chatter's channel-points balance after their name.
			// Only meaningful when showChatterName is on.
			showChatterPoints: ref(false),

			// --- input ---

			// Filter out command messages (those starting with "!"), exactly
			// like the Chat widget does, so commands don't fly across screen.
			filterCommands: ref(true),

			// Hard cap on simultaneously-rendered comments, purely a perf
			// guard for insane chat. The widget enforces this.
			maxOnScreen: ref(60),

			// --- text style (mirrors static textSettings) ---
			fontFamily: ref("'Open Sans', sans-serif"),
			fontSize: ref(32),
			fontColor: ref('#FFFFFF'),
			fontOutline: ref(true),

			// chatter-name text style (mirrors the 'name' textSettings group)
			nameColor: ref('#00ABAE'),
			nameOutline: ref(true),

			// --- widget placement (full screen by default) ---
			danmakuBox: shallowRef({
				x: 0,
				y: 0,
				width: 1280,
				height: 720
			}),
		});
	}


	/**
	 * Initialize the commands for this toy.
	 *
	 * Danmaku is fed entirely by ordinary chat (see handleChatMessage), so it
	 * registers no commands of its own.
	 */
	buildCommands() {
		super.buildCommands([]);
	}


	/**
	 * Handle when a new chat message comes in.
	 *
	 * Builds the minimal comment payload and appends it to the rolling socket
	 * list. All scheduling / collision / animation happens widget-side.
	 *
	 * @param {Array<Object>} chats - list of new chat messages
	 */
	handleChatMessage(chats) {

		// spread into a new array so the socket ref sees a new pointer
		const list = [...this.comments.value];

		// process each incoming chat message
		for (const chat of chats) {

			// grab the raw text
			const text = (chat.messageText || '').trim();

			// skip empty messages
			if (text === '')
				continue;

			// skip command messages if filtering is on (matches Chat widget)
			if (this.settings.filterCommands.value === true && text.startsWith('!'))
				continue;

			// skip system / logger messages - those aren't viewer comments
			if (chat.syslogger === true)
				continue;

			// append the comment payload. We forward the message's custom-emoji
			// table (YouTube / Twitch / BTTV etc.) alongside the raw text - the
			// codes are embedded in `text` as "&code;" and the widget swaps them
			// for <img> tags using this lookup. Unicode emojis need no table;
			// they're already glyphs in the text. `author` / `authorUniqueID`
			// drive the optional name + points prefix on the widget side.
			const comment = {
				id: this.nextId++,
				text,
				emojis: Array.isArray(chat.emojis) ? chat.emojis : [],
				author: chat.author,
				authorUniqueID: chat.authorUniqueID,
				createdAt: Date.now(),
			};
			list.push(comment);

			// track this chatter so their points balance gets fetched (batched
			// + debounced by the helper, so this is cheap to call always)
			this.chatPointsHelper.addMessage(comment);

		}// next chat

		// trim the rolling list so a freshly-opened widget doesn't replay
		// a huge backlog of old chat
		while (list.length > Danmaku.MAX_LIST)
			list.shift();

		// publish to the socket (single update per batch, never per frame)
		this.comments.value = list;
	}

}

/**
 * How many recent comments to retain in the rolling socket list. The widget
 * only ever animates newly-arrived ids, so this just bounds replay on load.
 *
 * @type {Number}
 */
Danmaku.MAX_LIST = 50;
