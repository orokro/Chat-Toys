/*
	helpPrimitivesPlugin.js
	-----------------------

	Bundles the help-system's content primitives into a Vue plugin so
	topic SFCs don't have to manually import HelpSection / HelpLink /
	HelpTip / HelpWarning / HelpTrouble / HelpExample / HelpKbd in every
	file. Since there are likely to be 50+ topic files, the savings is
	real and the global pollution is minimal (everything is prefixed
	`Help`).

	Wired up in index.js right after createApp(MainWindow):
	  import { installHelpPrimitives } from '<path>/helpPrimitivesPlugin';
	  const app = createApp(MainWindow);
	  installHelpPrimitives(app);
	  app.mount('#app');
*/

// primitives
import HelpSection from './primitives/HelpSection.vue';
import HelpLink from './primitives/HelpLink.vue';
import HelpTip from './primitives/HelpTip.vue';
import HelpWarning from './primitives/HelpWarning.vue';
import HelpTrouble from './primitives/HelpTrouble.vue';
import HelpExample from './primitives/HelpExample.vue';
import HelpKbd from './primitives/HelpKbd.vue';


/**
 * Globally register all help content primitives on the given Vue app
 * instance. Idempotent (Vue will warn if you call it twice but won't
 * crash).
 *
 * @param {import('vue').App} app - the Vue app to register on
 */
export function installHelpPrimitives(app) {
	app.component('HelpSection', HelpSection);
	app.component('HelpLink',    HelpLink);
	app.component('HelpTip',     HelpTip);
	app.component('HelpWarning', HelpWarning);
	app.component('HelpTrouble', HelpTrouble);
	app.component('HelpExample', HelpExample);
	app.component('HelpKbd',     HelpKbd);
}
