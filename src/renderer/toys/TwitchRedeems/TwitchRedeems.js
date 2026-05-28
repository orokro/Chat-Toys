/*
	TwitchRedeems.js
	----------------

	Tool Toy that wires Twitch channel point redemptions into the
	existing ChatToys command pipeline. Lives in the Tool Box (not Toy
	Box) alongside other meta-systems like SCConversion.

	Lifecycle:
	  - Subscribes to TwitchEvents 'redemption' on construction (Task #15)
	  - On a redemption, looks up the mapped command via this.settings.mappings,
	    synthesizes a chat-shaped message, and shoves it into the existing
	    chat pipeline so CommandProcessor handles it just like a real
	    `!command` (Task #15)
	  - When the command rejects, calls Helix to refund the Twitch
	    channel points (Task #17)

	Scope of THIS file (Phase 3 Task #13): scaffold only - static
	metadata, settings stub, lifecycle hooks. The actual redemption
	handler / synthesis / refund land in Tasks #15 and #17.
*/

// vue
import { ref } from 'vue';

// our app
import Toy from '../Toy';

// components
import TwitchRedeemsPage from './TwitchRedeemsPage.vue';


/**
 * Tool toy that routes Twitch channel point redemptions to ChatToys
 * commands. Has no widget - configuration-only, like SCConversion.
 */
export default class TwitchRedeems extends Toy {

	// ---------- static metadata ----------

	static name = 'Twitch Redeems';
	static slug = 'twitchRedeems';
	static desc = 'Route Twitch channel point redemptions to your ChatToys commands. Map a redeem to any command and chat will fire that command on redemption.';
	static optionsPageComponent = TwitchRedeemsPage;
	static themeColor = 'darkviolet';
	static widgetComponents = [];

	// This toy is a tool, not a traditional toy - same flag SCConversion
	// uses to land in the Tool Box instead of the Toy Box.
	static isTool = true;


	/**
	 * Constructs the TwitchRedeems object.
	 *
	 * @param {import('../../scripts/ToyManager').ToyManager} toyManager
	 */
	constructor(toyManager) {

		// call the parent constructor
		super(toyManager);

		// Subscribe to the renderer-side TwitchEvents bus for redemption
		// events forwarded over IPC from TwurpleManager. Tagging with
		// this.slug means Toy.end() auto-cleans the subscription if this
		// toy ever gets disabled at runtime.
		this.handleRedemptionFn = this.handleRedemption.bind(this);
		this.chatToysApp.twitchEvents.on('redemption', this.handleRedemptionFn, this.slug);
	}


