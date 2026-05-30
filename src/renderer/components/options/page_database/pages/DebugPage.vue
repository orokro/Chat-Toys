<!--
	DebugPage.vue
	-------------

	Dev-only home for debug tools. Only registered as a sub-tab when
	window.env.isDev is true; suppressed in production builds.

	Currently hosts:
	  - Twitch Redeem Simulator: fires synthetic redemption events into
	    chatToysApp.twitchEvents, exercising the entire downstream pipeline
	    (mapping lookup -> synthesis -> CommandProcessor -> toy.onCommand)
	    without needing a real Twitch redemption or Affiliate status.

	Future debug tools (chat traffic simulator, fake bits, fake follows,
	etc.) can land here as additional sections.
-->
<template>

	<PageBox
		title="Debug Tools"
		themeColor="darkgrey"
		themeImage="assets/bg_tiles/connection.png"
	>
		<br><br>
		<p class="devOnlyBanner">
			🔧 <strong>Dev-only.</strong> This tab is hidden in production builds.
			Tools here let you exercise ChatToys subsystems without their normal
			external triggers (Twitch redemptions, real chat messages, etc).
		</p>

		<SectionHeader title="Twitch Redeem Simulator" />

		<p>
			Fires a synthetic Twitch channel point redemption event into the
			TwitchEvents bus. Exercises the full mapping -> synthesis ->
			command-processor pipeline downstream of EventSub, without needing
			Affiliate status or real channel points.
		</p>

		<div class="simulatorBlock">

			<!-- Reward picker - either an existing mapped reward or
			     ad-hoc entry. Picking from mapped saves typing the ID
			     correctly, but ad-hoc lets you verify the "no mapping"
			     code path too. -->
			<div class="formRow">
				<label>Reward</label>
				<div class="formField">
					<select v-model="sourceMode">
						<option value="mapped">From a mapping</option>
						<option value="adhoc">Ad-hoc (test unmapped path)</option>
					</select>

					<select
						v-if="sourceMode === 'mapped'"
						v-model="selectedMappingIdx"
					>
						<option :value="-1">— pick a mapping —</option>
						<option
							v-for="(m, idx) in mappings"
							:key="idx"
							:value="idx"
						>{{ m.rewardTitle || '(untitled)' }} → {{ commandTextFor(m.commandSlug) || m.commandSlug }}</option>
					</select>

					<template v-else>
						<input
							type="text"
							v-model="adhocTitle"
							placeholder="Reward title (any string)"
						/>
						<input
							type="text"
							v-model="adhocId"
							placeholder="Reward ID (any string; must match a mapping to fire a command)"
						/>
					</template>
				</div>
			</div>

			<!-- User input - the text typed into the redeem prompt by
			     the viewer. Empty is allowed (rewards without prompts). -->
			<div class="formRow">
				<label>User input</label>
				<div class="formField">
					<input
						type="text"
						v-model="userInput"
						placeholder="Optional - what the viewer typed in the redeem prompt"
					/>
				</div>
			</div>

			<!-- Identity overrides - default to a fake "@debug" user
			     but you can change these to test against your live DB.  -->
			<div class="formRow">
				<label>Viewer name</label>
				<div class="formField">
					<input type="text" v-model="userDisplayName" placeholder="Display name" />
				</div>
			</div>
			<div class="formRow">
				<label>Viewer user ID</label>
				<div class="formField">
					<input type="text" v-model="userId" placeholder="Twitch user ID (numeric in production; anything in debug)" />
				</div>
			</div>

			<div class="formActions">
				<button class="primaryBtn" @click="fireRedeem">
					🎁 Fire Redemption
				</button>
				<button class="linkBtn" @click="clearLog">Clear log</button>
			</div>

			<div class="fireLog" v-if="log.length > 0">
				<div v-for="(entry, idx) in log" :key="idx" class="logEntry">
					<span class="logTime">{{ entry.time }}</span>
					<span class="logText">{{ entry.text }}</span>
				</div>
			</div>

		</div>

	</PageBox>

</template>
<script setup>

// vue
import { ref, computed, inject } from 'vue';

// components
import PageBox from '../../PageBox.vue';
import SectionHeader from '../../SectionHeader.vue';

// fetch the main app state context
const ctApp = inject('ctApp');

// Reach into the TwitchRedeems toy so the simulator can fire against
// the same `mappings` config the user has live. Tolerant if the toy
// isn't enabled - selectedMappingIdx stays at -1 and the user can use
// ad-hoc mode instead.
const redeemsToy = ctApp.toyManager.getToyBySlug('twitchRedeems');
const mappings = computed(() => redeemsToy?.settings?.mappings?.value || []);


// ---------------------------------------------------------------------------
// Form state
// ---------------------------------------------------------------------------

/** Either 'mapped' (pick from existing mappings) or 'adhoc' (free-form input). */
const sourceMode = ref('mapped');

/** Index into mappings[] when sourceMode === 'mapped'. -1 = none picked. */
const selectedMappingIdx = ref(-1);

/** Ad-hoc fields - used when sourceMode === 'adhoc'. */
const adhocTitle = ref('');
const adhocId = ref('');

/** Optional user input the redeemer "typed" into the prompt. */
const userInput = ref('');

/** Identity overrides - default to a synthetic debug user. */
const userDisplayName = ref('DebugUser');
const userId = ref('debug-user-1');


// ---------------------------------------------------------------------------
// Log of fired events (purely local, cleared by Clear log button)
// ---------------------------------------------------------------------------

/** @type {import('vue').Ref<Array<{time:string, text:string}>>} */
const log = ref([]);


