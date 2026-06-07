<!--
	Chat2Widget.vue
	---------------

	Live chat overlay for the next-gen Chat toy.

	Renders the socket-ref'd chat log into framed rows. The theming behavior is
	mode-aware (driven by the `chatMode` setting):

		- simple : built-in colors + no-code box/row backgrounds (none / 9-slice
		           / tiled), message spacing, entry animations and hide-after.
		- custom : a ChatToys theme (spec v2 / legacy v1) supplies the injected
		           CSS + per-slot HTML; the built-in visuals step aside so the
		           theme fully owns style. Field values token-substitute via
		           {fieldKey}.
		- compat : reserved for the Streamlabs harness (later phase); falls back
		           to the simple render so nothing breaks in the meantime.

	Rows render inside a <TransitionGroup> so new messages play their CSS entry
	animation (only after mount, never the whole backlog) and expired messages
	fade out on leave.
-->
<template>

	<!-- injected theme styles (custom mode only) -->
	<div ref="styleInjector"></div>

	<!-- the main box -->
	<div
		v-if="ready"
		class="chatBoxWidget"
		:class="{
			demoMode: demoMode,
			showTextShadow: socketSettingsRef?.chatTextShadow,
			showChatterPoints: socketSettingsRef?.showChatterPoints,
			hasPFP: socketSettingsRef?.showChatterPFP,
			noPFP: !socketSettingsRef?.showChatterPFP,
		}"
		:style="boxStyle"
	>
		<TransitionGroup tag="div" class="messageText" name="chatRow">
			<div
				v-for="message in displayedChat"
				:key="message.id"
				class="msgRow"
				:class="{
					isSystem: message.syslogger,
					isMember: message.isMember,
					isSuper: message.isSuper,
					isOdd: message.isOdd,
					isEven: !message.isOdd,
					star1: message.moduloKey == 'a',
					star2: message.moduloKey == 'b',
					star3: message.moduloKey == 'c',
					star4: message.moduloKey == 'd',
				}"
				:style="rowStyle"
			>

				<!-- Profile Picture -->
				<div class="pfp-aligner">
					<PfpImg
						v-if="socketSettingsRef?.showChatterPFP"
						:url="message.pfpUrl"
						:alt="message.author + ' profile picture'"
						:cache-enabled="socketSettingsRef?.cachePFPImages"
					/>
					<div v-html="injects.pfpInjects"></div>
				</div>

				<div
					class="message-contents"
					:class="{ inline: !socketSettingsRef?.messageOnNewLine }"
				>
					<div v-html="injects.contentsInjects"></div>
					<span
						v-if="socketSettingsRef?.showChatterNames"
						class="user"
						:class="{ isMember: message.isMember }"
						:style="{ color: socketSettingsRef?.chatNameColor }"
					>
						{{ message.author }}<span class="colon">:</span><span class="points">{{ getUserPoints(message.authorUniqueID) }}</span>
						<span v-html="injects.userNameInjects"></span>
					</span>
					<br v-if="socketSettingsRef?.messageOnNewLine && socketSettingsRef?.showChatterNames" />
					<span :style="{ color: socketSettingsRef?.chatTextColor }">
						<ParsedMessage
							:text="message.message"
							:emojis="message.emojis"
						/>
					</span>
					<div v-html="injects.messageBodyInjects"></div>
				</div>

				<div v-html="injects.chatRowInjects"></div>
			</div>
		</TransitionGroup>
	</div>

</template>
<script setup>

// vue
import { ref, shallowRef, watch, computed, onBeforeUnmount } from 'vue';
import { socketShallowRefReadOnly } from 'socket-ref';

// our settings system
import { useToySettings } from '@toys/useToySettings';
import { keepAliveSocket } from '../keepAliveSocket.js';

// theming backbone
import { parseThemeSpec, substituteTokens, EMPTY_INJECTS } from './themeSpec';
import { frameStyle } from '../../components/options/nineSlice';

// components (reuse the original Chat sub-components)
import PfpImg from '../Chat/sub_components/PfpImg.vue';
import ParsedMessage from '../Chat/sub_components/ParsedMessage.vue';

