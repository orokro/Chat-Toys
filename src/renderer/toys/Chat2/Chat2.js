/*
	Chat2.js
	--------

	State for the next-generation Chat overlay toy.

	This is a brand-new toy, intentionally separate from the original `Chat`
	toy (see chat-theming-spec.md). The old toy stays shipping and untouched;
	this one is where the three-mode theming overhaul lands:

		- Mode 'simple' : built-in style + behavior settings (no code).
		- Mode 'custom' : the upgraded inject system (theme spec v2) with
		                  theme-declared fields rendered via our settings rows.
		- Mode 'compat' : ingest a third-party (Streamlabs) theme natively.
		                  (Harness lands in a later phase; selector is here.)

	Like the original, this class only handles STATE - rendering lives in
	Chat2Widget.vue. Incoming chat is packaged into a socket-ref'd chat log
	exactly as the original toy does, so the two can run side-by-side.
*/

// vue
import { ref, shallowRef, watch } from 'vue';
import { socketShallowRef } from 'socket-ref';

// our app
import Toy from '../Toy';
import { ChatPointsHelper } from '../Chat/ChatPointsHelper';

// theming backbone
import { parseThemeSpec, defaultFieldValues } from './themeSpec';

// components
import Chat2Page from './Chat2Page.vue';
import Chat2Widget from './Chat2Widget.vue';

// main export
export default class Chat2 extends Toy {

	// shared parity counters (mirror the original Chat toy's logic)
	static evenOddCounter = 0;
	static groupCounter = 0;
	static lastAuthorUniqueID = null;

	// static info
	static name = 'Chat 2';
	static slug = 'chat2';
	static desc = 'Next-gen chat overlay with simple / custom / compatibility theming.';
	static optionsPageComponent = Chat2Page;
	static themeColor = '#60C5F1';
	static widgetComponents = [
		{
			component: Chat2Widget,
			key: 'chatWidgetBox',
			allowResize: true,
			lockAspectRatio: false,
			description: 'Displays live chat (v2).',
			slug: 'liveChat2',
		},
	];

	// Text-style settings, grouped for the consolidated text-settings modal.
	// Keys MUST match the refs declared in initSettings(); this is purely a
	// presentation descriptor for SettingsTextRow + TextSettingsModal.
	static textSettings = [
		{
			groupKey: 'chat',
			groupLabel: 'Chat Text',
			groupDescription: 'Style for usernames and message bodies in the chat overlay.',
			fields: [
				{ key: 'chatNameColor',  label: 'Username color', type: 'color' },
				{ key: 'chatTextColor',  label: 'Text color',     type: 'color' },
				{ key: 'chatTextSize',   label: 'Font size',      type: 'number', min: 8, max: 96 },
				{ key: 'chatTextShadow', label: 'Text shadow',    type: 'boolean' },
			],
			defaults: {
				chatNameColor:  '#00ABAE',
				chatTextColor:  '#FFFFFF',
				chatTextSize:   24,
				chatTextShadow: true,
			},
		},
	];


