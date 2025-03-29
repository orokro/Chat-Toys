/*
	ToysData.js
	-----------

	For now this file will provide some data for the toys page.
*/

// import the various toy systems
import ChannelPoints from "./ChannelPoints/ChannelPoints";
import Chat from "./Chat/Chat";
import Media from "./Media/Media";
import Tosser from "./Tosser/Tosser";
import PrizeWheel from "./PrizeWheel/PrizeWheel";
import Gamba from "./Gamba/Gamba";
import HeadPat from "./HeadPat/HeadPat";
import StreamBuddies from "./StreamBuddies/StreamBuddies";
import Fishing from "./Fishing/Fishing";


// just the basics for now
export const toysData = [
	{
		name: "Channel Points",
		slug: "channel_points",
		desc: "Let users occasionally earn points for watching your stream.",
		constructor: ChannelPoints,
	},
	{
		name: "Chat",
		slug: "chat_box",
		desc: "Add a chat overlay to your stream.",
		constructor: Chat,
	},
	{
		name: "Media",
		slug: "media",
		desc: "Display images, GIFs, or play sounds on your stream.",
		constructor: Media,
	},
	{
		name: "Tosser",
		slug: "tosser",
		desc: "Let viewers toss objects onto your stream.",
		constructor: Tosser,
	},
	{
		name: "Prize Wheel",
		slug: "prize_wheel",
		desc: "Let viewers spin a wheel to win prizes.",
		constructor: PrizeWheel,
	},
	{
		name: "Gamba",
		slug: "gamba",
		desc: "Let viewers gamble their points.",
		constructor: Gamba,
	},
	{
		name: "Head Pat",
		slug: "head_pats",
		desc: "Let viewers receive head pats.",
		constructor: HeadPat,
	},
	{
		name: "Stream Buddies",
		slug: "stream_buddies",
		desc: "Let viewers spawn buddies on your stream.",
		constructor: StreamBuddies,
	},
	{
		name: "Fishing Mini-game",
		slug: "fishing",
		desc: "Let viewers play a fishing mini-game on your stream.",
		constructor: Fishing,
	}
];

// convert the array to an object for easier access
toysData.asObject = {};
toysData.forEach(toy => {
	toysData.asObject[toy.slug] = toy;
});

// for debug also
window.toysData = toysData;
