<!-- 
	CatsumIpsum.vue
	---------------

	This component is a simple component that generates "Catsum Ipsum" text.
-->
<template>

	<!-- by default we'll show paragraphs of catsum ipsum-->
	<template v-if="props.brOnly==false">		
		<template
			v-for="para, idx in paragraphs"
		>
			<!-- wrap in p tag if enaled -->
			<p v-if="props.useP" :key="idx">{{ para }}</p>

			<!-- otherwise, raw text -->
			<template v-else>{{ para }}</template>

			<!-- show br bewtween paragraphs or blocks of text? -->
			<br v-if="props.useBr" />
		</template>
	</template>

	<!-- optional mode to just show empty space -->
	<template v-else>
		<!-- generate brs for paragraphs * sentences -->
		<br v-for="i in props.paragraphs * props.sentences" :key="i" />
	</template>
</template>
<script setup>

// vue
import { ref, onMounted } from 'vue'

// lib/misc
import seedrandom from 'seedrandom';

// make some props
const props = defineProps({
	
	// the number of paragraphs to generate
	paragraphs: {
		type: Number,
		default: 1
	},

	// the number of sentences per paragraph
	sentences: {
		type: Number,
		default: 5
	},

	// seed for the random number generator
	seed: {
		type: String,
		default: null
	},

	// always use a random seed
	alwaysRandom: {
		type: Boolean,
		default: false
	},

	// use p tags
	useP: {
		type: Boolean,
		default: true
	},

	// true if we want a br tag at the end of each paragraph
	useBr: {
		type: Boolean,
		default: false
	},

	// only use BRs instead of senetences
	brOnly: {
		type: Boolean,
		default: false
	}
});

// list of paragraphs to render in the UI
const paragraphs = ref([]);

// helper to parse our large text pool
const splitTextPool = (text) => {
	return text.match(/[^.!?]+[.!?]/g) || []; // Matches sentences ending in punctuation
};

// pick random sentences from the text pool
const getRandomSentences = (sentenceList, count, rng) => {
	const selected = [];
	for (let i = 0; i < count; i++) {
		const index = Math.floor(rng() * sentenceList.length);
		selected.push(sentenceList[index].trim());
	}
	return selected;
};

// on mount, generate the paragraphs
onMounted(() => {

	// split the text pool into sentences
	const sentencesArray = splitTextPool(textPool);

	// we'll build a random number generator based on the seed
	let rng;

	// truely random model
	if (props.alwaysRandom) {
		rng = Math.random;

	// otherwise, used provided seed or determine one based on the props
	}else {
		const seedValue = props.seed !== null ? String(props.seed) : `${props.paragraphs}-${props.sentences}`;
		rng = seedrandom(seedValue);
	}

	// generate the paragraphs once on mount
	for (let i = 0; i < props.paragraphs; i++) {
		const paraSentences = getRandomSentences(sentencesArray, props.sentences, rng);
		paragraphs.value.push(paraSentences.join(' '));
	}
});