	/**
	 * Fired whenever a Twitch channel point redemption arrives from
	 * EventSub. Looks up the rewardId in our mapping, synthesizes a
	 * chat-shaped message in the same shape ChatProcessor produces for
	 * regular chat, and injects it into the existing command pipeline.
	 *
	 * Behavior matrix:
	 *   - this.settings.enabled.value === false  -> ignore
	 *   - no mapping for this rewardId          -> ignore (silent)
	 *   - mapping disabled                       -> ignore
	 *   - mapped commandSlug not in commandsRef  -> warn + ignore (config drift)
	 *   - happy path                             -> inject into CommandProcessor
	 *
	 * The synthesized message carries source:'twitch-redeem' so:
	 *   - CommandProcessor.accept() skips ChatToys point deduction
	 *     (Twitch already charged channel points on its side)
	 *   - Task #17's reject handler can identify the message and call
	 *     Helix to refund the Twitch redemption
	 *
	 * Cooldowns, member-only, and super-only are honored normally - the
	 * standard CommandProcessor.validateCommand path runs unchanged.
	 *
	 * @param {Object} event - normalized redemption payload from TwurpleManager
	 */
	handleRedemption(event) {

		// Master toggle
		if (this.settings.enabled.value === false)
			return;

		// Mapping lookup. By design we ignore unmapped redeems silently
		// so streamers can have Twitch rewards that ChatToys knows
		// nothing about coexist with mapped ones.
		const mappings = this.settings.mappings.value || [];
		const mapping = mappings.find((m) => m.rewardId === event.rewardId && m.enabled !== false);
		if (!mapping) {
			console.log(`[TwitchRedeems] No mapping for rewardId=${event.rewardId} (${event.rewardTitle}); ignoring.`);
			return;
		}

		// Resolve the command's current text - users can rename commands
		// at any time, so we look it up live rather than caching.
		const cmd = (this.chatToysApp.commands?.value || {})[mapping.commandSlug];
		if (!cmd || !cmd.command) {
			console.warn(
				`[TwitchRedeems] Mapping for "${mapping.rewardTitle}" -> "${mapping.commandSlug}" ` +
				`points at a missing command. Ignoring redemption.`,
			);
			return;
		}

		// Synthesize a message in the shape ChatProcessor produces for
		// regular chat. CommandProcessor.handleChats consumes this shape
		// directly (it's a subscriber to ChatProcessor.onNewChats, but
		// also accepts direct calls).
		const userInput = (event.input || '').trim();
		const messageText = userInput
			? `!${cmd.command} ${userInput}`
			: `!${cmd.command}`;

		const synthetic = {
			id: `twitch-redeem:${event.id}`,
			authorUniqueID: `twitch:${event.userId}`,
			author: event.userDisplayName || event.userName || 'Unknown',
			authorPFPUrl: undefined,
			messageText,
			emojis: [],
			time: Date.now(),
			// Member-only enforcement requires a Helix subscriber lookup
			// (no isSubscriber field on EventSub redemption payloads).
			// Task #16 wires that lookup in; for now defaults to false.
			isMember: false,
			streamID: 'twitch',
			isSuper: false,
			bits: 0,
			twitch: true,

			// --- Redeem-specific additions ---

			// Tells CommandProcessor.accept() to skip ChatToys point
			// deduction (see CommandProcessor._notifyListeners).
			source: 'twitch-redeem',

			// Metadata Task #17 will use to refund the Twitch redemption
			// when the command is rejected.
			_redemption: {
				id: event.id,
				rewardId: event.rewardId,
				broadcasterId: event.broadcasterId,
			},
		};

		console.log(
			`[TwitchRedeems] 🎁 Injecting "${messageText}" for redemption "${mapping.rewardTitle}" by ${synthetic.author}`,
		);

		// Inject into the command pipeline. Direct call is sufficient -
		// handleChats walks an array, matches the leading '!', validates,
		// and dispatches to the appropriate toy via toyHooks.
		try {
			this.chatToysApp.commandProcessor.handleChats([synthetic]);
		} catch (err) {
			console.error('[TwitchRedeems] handleChats threw on synthetic redeem:', err);
		}
	}


	/**
	 * Initialize the settings for this toy. Settings live in the standard
	 * RefAggregator-backed chromeShallowRef + socketShallowRef so they
	 * sync across windows like every other toy.
	 */
	initSettings() {

		this.buildSettingsBlock({

			/**
			 * Master toggle. When false, redemption events are ignored
			 * entirely (the EventSub listener still runs at the manager
			 * level - just this toy doesn't act on the events).
			 */
			enabled: ref(true),

			/**
			 * Array of redeem -> command mappings. Each entry:
			 *   {
			 *     rewardId: string,       // Twitch's canonical id (preferred lookup key)
			 *     rewardTitle: string,    // display only; titles can be renamed on Twitch
			 *     commandSlug: string,    // ChatToys command slug to fire (e.g. 'tosser__toss')
			 *     enabled: boolean,
			 *   }
			 *
			 * Stored by rewardId because Twitch lets streamers rename
			 * rewards at any time. We display the title in the UI but
			 * match on the stable id.
			 */
			mappings: ref([]),

		});
	}


	/**
	 * Clean up. Base class handles command-processor hook removal and
	 * twitchEvents.removeAllByToy(this.slug) for any event subs tagged
	 * with our slug, so this is just for any future custom teardown.
	 */
	end() {
		super.end();
	}

}