	/**
	 * Constructs the Chat2 object.
	 *
	 * @param {import('../../scripts/ToyManager').ToyManager} toyManager - reference to the toy manager
	 */
	constructor(toyManager) {

		// call the parent constructor (runs initSettings)
		super(toyManager);

		// socket refs the widget subscribes to
		this.chatFramePath = socketShallowRef(
			this.static.slugify('chatFramePath'),
			this.getAssetPath(this.settings.chatBoxImage.value));
		this.chatLog = socketShallowRef(this.static.slugify('chatLog'), []);
		this.pointsData = socketShallowRef(this.static.slugify('pointsData'), []);

		// The theme's field values, pushed to the widget with asset-typed
		// fields resolved from stored asset IDs to served URLs (the widget
		// can't resolve IDs itself). Non-asset values pass through unchanged.
		// The raw IDs stay in settings.themeFieldValues for the asset picker.
		this.themeFieldsResolved = socketShallowRef(this.static.slugify('themeFieldsResolved'), {});

		// keep the framed-box image path in sync with the asset setting
		watch(this.settings.chatBoxImage, (value) => {
			this.chatFramePath.value = this.getAssetPath(value);
		});

		// reconcile theme field values whenever the theme text changes, so the
		// value store always has an entry for every field the theme declares
		// (new keys get defaults, removed keys are pruned, edits are kept).
		watch(this.settings.customChatTheme, () => {
			this.reconcileThemeFieldValues();
		}, { immediate: true });

		// recompute the resolved (asset-URL'd) field map for the widget whenever
		// the theme or its values change
		watch(
			[this.settings.customChatTheme, this.settings.themeFieldValues],
			() => { this.updateResolvedFieldValues(); },
			{ immediate: true, deep: true });

		// listen for incoming chat messages from the chat processor
		this.handleChatMessage = this.handleChatMessage.bind(this);
		this.chatToysApp.chatProcessor.onNewChats(this.handleChatMessage);

		// points fetcher (batches DB lookups for chatter point balances)
		this.pointsDataHelper = (pointsData) => {
			this.pointsData.value = pointsData;
		};
		this.pointsDataHelper = this.pointsDataHelper.bind(this);
		this.chatPointsHelper = new ChatPointsHelper(this, this.pointsDataHelper);
	}


	/**
	 * Clean up when the toy is removed.
	 */
	end() {
		super.end();
		this.chatToysApp.chatProcessor.removeNewChatsListener(this.handleChatMessage);
		this.chatPointsHelper.destroy();
	}


	/**
	 * Initialize the settings for this toy.
	 */
	initSettings() {

		this.buildSettingsBlock({

			// which of the three theming modes is active
			chatMode: ref('simple'),

			// behavior (shared across all modes)
			filterCommands: ref(true),
			showChatterNames: ref(true),
			showChatterPFP: ref(true),
			pfpSize: ref(32),
			messageOnNewLine: ref(true),
			showSystemMessages: ref(true),
			cachePFPImages: ref(true),
			groupUserMessages: ref(false),
			showChatterPoints: ref(true),

			// style (Mode 'simple' only)
			enableChatBoxImage: ref(false),
			chatBoxImage: ref('3'),
			chatNameColor: ref('#00ABAE'),
			chatTextColor: ref('#FFFFFF'),
			chatTextShadow: ref(true),
			chatTextSize: ref(24),

			// custom theme (Mode 'custom') - the raw theme spec v2 / v1 blob
			customChatTheme: ref(''),

			// per-theme field values (theme spec v2 `fields[]`). A flat
			// { key: value } map; reconciled from the theme's declared fields.
			themeFieldValues: ref({}),

			// widget box layout
			chatWidgetBox: shallowRef({
				x: 1280 - 300,
				y: 0,
				width: 300,
				height: 400,
			}),
		});
	}


	/**
	 * Reconcile the stored theme field values against the fields the current
	 * theme declares: keep existing values for fields that still exist, add
	 * defaults for newly-introduced fields, and drop values for fields the
	 * theme no longer declares. Writes a fresh object so the shallow socket
	 * ref on the widget side sees the change.
	 */
	reconcileThemeFieldValues() {

		// parse the active theme to learn its declared fields
		const theme = parseThemeSpec(this.settings.customChatTheme.value);
		const defaults = defaultFieldValues(theme.fields);

		// merge: defaults first, then any existing user-set value for a key
		// the theme still declares
		const prev = this.settings.themeFieldValues.value || {};
		const next = {};
		for (const key of Object.keys(defaults)) {
			next[key] = Object.prototype.hasOwnProperty.call(prev, key)
				? prev[key]
				: defaults[key];
		}

		// only write if something actually changed (avoid feedback loops)
		if (JSON.stringify(next) !== JSON.stringify(prev))
			this.settings.themeFieldValues.value = next;
	}


