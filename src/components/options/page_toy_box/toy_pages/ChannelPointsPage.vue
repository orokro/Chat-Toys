<!--
	ChannelPointsPage.vue
	---------------------

	This is the settings page for the channel points system.
-->
<template>

	<PageBox
		title="Channel Points"
		themeColor="rgb(255, 220, 170)"
	>
		<p>
			While optional, the Channel Points system is the best way to leverage the various other toys in this system.

			<InfoBox icon="warning">
				NOTE: if you don't have Channel Points enabled, the "Cost" field in the commands will be ignored for all other toys.
			</InfoBox>

			However, unlike other popular streaming sites, this plugin system works a bit differently. We cannot show individual redemptions on each chatters screen. (That would require every chatter to install a corresponding plugin as well as server infrastructure to handle the data.)
			<br/><br/>
			This plugin works entirely on the streamer's <i>(i.e. your)</i> computer.
			<br/><br/>
			So instead, we can periodically show a graphic on the browser-capture window that indicates it's time for users to collect points. When it's visible users can type a command such as <span class="cmd">!get</span> to have points added to their profile. Again, because we cannot store stuff in the cloud and display points on each chatters screen, instead we can show the current points via a ticker in the browser-capture window. Depending on the settings below, you can control the behavior of this system to make it more or less competitive.
			<br/><br/>
			For example, you can control:
		</p>
		<ul>
			<li>How often the opportunity to gain points is shown</li>
			<li>How long it stays on screen (regardless of users attempt to get them)</li>
			<li>How many points are given per "!points"</li>
			<li>How many users can claim the points before it disappears</li>
		</ul>
		
		<SectionHeader title="Command Triggers"/>
		<p>
			Below you can customize the commands that users can type to interact with the Channel Points system.
		</p>
		<CommandsConfigBox
			:optionsApp="optionsApp"
			:toyName="'Channel Points'"
			:toySlug="toySlug"
			:commands="commands"
		/>
			
		<p>
			Terrorize the hundred-and-twenty-pound rottweiler and steal his bed, not sorry chew on cable, so floof tum, tickle bum, jellybean footies curly toes make muffins, for wack the mini furry mouse or groom forever, stretch tongue and leave it slightly out, blep. Cough hairball on conveniently placed pants. Always hungry. Touch water with paw then recoil in horror inspect anything brought into the house, so why dog in house? i'm the sole ruler of this home and its inhabitants smelly, stupid dogs, inferior furballs time for night-hunt, human freakout or somehow manage to catch a bird but have no idea what to do next, so play with it until it dies of shock, or stand with legs in litter box, but poop outside i hate cucumber pls dont throw it at me or trip on catnip. Purr meow loudly just to annoy owners eat my own ears, yet jump off balcony, onto stranger's head and eat from dog's food. I is not fat, i is fluffy sniff all the things and eat too much then proceed to regurgitate all over living room carpet while humans eat dinner. Is good you understand your place in my world stare at the wall, play with food and get confused by dust destroy dog make it to the carpet before i vomit mmmmmm yet see brother cat receive pets, attack out of jealousy. Hopped up on catnip i love cats i am one wake up scratch humans leg for food then purr then i have a and relax for nap all day, so hit you unexpectedly. Chase the pig around the house disappear for four days and return home with an expensive injury; bite the vet spread kitty litter all over house for litter box is life, so meow. Purr spend all night ensuring people don't sleep sleep all day eat and than sleep on your face yet run outside as soon as door open chew foot. Mewl for food at 4am wake up wander around the house making large amounts of noise jump on top of your human's bed and fall asleep again yet hate dog stare out cat door then go back inside and i shredded your linens for you but curl into a furry donut if human is on laptop sit on the keyboard. Fall asleep upside-down meow go back to sleep owner brings food and water tries to pet on head, so scratch get sprayed by water because bad cat. Sit on human relentlessly pursues moth sit on human chase laser. Poop in a handbag look delicious and drink the soapy mopping up water then puke giant foamy fur-balls sleep nap yet leave fur on owners clothes. Taco cat backwards spells taco cat make muffins, for jump around on couch, meow constantly until given food, . Scratch me now! stop scratching me! purr as loud as possible, be the most annoying cat that you can, and, knock everything off the table and break lamps and curl up into a ball or really likes hummus meow sit in box soft kitty warm kitty little ball of furr. Stare at ceiling light cats are a queer kind of folk behind the couch caticus cuteicus meow go back to sleep owner brings food and water tries to pet on head, so scratch get sprayed by water because bad cat.
		</p>
		<p>
			Run outside as soon as door open dismember a mouse and then regurgitate parts of it on the family room floor get scared by sudden appearance of cucumber fight an alligator and win. Paw your face to wake you up in the morning mewl for food at 4am nap all day damn that dog but bite plants and where is my slave? I'm getting hungry yet sleep over your phone and make cute snoring noises. Attack the dog then pretend like nothing happened leave hair everywhere. Cough hairball on conveniently placed pants stare at ceiling, yet licks your face or i like big cats and i can not lie, yet please stop looking at your phone and pet me. Sitting in a box swat turds around the house cry louder at reflection. Cats woo enslave the hooman mice poop in the plant pot and swat at dog, for the dog smells bad. Push your water glass on the floor floof tum, tickle bum, jellybean footies curly toes for dream about hunting birds meow meow you are my owner so here is a dead bird spit up on light gray carpet instead of adjacent linoleum. Fall over dead (not really but gets sypathy) meow and walk away roll over and sun my belly for plan your travel. Purr when being pet purr when being pet sleep so make muffins, for jump off balcony, onto stranger's head.
		</p>
	</PageBox>

</template>
<script setup>

// vue
import { ref } from 'vue';

// components
import PageBox from '../../PageBox.vue';
import SectionHeader from '../../SectionHeader.vue';
import InfoBox from '../../InfoBox.vue';
import CommandsConfigBox from '../../CommandsConfigBox.vue';

// generate slug for command
const toySlug = 'channel_points';
const slugify = (text) => (toySlug + '_' + text.toLowerCase());

const props = defineProps({
	
	// reference to the state of the options page
	optionsApp: {
		type: Object,
		default: null
	}
});

// we'll define our commands here
// NOTE: these are the DEFAULTS, the actual commands will be loaded from storage
// in the CommandsConfigBox component
const commands = [
	{
		slug: slugify('get'),
		command: 'get',
		params: null,
		description: 'Claim points',
		enabled: true,
		costEnabled: false,
		cost: 0,
		coolDown: 0,
		groupCoolDown: 0,
	},	
	{
		slug: slugify('show'),
		command: 'me',
		params: null,
		description: 'Have on screen text show your points',
		enabled: true,
		costEnabled: false,
		cost: 0,
		coolDown: 0,
		groupCoolDown: 0,
	},
	{
		slug: slugify('give'),
		command: 'give',
		params: [
			{ name: 'user', type: 'username', optional: false, desc: 'The user to give points to' },
			{ name: 'amount', type: 'number', optional: false, desc: 'The amount of points to give' }
		],
		description: 'One user can give points to another user',
		enabled: true,
		costEnabled: true,
		cost: 0,
		coolDown: 0,
		groupCoolDown: 0,
	},
	
];

</script>
<style lang="scss" scoped>	


</style>
