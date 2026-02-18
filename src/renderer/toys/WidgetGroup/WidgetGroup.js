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
}
