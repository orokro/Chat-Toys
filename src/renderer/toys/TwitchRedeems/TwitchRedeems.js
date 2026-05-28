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

		// Tasks #15-17 will:
		//  - subscribe to chatToysApp.twitchEvents 'redemption' here
		//  - look up the mapping and inject a chat-shaped command
		//  - on reject, call Helix to refund
		//
		// Scaffold stage: nothing wired yet. The empty constructor still
		// gets us settings persistence and the toy registered in the UI.
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