const thisSlug = 'chat2';
const widgetSlug = 'liveChat2';

/**
 * Build a per-toy socket key (mirrors Toy.slugify on the state side).
 *
 * @param {String} text - the short key
 * @returns {String} the namespaced socket key
 */
const slugify = (text) => {
	return thisSlug + '__' + text.toLowerCase();
};

// set up our live-light heartbeat
keepAliveSocket(thisSlug, widgetSlug);

const emit = defineEmits(['boxChange']);

// gets our settings
const ready = ref(false);
const socketSettingsRef = useToySettings('chat2', 'chatWidgetBox', emit, () => {
	ready.value = true;
});

// live sockets from the toy state
const demoMode = socketShallowRefReadOnly('demoMode', false);
const chatLog = socketShallowRefReadOnly(slugify('chatLog'), '');
const chatFramePath = socketShallowRefReadOnly(slugify('chatFramePath'), null);
const chatRowFramePath = socketShallowRefReadOnly(slugify('chatRowFramePath'), null);
const pointsData = socketShallowRefReadOnly(slugify('pointsData'), null);

// theme field values with asset IDs already resolved to URLs (toy-side)
const resolvedFields = socketShallowRefReadOnly(slugify('themeFieldsResolved'), {});


// grouped-or-not chat log (group consecutive messages from the same author)
const chatLogC = computed(() => {

	if (socketSettingsRef.value?.groupUserMessages) {
		const groupedMessages = [];
		let lastAuthorID = null;

		for (const message of chatLog.value) {
			if (message.authorUniqueID === lastAuthorID) {
				const lastMessage = groupedMessages[groupedMessages.length - 1];
				lastMessage.message += '\n' + message.message;
				if (message.emojis && message.emojis.length > 0)
					lastMessage.emojis = lastMessage.emojis.concat(message.emojis);
			} else {
				groupedMessages.push({
					...message,
					isOdd: message.isGroupOdd,
					moduloKey: message.groupModuloKey,
				});
				lastAuthorID = message.authorUniqueID;
			}
		}
		return groupedMessages;
	}

	return chatLog.value;
});


// map points array -> { id: entry } for quick lookups
const pointsDataMap = computed(() => {
	const map = {};
	if (pointsData.value) {
		for (const entry of pointsData.value)
			map[entry.id] = entry;
	}
	return map;
});


// --- demo mode (sample messages when app-wide demo mode is on) ---
const demoChat = shallowRef([]);
let demoInterval = 0;
watch(demoMode, (newVal) => {

	if (newVal) {
		demoInterval = setInterval(() => {
			const chatItems = [...demoChat.value];
			chatItems.push({
				id: Math.floor(Math.random() * 1000000),
				author: ['Dude', 'Demo Girl', 'Buddy4Real', 'gOOber', 'sn@rk'][Math.floor(Math.random() * 5)],
				message: ['Hi hi', 'Whats up', 'I love this', 'tuesday', 'true', 'no u'][Math.floor(Math.random() * 6)],
				isMember: false,
			});
			while (chatItems.length > 10)
				chatItems.shift();
			demoChat.value = chatItems;
		}, 1000);
	} else {
		clearInterval(demoInterval);
		demoChat.value = [];
	}
});


// --- built-in (no-code) visuals: only in non-custom modes ---

// custom theme mode owns all visual style; built-in visuals step aside
const useBuiltinStyle = computed(() => socketSettingsRef.value?.chatMode !== 'custom');

// the chat box style: font/pfp/spacing/animation CSS vars + box frame
const boxStyle = computed(() => {
	const s = socketSettingsRef.value || {};
	const style = {
		'--fontSize': (s.chatTextSize ?? 24) + 'px',
		'--pfpSize': (s.pfpSize ?? 32) + 'px',
	};
	if (!useBuiltinStyle.value)
		return style;

	style['--rowGap'] = (s.messageSpacing ?? 0) + 'px';
	style['--animName'] = (s.messageAnimation && s.messageAnimation !== 'none') ? s.messageAnimation : 'none';
	style['--animDur'] = (s.messageAnimationDuration ?? 300) + 'ms';
	style['--animEase'] = s.messageAnimationEasing || 'ease-out';

	return {
		...style,
		...frameStyle({
			mode: s.chatBoxImageMode,
			url: chatFramePath.value,
			scale: s.chatBoxImageScale,
			config: s.chatBoxImageSlice,
		}),
	};
});

