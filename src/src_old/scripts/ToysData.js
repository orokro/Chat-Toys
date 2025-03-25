/*
	ToysData.js
	-----------

	For now this file will provide some data for the toys page.
*/

// import the various toy systems
import DummyToy from "./toys/DummyToy";

// just the basics for now
export const toysData = [
	{
		name: "Channel Points",
		slug: "channel_points",
		desc: "Let users occasionally earn points for watching your stream.",
		constructor: DummyToy,
	},
	{
		name: "Chat",
		slug: "chat_box",
		desc: "Add a chat overlay to your stream.",
		constructor: DummyToy,
	},
	{
		name: "Media",
		slug: "media",
		desc: "Display images, GIFs, or play sounds on your stream.",
		constructor: DummyToy,
	},
	{
		name: "Tosser",
		slug: "tosser",
		desc: "Let viewers toss objects onto your stream.",
		constructor: DummyToy,
	},
	{
		name: "Prize Wheel",
		slug: "prize_wheel",
		desc: "Let viewers spin a wheel to win prizes.",
		constructor: DummyToy,
	},
	{
		name: "Gamba",
		slug: "gamba",
		desc: "Let viewers gamble their points.",
		constructor: DummyToy,
	},
	{
		name: "Head Pat",
		slug: "head_pats",
		desc: "Let viewers receive head pats.",
		constructor: DummyToy,
	},
	{
		name: "Stream Buddies",
		slug: "stream_buddies",
		desc: "Let viewers spawn buddies on your stream.",
		constructor: DummyToy,
	},
	{
		name: "Fishing Mini-game",
		slug: "fishing",
		desc: "Let viewers play a fishing mini-game on your stream.",
		constructor: DummyToy,
	}
];

// convert the array to an object for easier access
toysData.asObject = {};
toysData.forEach(toy => {
	toysData.asObject[toy.slug] = toy;
});

// for debug also
window.toysData = toysData;
