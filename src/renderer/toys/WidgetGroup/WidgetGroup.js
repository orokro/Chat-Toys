/*
	WidgetGroup.js
	--------------

	This toy allows users to group multiple other toy widgets into a single 
	consolidated widget layout using iframes.
*/

import { ref, shallowRef } from 'vue';
import Toy from "../Toy";
import GroupWidgetPage from './GroupWidgetPage.vue';
import GroupWidget from './GroupWidget.vue';

export default class WidgetGroup extends Toy {

	static name = 'Widget Group';
	static slug = 'WidgetGroup';
	static desc = 'Combine multiple widgets into one consolidated layout.';
	static optionsPageComponent = GroupWidgetPage;
	static themeColor = '#4A90E2';
	static widgetComponents = [
		{
			component: GroupWidget,
			key: 'groupWidgetBox',
			allowResize: true,
			lockAspectRatio: false,
			description: 'Displays a group of widgets in a single consolidated layout.',
			slug: 'groupLayer'
		},
	];

	// This toy is a tool, not a traditional toy, since it doesn't directly interact with chat or have its own widget. Instead, it manages groups of other widgets.
	static toyClass = 'tool';

	constructor(toyManager) {
		super(toyManager);
	}

	initSettings() {
		this.buildSettingsBlock({
			groups: shallowRef([
				{
					name: "Default Group",
					width: 1920,
					height: 1080,
					items: []
				}
			]),
			groupWidgetBox: shallowRef({
				x: 0,
				y: 0,
				width: 1920,
				height: 1080
			}),
		});
	}

	/**
	 * Overrides the base getWidgetURLs to return one for each group
	 */
	getWidgetURLs() {
		const groups = this.settings.groups.value;
		const baseURLs = super.getWidgetURLs();
		if (baseURLs.length === 0) return [];

		const result = [];
		groups.forEach((group, index) => {
			const base = baseURLs[0]; // There's only one widget component defined
			result.push({
				...base,
				url: `${base.url}&index=${index}`,
				desc: `URL for group: ${group.name}`
			});
		});

		return result;
	}
}