// the per-row background frame (same for every row)
const rowStyle = computed(() => {
	if (!useBuiltinStyle.value)
		return {};
	const s = socketSettingsRef.value || {};
	return frameStyle({
		mode: s.chatRowImageMode,
		url: chatRowFramePath.value,
		scale: s.chatRowImageScale,
		config: s.chatRowImageSlice,
	});
});


// --- message list + hide-after-time ---

// the source list (grouped live log, or demo messages)
const baseChat = computed(() => demoMode.value ? demoChat.value : chatLogC.value);

// remember when each message id was first seen, so we can expire it later
const firstSeen = new Map();

/**
 * Record first-seen timestamps for current ids and prune ids that have
 * scrolled out of the log (keeps the map from growing unbounded).
 *
 * @param {Array<Object>} list - the current source messages
 */
function syncFirstSeen(list) {
	const ids = new Set();
	const t = Date.now();
	for (const m of list) {
		ids.add(m.id);
		if (!firstSeen.has(m.id)) firstSeen.set(m.id, t);
	}
	for (const id of [...firstSeen.keys()]) {
		if (!ids.has(id)) firstSeen.delete(id);
	}
}
watch(baseChat, (v) => syncFirstSeen(v || []), { immediate: true });

// a coarse clock that drives hide-after re-evaluation
const now = ref(Date.now());
const nowTick = setInterval(() => { now.value = Date.now(); }, 500);

// the actually-rendered list: system-message filtered + hide-after expired
const displayedChat = computed(() => {
	let list = baseChat.value || [];

	// hide system messages when the setting is off
	if (!socketSettingsRef.value?.showSystemMessages)
		list = list.filter((m) => !m.syslogger);

	// fade/remove messages older than the hide-after window (non-custom only)
	if (useBuiltinStyle.value && socketSettingsRef.value?.hideAfterEnabled) {
		const ttl = (socketSettingsRef.value?.hideAfterSeconds || 0) * 1000;
		const t = now.value;
		list = list.filter((m) => {
			const seen = firstSeen.get(m.id);
			return seen === undefined || (t - seen) < ttl;
		});
	}

	return list;
});


// --- theme parsing + token substitution (custom mode only) ---

// the active theme parsed from the raw textarea blob
const parsedTheme = computed(() => parseThemeSpec(socketSettingsRef.value?.customChatTheme));

// only custom mode applies an injected theme; other modes render plain
const themeActive = computed(() => socketSettingsRef.value?.chatMode === 'custom');

// the per-theme field values (asset IDs already resolved to URLs toy-side);
// fall back to the raw settings map if the resolved socket hasn't arrived yet
const fieldValues = computed(() =>
	resolvedFields.value || socketSettingsRef.value?.themeFieldValues || {});

// the HTML inject slots, with {fieldKey} tokens substituted from field values
const injects = computed(() => {

	if (!themeActive.value)
		return { ...EMPTY_INJECTS };

	const src = parsedTheme.value.injects;
	const out = {};
	for (const slot of Object.keys(EMPTY_INJECTS))
		out[slot] = substituteTokens(src[slot] || '', fieldValues.value);
	return out;
});

// write the (token-substituted) CSS into the scoped style holder
const styleInjector = ref(null);
watch([injects, parsedTheme, themeActive, styleInjector], () => {

	if (!styleInjector.value)
		return;

	const css = themeActive.value
		? substituteTokens(parsedTheme.value.injects.styleInjects || '', fieldValues.value)
		: '';

	// build a real style element rather than innerHTML'ing a tag string, so
	// CSS is never HTML-parsed and the SFC source carries no literal style tag
	const styleEl = document.createElement('style');
	styleEl.textContent = css;
	styleInjector.value.replaceChildren(styleEl);
}, { immediate: true });


