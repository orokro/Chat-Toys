/*
	Omni.js
	-------

	"Omni widget" - lets the streamer combine multiple alert-style toys into
	a single OBS browser source that serializes their displays through one
	visual slot. Modeled on the Group widget pattern: the streamer configures
	N omni groups, each gets its own URL, and each renders an iframe stack of
	the toys it includes.

	No state animation, no namespace mirroring, no claim mechanism. The
	mechanism is just *gating*: each included alert toy's StateTickerQueue is
	wired with a `canFire` callback that consults this omni's
	`isBusyExcept(toySlug)`. If any *other* toy in the same group is currently
	showing, the asking toy holds its fire until the slot clears. Toys keep
	full ownership of their state + animation logic; the omni only paces.

	The Omni widget itself is a dumb container - all iframes stay mounted at
	all times (alert widgets are transparent when idle), and rendering happens
	in whichever iframe's toy is currently firing. Because the toys' refs
	drive both standalone + omni-iframe subscribers in unison, both render at
	the same time (standalone is in effect paced by the omni when one is
	configured, which is the intended behavior).

	Overlap is prevented by the page UI's drag-and-drop pool model: each toy
	can physically only be in one group's drop box at a time. If something
	slips through (registry-level overlap), last-registered wins.
*/

import { ref, shallowRef, watch } from 'vue';
import { v4 as uuidv4 } from 'uuid';

import Toy from '../Toy';
import OmniPage from './OmniPage.vue';
import OmniWidget from './OmniWidget.vue';


export default class Omni extends Toy {

	static name = 'Omni Widget';
	static slug = 'omni';
	static desc = 'Bundle multiple alert-style widgets (donations, shouts, tips, media, etc.) into a single OBS browser source that takes turns showing them.';
	static optionsPageComponent = OmniPage;
	static themeColor = '#7B2CBF';
	static widgetComponents = [
		{
			component: OmniWidget,
			key: 'widgetBox',
			allowResize: true,
			lockAspectRatio: false,
			description: 'A bundle of alert-style widgets sharing a single on-screen slot.',
			slug: 'group',
		},
	];

	// Tools tab: no chat commands. Reacts only by orchestrating other toys.
	static toyClass = 'tool';


	/**
	 * @param {import('../../scripts/ToyManager').ToyManager} toyManager
	 */
	constructor(toyManager) {

		super(toyManager);

		// Register included toys in the OmniRegistry. We re-register on every
		// settings change so adding / removing toys from a group takes effect
		// immediately. Unregistration during cleanup is symmetric in end().
		this.applyRegistrations();

		this.stopGroupsWatch = watch(this.settings.omniGroups, () => {
			this.applyRegistrations();
		}, { deep: true });
	}


	/**
	 * Initial settings. `omniGroups` is the WidgetGroup-style array of
	 * configured omni instances; each has its own URL via getWidgetURLs().
	 * Defaults to a single empty group so the streamer has something to
	 * drop toys into without having to click "add group" first.
	 */
	initSettings() {

		this.buildSettingsBlock({

			// Array of omni groups. Each entry shape:
			//   { id: uuid, name: string, includedToys: [toySlug, ...] }
			omniGroups: shallowRef([
				{
					id: uuidv4(),
					name: 'Omni Group 1',
					includedToys: [],
				},
			]),

			widgetBox: shallowRef({
				x: 0, y: 0, width: 600, height: 200,
			}),
		});
	}


	/**
	 * No chat commands - the omni is pure orchestration.
	 */
	buildCommands() {
		super.buildCommands([]);
	}


	/**
	 * (Re)wire the OmniRegistry to reflect the current omniGroups settings.
	 * Idempotent. Unregisters any toy slug we previously claimed but isn't
	 * in any current group, then registers all current group members.
	 *
	 * Stores the slug → groupId mapping internally so isBusyExcept() can
	 * scope its check to the right group.
	 */
	applyRegistrations() {

		const registry = this.chatToysApp.omniRegistry;
		const groups = this.settings.omniGroups.value || [];

		// Build new slug -> groupId map.
		const nextMap = new Map();
		for (const g of groups) {
			for (const slug of (g.includedToys || [])) {
				nextMap.set(slug, g.id);
			}
		}

		// Drop registrations for any slug we previously owned but no longer do.
		if (this._registeredSlugs) {
			for (const slug of this._registeredSlugs) {
				if (!nextMap.has(slug)) registry.unregister(slug, this);
			}
		}

		// Register (or re-register) every current slug.
		for (const slug of nextMap.keys()) {
			registry.register(slug, this);
		}

		this._slugToGroupId = nextMap;
		this._registeredSlugs = new Set(nextMap.keys());
	}


	/**
	 * The gate the OmniRegistry consults on behalf of an alert toy's
	 * StateTickerQueue. Returns true if any OTHER toy in the same omni
	 * group is currently displaying.
	 *
	 * @param {string} askingToySlug
	 * @returns {boolean}
	 */
	isBusyExcept(askingToySlug) {

		const groupId = this._slugToGroupId?.get(askingToySlug);
		if (!groupId) return false;

		const groups = this.settings.omniGroups.value || [];
		const group = groups.find(g => g.id === groupId);
		if (!group) return false;

		const toys = this.chatToysApp?.toyManager?.toys || {};
		for (const slug of (group.includedToys || [])) {
			if (slug === askingToySlug) continue;
			const toy = toys[slug];
			if (toy && typeof toy.isShowing === 'function' && toy.isShowing()) {
				return true;
			}
		}
		return false;
	}


	/**
	 * Build one widget URL per configured omni group. Mirrors the
	 * WidgetGroup pattern - each group is independently placeable in OBS.
	 *
	 * @returns {Array<{ url:string, desc:string, toySlug:string, widgetSlug:string }>}
	 */
	getWidgetURLs() {

		const baseURLs = super.getWidgetURLs();
		if (baseURLs.length === 0) return [];

		const groups = this.settings.omniGroups.value || [];
		const base = baseURLs[0];

		return groups.map(group => ({
			...base,
			url: `${base.url}&omniGroupId=${group.id}`,
			desc: `Omni group: ${group.name || group.id}`,
		}));
	}


	/**
	 * Find the group descriptor for a given group id. Convenience for the
	 * widget side when it pulls its group out of the settings array.
	 *
	 * @param {string} groupId
	 * @returns {?Object}
	 */
	getGroup(groupId) {
		const groups = this.settings.omniGroups.value || [];
		return groups.find(g => g.id === groupId) || null;
	}


	/** Cleanup. */
	end() {
		super.end();
		if (this.stopGroupsWatch) {
			this.stopGroupsWatch();
			this.stopGroupsWatch = null;
		}
		// Drop any outstanding registrations so other systems don't keep
		// gating against a torn-down omni.
		if (this._registeredSlugs) {
			const registry = this.chatToysApp?.omniRegistry;
			for (const slug of this._registeredSlugs) {
				registry?.unregister(slug, this);
			}
			this._registeredSlugs = null;
		}
	}
}
