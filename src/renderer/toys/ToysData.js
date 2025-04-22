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
import OutputLog from "./OutputLog/OutputLog";

// We'll export a list of all the constructors for the various toys
// Their classes will have the static data they need, including:
// - slug
// - name
// - description
export const toysData = [
	ChannelPoints,
	Chat,
	Media,
	Tosser,
	PrizeWheel,
	Gamba,
	HeadPat,
	StreamBuddies,
	Fishing,
	OutputLog
];

// convert the array to an object for easier access
toysData.asObject = {};
toysData.forEach(toy => {
	toysData.asObject[toy.slug] = toy;
});

// for debug also
window.toysData = toysData;