/**
 * Format a chatter's point balance for display next to their name.
 *
 * @param {String} userID - the chatter's unique id
 * @returns {String} like " ₱ 500", or '' when unknown
 */
function getUserPoints(userID) {
	const pdMap = pointsDataMap.value;
	if (!pdMap || !pdMap[userID])
		return '';
	return ` ₱ ${pdMap[userID].points}`;
}


// tidy up timers on unmount
onBeforeUnmount(() => {
	clearInterval(nowTick);
	if (demoInterval) clearInterval(demoInterval);
});

</script>
<style lang="scss">

	// --- message entry / leave animations (global keyframes) ---
	@keyframes chat2FadeIn { from { opacity: 0; } to { opacity: 1; } }
	@keyframes chat2SlideUp { from { transform: translateY(16px); } to { transform: translateY(0); } }
	@keyframes chat2SlideFade { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
	@keyframes chat2Pop { from { opacity: 0; transform: scale(0.6); } to { opacity: 1; transform: scale(1); } }
	@keyframes chat2FadeOut { from { opacity: 1; } to { opacity: 0; } }

	// the main box for the widget
	.chatBoxWidget {

		// fill parent
		width: 100%;
		height: 100%;

		// reset stacking context
		position: relative;

		// the box background frame (border-image / tile) is applied inline via
		// frameStyle; box-sizing keeps any frame border inside the bounds
		box-sizing: border-box;

		transition: transform 0.25s ease-in-out;
		transform: scale(1);
		&.idle {
			transform: scale(0);
		}

		// faint outline so an empty box is visible while demoing
		&.demoMode {
			outline: 1px dashed rgba(255, 255, 255, 0.4);
			outline-offset: -1px;
		}

		&.showTextShadow {
			.messageText {
				text-shadow: 0.05em 0.05em 0px black;
			}
		}

		// text settings
		.messageText {

			// fixed inside frame
			position: absolute;
			inset: 0px;

			color: white;

			font-size: var(--fontSize);
			font-weight: bold;
			text-align: left;

			// clip overflow with no scroll bars
			overflow: hidden;

			// stack rows so new messages are at the bottom
			display: flex;
			flex-direction: column;
			justify-content: flex-end;

			// configurable gap between rows
			gap: var(--rowGap, 0px);

			// one of the message rows
			.msgRow {

				padding: 4px 8px;

				display: flex;
				flex-direction: row;
				justify-content: flex-start;

				// entry animation (driven by box CSS vars; 'none' = instant)
				animation-name: var(--animName, none);
				animation-duration: var(--animDur, 0s);
				animation-timing-function: var(--animEase, ease);
				animation-fill-mode: both;

				// wrapper to align PFP
				.pfp-aligner {
					display: flex;
					align-items: center;
					justify-content: center;
					margin-right: 8px;
				}

				.pfp-container {
					height: var(--pfpSize) !important;
					width: var(--pfpSize) !important;
					margin-right: 8px;
					border-radius: 100px;
					vertical-align: middle;
					overflow: hidden;

					.chat-pfp {
						height: var(--pfpSize) !important;
						width: var(--pfpSize) !important;
					}
				}

				// to separate from the PFP
				.message-contents {

					&.inline {
						display: flex;

						.message-body {
							display: inline-block;
							margin-left: 12px;
						}
					}

					.user {
						margin-bottom: 0px;

						.points {
							color: green;
							font-style: italic;
							margin-left: 10px;
							display: none;
						}
					}
				}// .message-contents

			}// .msgRow

			// hide-after leave: fade the row out, then TransitionGroup removes it.
			// Scoped tightly so it outranks the base .msgRow animation longhands.
			.msgRow.chatRow-leave-active {
				animation: chat2FadeOut var(--animDur, 300ms) ease forwards;
			}
			.chatRow-move {
				transition: transform 0.3s ease;
			}

		}// .messageText

		&.showChatterPoints {
			.msgRow {
				.message-contents {
					.user {
						.points {
							display: initial;
						}
					}
				}
			}
		}// .showChatterPoints

	}// .chatBoxWidget

</style>
