/*
	useCommandWords.js
	------------------

	For widgets: the real words chat types for a toy's commands. Users can
	rename commands (and a plugin may have been given !join2), so a widget
	should never hard-code "Type !joinrace". The dashboard's Toy publishes
	the words (Toy.publishCommandWords); this reads them over the socket.

	Usage (in a widget's <script setup>):
		const { cmd } = useCommandWords('horseRacing');
		// template: Type !{{ cmd('joinrace') }} to play!
*/

import { socketShallowRefReadOnly } from '@scripts/sockets';
import { commandWordsSocketKey } from '@scripts/commandLookup';


/**
 * @param {string} toySlug - e.g. 'horseRacing'
 * @returns {{
 *   words: import('vue').ShallowRef<Object<string, {command: string, enabled: boolean, active: boolean}>>,
 *   cmd: (key: string, fallback?: string) => string
 * }}
 *   words  the published map (reactive)
 *   cmd    the word for one command key (no '!'); `fallback` (default: the
 *          key itself) until the dashboard has published
 */
export function useCommandWords(toySlug) {

	const words = socketShallowRefReadOnly(commandWordsSocketKey(toySlug), {});

	const cmd = (key, fallback = key) => {
		const w = words.value && words.value[key];
		return (w && w.command) || fallback;
	};

	return { words, cmd };
}