/**
 * Look up the current display text for a command slug. Used to render
 * the "→ !command" half of mapping options. Defensive against renames.
 *
 * @param {string} slug
 * @returns {string}
 */
function commandTextFor(slug) {
	const all = ctApp.commands?.value || {};
	return all[slug]?.command || '';
}


/**
 * Build a redemption event payload matching the shape TwurpleManager
 * forwards over the `twurple-event` IPC channel, and emit it directly
 * into the TwitchEvents bus. Bypasses the IPC hop entirely - we're
 * already in the renderer where the bus lives.
 */
function fireRedeem() {

	// Resolve the reward identity based on mode
	let rewardId;
	let rewardTitle;

	if (sourceMode.value === 'mapped') {
		if (selectedMappingIdx.value < 0 || selectedMappingIdx.value >= mappings.value.length) {
			pushLog('⚠️ No mapping selected. Pick one or switch to Ad-hoc mode.');
			return;
		}
		const m = mappings.value[selectedMappingIdx.value];
		rewardId = m.rewardId;
		rewardTitle = m.rewardTitle;
	} else {
		if (!adhocTitle.value.trim() && !adhocId.value.trim()) {
			pushLog('⚠️ Ad-hoc mode needs at least a title or an ID.');
			return;
		}
		rewardTitle = adhocTitle.value.trim() || '(untitled)';
		rewardId = adhocId.value.trim() || `debug:${slugify(rewardTitle)}`;
	}

	// Payload shape matches what TwurpleManager._forwardTwurpleEvent
	// sends for 'redemption'. Keep these fields in sync if that handler
	// changes - the TwitchRedeems toy reads them by name.
	const payload = {
		id: `debug-redemption-${Date.now()}`,
		userId: userId.value || 'debug-user',
		userName: (userDisplayName.value || 'debuguser').toLowerCase(),
		userDisplayName: userDisplayName.value || 'DebugUser',
		rewardId,
		rewardTitle,
		rewardCost: 0,
		rewardPrompt: '',
		input: userInput.value || '',
		status: 'unfulfilled',
		redemptionDate: new Date().toISOString(),
		broadcasterId: 'debug-broadcaster',
	};

	// Emit directly - the bus's emit() is wired the same as the IPC
	// dispatch path, so all subscribers see this event indistinguishably
	// from a real one. The TwitchRedeems toy will pick it up, look for
	// a mapping by rewardId, and inject into CommandProcessor.
	ctApp.twitchEvents.emit('redemption', payload);

	pushLog(`🎁 Fired redemption "${rewardTitle}" (rewardId=${rewardId}, input="${payload.input}") as @${payload.userDisplayName}`);
}


/**
 * Append a timestamped entry to the simulator log. Kept short - this
 * isn't meant to be a full event history, just immediate feedback that
 * the fire button worked.
 *
 * @param {string} text
 */
function pushLog(text) {
	const now = new Date();
	const time = now.toTimeString().slice(0, 8);
	log.value = [{ time, text }, ...log.value].slice(0, 50);
}


/**
 * Clear the in-page log.
 */
function clearLog() {
	log.value = [];
}


/**
 * Tiny slug helper for synthesizing rewardIds in ad-hoc mode when the
 * user doesn't paste a real one.
 *
 * @param {string} s
 * @returns {string}
 */
function slugify(s) {
	return String(s || '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '')
		|| 'untitled';
}

</script>
<style lang="scss" scoped>

	.devOnlyBanner {
		padding: 0.75rem 1rem;
		background: #fff8d6;
		border: 1px solid #fde68a;
		border-radius: 0.5rem;
		color: #78350f;
		margin-bottom: 1.5rem;
	}


	.simulatorBlock {
		padding: 1rem 1.25rem;
		background: #f3f4f6;
		border: 1px solid #d1d5db;
		border-radius: 0.5rem;

		.formRow {
			display: flex;
			align-items: flex-start;
			gap: 1rem;
			margin-bottom: 0.75rem;

			label {
				width: 140px;
				flex-shrink: 0;
				font-weight: 600;
				padding-top: 0.4rem;
			}

			.formField {
				flex: 1;

				select, input {
					width: 100%;
					padding: 0.4rem 0.5rem;
					border: 1px solid #aaa;
					border-radius: 0.3rem;
					font-size: 0.95rem;
					background: white;
					margin-bottom: 0.4rem;

					&:focus {
						border-color: #6b7280;
						outline: none;
					}
				}
			}
		}

		.formActions {
			display: flex;
			gap: 0.75rem;
			align-items: center;
			margin-top: 0.75rem;
		}

		.primaryBtn {
			background: #4b5563;
			color: white;
			padding: 0.5rem 1.25rem;
			border: none;
			border-radius: 0.4rem;
			font-weight: 600;
			cursor: pointer;

			&:hover { background: #374151; }
		}

		.linkBtn {
			background: transparent;
			color: #4b5563;
			border: none;
			text-decoration: underline;
			cursor: pointer;
			padding: 0.25rem 0;
			font-size: 0.85rem;

			&:hover { color: #1f2937; }
		}

		.fireLog {
			margin-top: 1rem;
			background: #1f2937;
			color: #d1d5db;
			border-radius: 0.4rem;
			padding: 0.6rem 0.85rem;
			font-family: 'Courier New', Courier, monospace;
			font-size: 0.85rem;
			max-height: 240px;
			overflow-y: auto;

			.logEntry {
				display: flex;
				gap: 0.6rem;
				padding: 0.15rem 0;

				.logTime {
					color: #6b7280;
					flex-shrink: 0;
				}
				.logText {
					flex: 1;
				}
			}
		}
	}

</style>
