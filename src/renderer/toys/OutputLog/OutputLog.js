/*
	OutputLog.js
	------------

	This isn't really a "toy" in the sense that it doesn't really have any commands
	or interactions - but it is a critical part of the system if the user wants to
	show output from commands on screen.

	The primary purpose of this toy, therefore, is simply to provide the widget.
*/

// vue
import { ref, shallowRef, watch } from 'vue';
import { socketRef, socketShallowRef, socketShallowRefAsync, bindRef } from 'socket-ref';

// our app
import Toy from "../Toy";

// components
import OutputLogPage from './OutputLogPage.vue';
import OutputLogWidget from './OutputLogWidget.vue';

// main export
export default class OutputLog extends Toy {

	// static info	
	static name = 'Output Log';
	static slug = 'log';
	static desc = 'Show output from commands on screen, and give feed back to users on the status of their commands.';
	static optionsPageComponent = OutputLogPage;
	static themeColor = '#79AFA0';
	static widgetComponents = [
		{
			component: OutputLogWidget,
			key: 'widgetBox',
			allowResize: true,
			lockAspectRatio: false,
			description: 'Displays output from the system / commands run on screen.',
			slug: 'log'
		},	
	];


	/**
	 * Constructs the Chat object
	 * 
	 * @param {ToyManager} toyManager - reference to the toy manager
	 */
	constructor(toyManager) {

		// call the parent constructor
		super(toyManager);

		// note:
		// since we're only providing the widget, and the widget already
		// has everything it needs from it's old implementation, we don't need to
		// do anything else here.
	}


	/**
	 * Clean up
	 */
	end(){
		super.end();
	}


	/**
	 * Initialize the settings for this toy
	 */
	initSettings() {

		// output log points settings
		this.buildSettingsBlock({

			showLogBG: ref(true),
			logBGColor: ref('#FFFFFF'),
			logBGOpacity: ref(0.2),
			logTextColor: ref('#FFFFFF'),
			widgetBox: shallowRef({
				x: 1280-150-300,
				y: 720-150,
				width: 300,
				height: 150
			}),
		});
	}


	/**
	 * Initialize the commands for this toy
	 */
	buildCommands() {

		super.buildCommands([
			{
				command: 'echo',
				params: [
					{ name: 'message', type: 'string', optional: false, desc: 'A message to show in the log box' },
				],
				description: 'Adds message to log box on screen.',
			},
		]);
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

		// if we got a echo command
		if (commandSlug === 'echo') {

			// add the message to the log
			this.chatToysApp.log.msg(msg.author + ': ' + params.message);

			// we gucci
			handshake.accept();
			return;
		}
	}

}