// pulled from http://www.catipsum.com/index.php
const textPool = `Demand to have some of whatever the human is cooking, then sniff the offering and walk away carrying out surveillance on the neighbour's dog cat cat moo moo lick ears lick paws ooh, are those your $250 dollar sandals? lemme use that as my litter box yet please stop looking at your phone and pet me. Thug cat pose purrfectly to show my beauty, for x scratch the furniture and hey! you there, with the hands but your pillow is now my pet bed. It's 3am, time to create some chaos please stop looking at your phone and pet me for i just saw other cats inside the house and nobody ask me before using my litter box jump around on couch, meow constantly until given food, . Damn that dog . Be a nyan cat, feel great about it, be annoying 24/7 poop rainbows in litter box all day tuxedo cats always looking dapper i is not fat, i is fluffy stare out the window, yet hey! you there, with the hands. I like cats because they are fat and fluffy sit in box to pet a cat, rub its belly, endure blood and agony, quietly weep, keep rubbing belly. Thinking longingly about tuna brine behind the couch good morning sunshine or sleep nap. Cats are the world look at dog hiiiiiisssss ask to go outside and ask to come inside and ask to go outside and ask to come inside. I could pee on this if i had the energy climb a tree, wait for a fireman jump to fireman then scratch his face or claws in your leg sit on the laptop for see brother cat receive pets, attack out of jealousy. Meow for food, then when human fills food dish, take a few bites of food and continue meowing. Stare at imaginary bug get scared by sudden appearance of cucumber bring your owner a dead bird ask to be pet then attack owners hand. Lay on arms while you're using the keyboard catching very fast laser pointer and trip owner up in kitchen i want food haha you hold me hooman i scratch yet flee in terror at cucumber discovered on floor. Caticus cuteicus if it smells like fish eat as much as you wish, or pet right here, no not there, here, no fool, right here that other cat smells funny you should really give me all the treats because i smell the best and omg you finally got the right spot and i love you right now purr when give birth steal the warm chair right after you get up. Carefully drink from water glass and then spill it everywhere and proceed to lick the puddle intently stare at the same spot meow loudly just to annoy owners. Chase the pig around the house always hungry or pooping rainbow while flying in a toasted bread costume in space so find something else more interesting, or naughty running cat, dont wait for the storm to pass, dance in the rain love you, then bite you. Slap the dog because cats rule fall asleep upside-down but found somthing move i bite it tail so ears back wide eyed so you're just gonna scroll by without saying meowdy? or hate dogs. Favor packaging over toy kitty power. Ignore the human until she needs to get up, then climb on her lap and sprawl sit in window and stare oooh, a bird, yum i could pee on this if i had the energy, run up and down stairs bite the neighbor's bratty kid decide to want nothing to do with my owner today or show belly. Get scared by doggo also cucumerro waffles sleep on keyboard relentlessly pursues moth grass smells good. Intrigued by the shower check cat door for ambush 10 times before coming in yet instantly break out into full speed gallop across the house for no reason mesmerizing birds hiding behind the couch until lured out by a feathery toy brown cats with pink ears. The dog smells bad find box a little too small and curl up with fur hanging out so head nudges fall asleep on the washing machine, brown cats with pink ears. Love me! murr i hate humans they are so annoying or chew master's slippers humans,humans, humans oh how much they love us felines we are the center of attention they feed, they clean so scratch the postman wake up lick paw wake up owner meow meow. Paw your face to wake you up in the morning dead stare with ears cocked walk on car leaving trail of paw prints on hood and windshield pretend not to be evil yet cat slap dog in face but drool i do no work yet get food, shelter, and lots of stuff just like man who lives with us. Blow up sofa in 3 seconds i do no work yet get food, shelter, and lots of stuff just like man who lives with us and purr when being pet. Kitty kitty pussy cat doll fart in owners food yet spread kitty litter all over house, intently sniff hand, yet claws in the eye of the beholder spend all night ensuring people don't sleep sleep all day. Chase after silly colored fish toys around the house climb a tree, wait for a fireman jump to fireman then scratch his face and destroy dog for love and coo around boyfriend who purrs and makes the perfect moonlight eyes so i can purr and swat the glittery gleaming yarn to him (the yarn is from a $125 sweater) eat from dog's food eat an easter feather as if it were a bird then burp victoriously, but tender, for slap kitten brother with paw. Sleep over your phone and make cute snoring noises lie on your belly and purr when you are asleep climb into cupboard and lick the salt off rice cakes hide when guests come over, yet cry louder at reflection for pee on walls it smells like breakfast. Spend six hours per day washing, but still have a crusty butthole meow to be let in. Find empty spot in cupboard and sleep all day fight own tail. Get poop stuck in paws jumping out of litter box and run around the house scream meowing and smearing hot cat mud all over. Has closed eyes but still sees you. I hate cucumber pls dont throw it at me. Taco cat backwards spells taco cat kitty power or lick left leg for ninety minutes, still dirty or where is it? i saw that bird i need to bring it home to mommy squirrel! . Put butt in owner's face white cat sleeps on a black shirt lay on arms while you're using the keyboard yet sit on human they not getting up ever. Claw your carpet in places everyone can see - why hide my amazing artistic clawing skills? human is in bath tub, emergency! drowning! meooowww! and catch eat throw up catch eat throw up bad birds headbutt owner's knee. Lasers are tiny mice meowing chowing and wowing yet taco cat backwards spells taco cat or relentlessly pursues moth hiiiiiiiiii feed me now eat grass, throw it back up, and cat walks in keyboard . Floof tum, tickle bum, jellybean footies curly toes howl uncontrollably for no reason or eat an easter feather as if it were a bird then burp victoriously, but tender yet mice. Open the door, let me out, let me out, let me-out, let me-aow, let meaow, meaow! cattt catt cattty cat being a cat cough hairball on conveniently placed pants. Swipe at owner's legs swat turds around the house. Give attitude good morning sunshine, for attack the child or thinking about you i'm joking it's food always food attempt to leap between furniture but woefully miscalibrate and bellyflop onto the floor; what's your problem? i meant to do that now i shall wash myself intently. Meoooow grab pompom in mouth and put in water dish poop on couch. Find empty spot in cupboard and sleep all day purr while eating, cats woo and destroy house in 5 seconds and climb leg, yet human clearly uses close to one life a night no one naps that long so i revive by standing on chestawaken! reaches under door into adjacent room. Your pillow is now my pet bed sit in window and stare oooh, a bird, yum poop in the plant pot, or my slave human didn't give me any food so i pooped on the floor, and gimme attention gimme attention gimme attention gimme attention gimme attention gimme attention just kidding i don't want it anymore meow bye so cats making all the muffins. Ccccccccccccaaaaaaaaaaaaaaatttttttttttttttttssssssssssssssss open the door, let me out, let me out, let me-out, let me-aow, let meaow, meaow! i dreamt about fish yum! nap all day cats secretly make all the worlds muffins i rule on my back you rub my tummy i bite you hard so find empty spot in cupboard and sleep all day. Meow to be let out meow in empty rooms licks your face, but meow cat dog hate mouse eat string barf pillow no baths hate everything, meow find a way to fit in tiny box. Drool give me attention or face the wrath of my claws decide to want nothing to do with my owner today lick butt, but enslave the hooman. Rub against owner because nose is wet love and coo around boyfriend who purrs and makes the perfect moonlight eyes so i can purr and swat the glittery gleaming yarn to him (the yarn is from a $125 sweater) or fall over dead (not really but gets sypathy), i like to spend my days sleeping and eating fishes that my human fished for me we live on a luxurious yacht, sailing proudly under the sun, i like to walk on the deck, watching the horizon, dreaming of a good bowl of milk yet poop on couch and woops poop hanging from butt must get rid run run around house drag poop on floor maybe it comes off woops left brown marks on floor human slave clean lick butt now. Eat a plant, kill a hand. Making sure that fluff gets into the owner's eyes. Find box a little too small and curl up with fur hanging out jump up to edge of bath, fall in then scramble in a mad panic to get out yet hey! you there, with the hands so eat a plant, kill a hand always hungry. Eat owner's food run around the house at 4 in the morning. Walk on car leaving trail of paw prints on hood and windshield stand in doorway, unwilling to chose whether to stay in or go out so steal mom's crouton while she is in the bathroom. Asdflkjaertvlkjasntvkjn (sits on keyboard) burrow under covers cat cat moo moo lick ears lick paws. Destroy dog. There's a forty year old lady there let us feast. Howl uncontrollably for no reason cat meoooow i iz master of hoomaan, not hoomaan master of i, oooh damn dat dog. Somehow manage to catch a bird but have no idea what to do next, so play with it until it dies of shock claw drapes destroy the blinds. I like cats because they are fat and fluffy walk on keyboard. Scratch the postman wake up lick paw wake up owner meow meow ha ha, you're funny i'll kill you last, yet stare at ceiling light and sit on the laptop stretch out on bed for sit in box so i can haz. Eat prawns daintily with a claw then lick paws clean wash down prawns with a lap of carnation milk then retire to the warmest spot on the couch to claw at the fabric before taking a catnap russian blue but throwup on your pillow, so mrow yet destroy house in 5 seconds for spend all night ensuring people don't sleep sleep all day. Find empty spot in cupboard and sleep all day. I just saw other cats inside the house and nobody ask me before using my litter box chase mice, but i shall purr myself to sleep or litter kitter kitty litty little kitten big roar roar feed me yet fish i must find my red catnip fishy fish milk the cow. Kitty poochy fight own tail eat an easter feather as if it were a bird then burp victoriously, but tender. Claw at curtains stretch and yawn nibble on tuna ignore human bite human hand sit and stare leave fur on owners clothes sleeping in the box yet hate dog. Jump launch to pounce upon little yarn mouse, bare fangs at toy run hide in litter box until treats are fed drink from the toilet so catch eat throw up catch eat throw up bad birds throw down all the stuff in the kitchen enslave the hooman. Mess up all the toilet paper have my breakfast spaghetti yarn and toilet paper attack claws fluff everywhere meow miao french ciao litterbox yet always hungry hunt anything lick yarn hanging out of own butt yet find something else more interesting. Find a way to fit in tiny box step on your keyboard while you're gaming and then turn in a circle crusty butthole i like big cats and i can not lie and what the heck just happened, something feels fishy yet stare out cat door then go back inside. Run outside as soon as door open refuse to drink water except out of someone's glass poop in a handbag look delicious and drink the soapy mopping up water then puke giant foamy fur-balls and milk the cow or cough hairball on conveniently placed pants. Chase ball of string stare at ceiling. Plan your travel kitty scratches couch bad kitty making sure that fluff gets into the owner's eyes sleep everywhere, but not in my bed. Human give me attention meow more napping, more napping all the napping is exhausting stare at ceiling. Stinky cat. Eat my own ears. Scratch leg; meow for can opener to feed me i like cats because they are fat and fluffy. Man running from cops stops to pet cats, goes to jail lies down eat too much then proceed to regurgitate all over living room carpet while humans eat dinner lick the curtain just to be annoying and lounge in doorway but catch eat throw up catch eat throw up bad birds. Kitty loves pigs pee in the shoe, pushes butt to face so break lamps and curl up into a ball demand to have some of whatever the human is cooking, then sniff the offering and walk away. Refuse to come home when humans are going to bed; stay out all night then yowl like i am dying at 4am meow for food, then when human fills food dish, take a few bites of food and continue meowing. Sniff other cat's butt and hang jaw half open thereafter give me attention or face the wrath of my claws or take a big fluffing crap ðŸ’©, when in doubt, wash, ptracy. Humans,humans, humans oh how much they love us felines we are the center of attention they feed, they clean sit in a box for hours i just saw other cats inside the house and nobody ask me before using my litter box and litter box is life, but purrrrrr taco cat backwards spells taco cat. Sun bathe eat owner's food mouse. Making bread on the bathrobe. Make it to the carpet before i vomit mmmmmm. Drink from the toilet brown cats with pink ears, cat milk copy park pee walk owner escape bored tired cage droppings sick vet vomit for love and coo around boyfriend who purrs and makes the perfect moonlight eyes so i can purr and swat the glittery gleaming yarn to him (the yarn is from a $125 sweater) yet claw drapes, yet steal the warm chair right after you get up intently stare at the same spot. Kick up litter sniff sniff loved it, hated it, loved it, hated it. Leave hair everywhere cats are cute so touch water with paw then recoil in horror for stick butt in face purr as loud as possible, be the most annoying cat that you can, and, knock everything off the table munch on tasty moths. Going to catch the red dot today going to catch the red dot today i shall purr myself to sleep and cats are the world making sure that fluff gets into the owner's eyes sit on human they not getting up ever yet do doodoo in the litter-box, clickityclack on the piano, be frumpygrumpy. Experiences short bursts of poo-phoria after going to the loo. What the heck just happened, something feels fishy meow all night having their mate disturbing sleeping humans blow up sofa in 3 seconds yet i is playing on your console hooman, yet spill litter box, scratch at owner, destroy all furniture, especially couch hunt anything that moves. Groom yourself 4 hours - checked, have your beauty sleep 18 hours - checked, be fabulous for the rest of the day - checked let me in let me out let me in let me out let me in let me out who broke this door anyway skid on floor, crash into wall and i dreamt about fish yum! for purr spit up on light gray carpet instead of adjacent linoleum. Litter kitter kitty litty little kitten big roar roar feed me caticus cuteicus or the fat cat sat on the mat bat away with paws hiss and stare at nothing then run suddenly away human give me attention meow, or i like cats because they are fat and fluffy eat a plant, kill a hand. Chase mice hate dog, murf pratt ungow ungow grab pompom in mouth and put in water dish yet hunt anything that moves. As lick i the shoes attack like a vicious monster roll on the floor purring your whiskers off but jump on human and sleep on her all night long be long in the bed, purr in the morning and then give a bite to every human around for not waking up request food, purr loud scratch the walls, the floor, the windows, the humans. Love. Eat a plant, kill a hand. Has closed eyes but still sees you. Lick arm hair open the door, let me out, let me out, let me-out, let me-aow, let meaow, meaow!. Chew on cable pee in the shoe but lasers are tiny mice scoot butt on the rug lick butt and make a weird face and sometimes switches in french and say "miaou" just because well why not. Flex claws on the human's belly and purr like a lawnmower walk on car leaving trail of paw prints on hood and windshield. Drink from the toilet kitty poochy. Only use one corner of the litter box. Jump five feet high and sideways when a shadow moves cat playing a fiddle in hey diddle diddle? touch my tail, i shred your hand purrrr but cat playing a fiddle in hey diddle diddle?. Has closed eyes but still sees you need to chase tail attempt to leap between furniture but woefully miscalibrate and bellyflop onto the floor; what's your problem? i meant to do that now i shall wash myself intently enslave the hooman for sniff other cat's butt and hang jaw half open thereafter and sleep on keyboard, or rub against owner because nose is wet. Lick the other cats push your water glass on the floor and woops poop hanging from butt must get rid run run around house drag poop on floor maybe it comes off woops left brown marks on floor human slave clean lick butt now for disappear for four days and return home with an expensive injury; bite the vet stand with legs in litter box, but poop outside. Suddenly go on wild-eyed crazy rampage claw drapes, and as lick i the shoes small kitty warm kitty little balls of fur. Run in circles i love cats i am one wake up scratch humans leg for food then purr then i have a and relax burrow under covers, or humans,humans, humans oh how much they love us felines we are the center of attention they feed, they clean kitty kitty. Meowing chowing and wowing lay on arms while you're using the keyboard or roll over and sun my belly meow. Small kitty warm kitty little balls of fur. I cry and cry and cry unless you pet me, and then maybe i cry just for fun you are a captive audience while sitting on the toilet, pet me or run off table persian cat jump eat fish but kick up litter bawl under human beds run in circles. Small kitty warm kitty little balls of fur. Ooh, are those your $250 dollar sandals? lemme use that as my litter box licks paws fart in owners food , so all of a sudden cat goes crazy. In the middle of the night i crawl onto your chest and purr gently to help you sleep stare at the wall, play with food and get confused by dust but meow all night howl uncontrollably for no reason. Stretch out on bed stand in doorway, unwilling to chose whether to stay in or go out yet swipe at owner's legs meow so cats making all the muffins. Make muffins dead stare with ears cocked disappear for four days and return home with an expensive injury; bite the vet and pee in the shoe. Shred all toilet paper and spread around the house chew master's slippers. If it smells like fish eat as much as you wish play riveting piece on synthesizer keyboard ask to go outside and ask to come inside and ask to go outside and ask to come inside, but cough hairball on conveniently placed pants. Ccccccccccccaaaaaaaaaaaaaaatttttttttttttttttssssssssssssssss purrrrrr but chase ball of string run at 3am. Leave fur on owners clothes spread kitty litter all over house why dog in house? i'm the sole ruler of this home and its inhabitants smelly, stupid dogs, inferior furballs time for night-hunt, human freakout. Scratch leg; meow for can opener to feed me sit on human while happily ignoring when being called so ignore the squirrels, you'll never catch them anyway more napping, more napping all the napping is exhausting. Sleep on dog bed, force dog to sleep on floor i am the best murder hooman toes for refuse to leave cardboard box mesmerizing birds sugar, my siamese, stalks me (in a good way), day and night . Scratch at the door then walk away this is the day , and stare out cat door then go back inside eat my own ears. Damn that dog behind the couch. Thinking longingly about tuna brine lasers are tiny mice my slave human didn't give me any food so i pooped on the floor. Eat and than sleep on your face good morning sunshine or lay on arms while you're using the keyboard licks your face. Swipe at owner's legs. I do no work yet get food, shelter, and lots of stuff just like man who lives with us being gorgeous with belly side up and gnaw the corn cob for eats owners hair then claws head but allways wanting food chase mice, and please stop looking at your phone and pet me. Favor packaging over toy. Just going to dip my paw in your coffee and do a taste test - oh never mind i forgot i don't like coffee - you can have that back now have my breakfast spaghetti yarn. Vommit food and eat it again why can't i catch that stupid red dot or run at 3am. Don't nosh on the birds pet my belly, you know you want to; seize the hand and shred it!. Chase after silly colored fish toys around the house walk on a keyboard touch water with paw then recoil in horror, for human is behind a closed door, emergency! abandoned! meeooowwww!!! and head nudges but bird bird bird bird bird bird human why take bird out i could have eaten that pee on walls it smells like breakfast. Hell is other people have secret plans. Naughty running cat fat baby cat best buddy little guy lounge in doorway friends are not food i heard this rumor where the humans are our owners, pfft, what do they know?! for slap owner's face at 5am until human fills food dish. Catto munch salmono. Attack the dog then pretend like nothing happened run up and down stairs. All of a sudden cat goes crazy find something else more interesting poop on floor and watch human clean up yet take a big fluffing crap ðŸ’© why use post when this sofa is here fish i must find my red catnip fishy fish. Adventure always make muffins, yet it's 3am, time to create some chaos and meeeeouw kitty run to human with blood on mouth from frenzied attack on poor innocent mouse, don't i look cute? but waffles. Sun bathe ask to be pet then attack owners hand eat prawns daintily with a claw then lick paws clean wash down prawns with a lap of carnation milk then retire to the warmest spot on the couch to claw at the fabric before taking a catnap and shove bum in owner's face like camera lens. Rub face on owner ask for petting so mice stand with legs in litter box, but poop outside. Meow meow fall asleep upside-down. Sit and stare sit in a box for hours, unwrap toilet paper yet stretch out on bed somehow manage to catch a bird but have no idea what to do next, so play with it until it dies of shock for purr when being pet skid on floor, crash into wall . Cat snacks stinky cat lie on your belly and purr when you are asleep.`;

</script>
<style lang="scss" scoped>

</style>
