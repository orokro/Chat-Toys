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
// VTSTosser is being merged into the original Tosser (VTS/OBS-aware tracking).
// Hidden from the registry for now (folder kept for reference). See
// misc/vts-tosser-overhaul-plan.md.
// import VTSTosser from "./VTSTosser/VTSTosser";
import VTSInteractions from "./VTSInteractions/VTSInteractions";
import PrizeWheel from "./PrizeWheel/PrizeWheel";
import Gamba from "./Gamba/Gamba";
import HeadPat from "./HeadPat/HeadPat";
import StreamBuddies from "./StreamBuddies/StreamBuddies";
import Fishing from "./Fishing/Fishing";
import OutputLog from "./OutputLog/OutputLog";
import FrequencyFinder from "./FrequencyFinder/FrequencyFinder";
import EmojiFountain from "./EmojiFountain/EmojiFountain";
import Shout from "./Shout/Shout";
import Swarm from "./Swarm/Swarm";
import KaraokeQueue from "./KaraokeQueue/KaraokeQueue";
import SCConversion from "./SCConversion/SCConversion";
import WidgetGroup from "./WidgetGroup/WidgetGroup";
import HorseRacing from "./HorseRacing/HorseRacing";
import ClawGame from "./ClawGame/ClawGame";
import Help from "./Help/Help";
import Donations from "./Donations/Donations";
import Omni from "./Omni/Omni";
import TwitchRedeems from "./TwitchRedeems/TwitchRedeems";
import Danmaku from "./Danmaku/Danmaku";

// We'll export a list of all the constructors for the various toys
// Their classes will have the static data they need, including:
// - slug
// - name
// - description
export const toysData = [
	ChannelPoints,
	OutputLog,
	Chat,
	SCConversion,
	TwitchRedeems,
	WidgetGroup,
	Shout,
	Media,
	Danmaku,
	Tosser,
	// VTSTosser,  // hidden — merging into Tosser (see misc/vts-tosser-overhaul-plan.md)
	VTSInteractions,
	PrizeWheel,
	Gamba,
	HeadPat,
	StreamBuddies,
	Fishing,
	FrequencyFinder,
	EmojiFountain,
	Swarm,
	KaraokeQueue,
	HorseRacing,
	ClawGame,
	Help,
	Donations,
	Omni,
];

// convert the array to an object for easier access
toysData.asObject = {};
toysData.forEach(toy => {
	toysData.asObject[toy.slug] = toy;
});

// for debug also
window.toysData = toysData;
