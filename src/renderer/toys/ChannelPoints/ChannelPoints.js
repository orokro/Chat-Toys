/*
	ChannelPoints.js
	----------------

	This class handles the state for the Channel Points system,
	which is really the heart of the app.

	NOTE: it does not handle the rendering, which will be the widgets.
*/

// vue
import { ref, shallowRef } from 'vue';

// our app
import ToyState from "../ToyState";

// components
import ChannelPointsPage from './ChannelPointsPage.vue';
import ChannelPointsWidget from "./ChannelPointsWidget.vue";

// main export
export default class ChannelPoints extends ToyState {

	// static info	
	static name = 'Channel Points';
	static slug = 'channelPoints';
	static desc = 'Let users occasionally earn points for watching your stream.';
	static optionsPageComponent = ChannelPointsPage;
	static themeColor = '#EED43A';
	static widgetComponents = [
		{
			component: ChannelPointsWidget,
			key: 'widgetBox',
			allowResize: true,
			lockAspectRatio: true,			
		}
	];


	/**
	 * Constructs the ChannelPoints object
	 * 
	 * @param {ToyManager} toyManager - reference to the toy manager
	 */
	constructor(toyManager) {

		// call the parent constructor
		super(toyManager, ChannelPoints.slug);

	}

	
	/**
	 * Initialize the settings for this toy
	 */
	initSettings() {

		// channel points settings
		this.buildSettingsBlock({

			claimInterval: ref(300),
			claimRandomness: ref(0),
			claimDuration: ref(60),
			pointsPerClaim: ref(100),
			maxClaims: ref(0),
			showTimerBar: ref(true),
			showClaimsRemaining: ref(true),
			showUserClaims: ref(true),
			showTextPrompt: ref(true),
			widgetColorTheme: ref('#00ABAE'),
			widgetIconId: ref('1'),
			widgetIconPath: ref('builtin/' + this.chatToysApp.assetsMgr.getFileData('1').name),
			widgetBox: shallowRef({
				x: 1280 - 150,
				y: 720 - 150,
				width: 150,
				height: 150
			}),
		});
	}


	/**
	 * Handle when an incoming command is sent to this toy
	 * 
	 * @param {String} commandSlug - the slug of the command
	 * @param {Object} msg - details about the chat message that invoked the command
	 * @param {Object} user - details about the user that invoked the command (could be dummy if not in database yet)
	 * @param {Array<String>} params - the parameters passed to the command
	 * @param {Object} handshake - object like { accept: Function, reject: Function } to accept or reject the command
	 */
	onCommand(commandSlug, msg, user, params, handshake) {

		// log it:
		console.log('Channel Points found', commandSlug, 'from', msg.author, 'with params', params);

		// accept the command which updates the database
		handshake.accept();
	}
	
}