	/**
	 * Recompute the resolved field-value map pushed to the widget. Asset-typed
	 * fields are converted from their stored asset ID to a served URL (via
	 * getAssetPath) so themes can token-substitute an asset straight into CSS
	 * (e.g. background-image: url({myAsset})). All other field values pass
	 * through unchanged.
	 */
	updateResolvedFieldValues() {

		const theme = parseThemeSpec(this.settings.customChatTheme.value);
		const values = this.settings.themeFieldValues.value || {};

		const resolved = {};
		for (const field of theme.fields) {

			// prefer the user-set value, else the field's declared default
			const raw = Object.prototype.hasOwnProperty.call(values, field.key)
				? values[field.key]
				: field.value;

			// asset fields store an ID; resolve it to a served URL for the widget
			resolved[field.key] = (field.type === 'asset' && raw)
				? this.getAssetPath(raw)
				: raw;
		}

		this.themeFieldsResolved.value = resolved;
	}


	/**
	 * Initialize the commands for this toy. (None for now - chat is passive.)
	 */
	buildCommands() {
		// no commands
	}


	/**
	 * Handle when an incoming command is sent to this toy.
	 *
	 * @param {String} commandSlug - the slug of the command
	 * @param {Object} msg - details about the chat message that invoked the command
	 * @param {Object} user - details about the user that invoked the command
	 * @param {Array<String>} params - the parameters passed to the command
	 * @param {Object} handshake - object like { accept, reject }
	 */
	onCommand(commandSlug, msg, user, params, handshake) {
		// no commands
	}


	/**
	 * Handle when new chat messages come in.
	 *
	 * Packages each incoming chat into the smaller shape the widget renders,
	 * tracking both standard message parity and same-author group parity for
	 * alternating-row styling. (Mirrors the original Chat toy so both can run
	 * concurrently.)
	 *
	 * @param {Array<Object>} chats - list of new chat messages
	 */
	handleChatMessage(chats) {

		// spread into a new array for a fresh pointer
		const chatLogMessages = [...this.chatLog.value];

		// process each of the incoming chat messages
		for (const chat of chats) {

			// skip messages that start with ! when command filtering is on
			if (this.settings.filterCommands.value == true && chat.messageText.startsWith('!'))
				continue;

			// standard (per-message) parity
			Chat2.evenOddCounter++;
			if (Chat2.evenOddCounter > 1000000)
				Chat2.evenOddCounter = 0;

			// group parity: bump when the author differs from the last seen
			if (chat.authorUniqueID !== Chat2.lastAuthorUniqueID) {
				Chat2.groupCounter++;
				Chat2.lastAuthorUniqueID = chat.authorUniqueID;
				if (Chat2.groupCounter > 1000000) Chat2.groupCounter = 0;
			}

			// package the smaller chat object
			const chatData = {
				id: chat.id,
				author: chat.author,
				authorUniqueID: chat.authorUniqueID,
				pfpUrl: chat.authorPFPUrl,
				message: chat.messageText,
				isMember: chat.isMember,
				emojis: chat.emojis,
				syslogger: chat.syslogger,

				// standard message coloring
				isOdd: (Chat2.evenOddCounter % 2 === 1),
				moduloKey: ['a', 'b', 'c', 'd'][Chat2.evenOddCounter % 4],

				// group coloring
				isGroupOdd: (Chat2.groupCounter % 2 === 1),
				groupModuloKey: ['a', 'b', 'c', 'd'][Chat2.groupCounter % 4],
			};
			chatLogMessages.push(chatData);

			// queue a points lookup for this chatter
			this.chatPointsHelper.addMessage(chatData);
		}// next chat

		// trim the list if it's grown too long
		while (chatLogMessages.length > 100)
			chatLogMessages.shift();

		// publish to the widget
		this.chatLog.value = chatLogMessages;
	}

}
