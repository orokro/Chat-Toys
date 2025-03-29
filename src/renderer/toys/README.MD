# `/src/renderer/toys/` Directory

This directory contains the logic and UI components for each "chat-toy" system in the application.

## Purpose

Rather than placing Vue components in the global `/src/renderer/components/` directory, each toy's logic and UI are colocated here. This approach keeps all related files for a single toy bundled together, making development and maintenance more streamlined.

## Structure

Each toy resides in its own folder under `/src/renderer/toys/`, and includes:

- **Raw JavaScript classes**: Contain the static logic and behavior for the toy.
- **Vue components**: Specific UI components for the toy, such as configuration pages or widgets.

## Design Pattern

Each toy class will define static members that expose the relevant Vue component constructors and keys. These include:

- `optionsPageComponent`: Vue component for the toy's options or settings page.
- `widgetComponents`: One or more Vue components that represent interactive widgets for the toy, along with their keys to find their settingsg

This design ensures all essential pieces of a toy system live side-by-side, making the codebase more modular and easier to navigate.

## Example (Pseudo-code)

```js
class CoolToy {
	static optionsPageComponent = CoolToyOptionsPage;
	static widgetComponents = [
		[CoolToyWidget, 'widgetBox']
		[AnotherWidget, 'otherBox']
	];
}
