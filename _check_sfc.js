const fs = require('fs');
const path = require('path');
const { parse, compileScript, compileTemplate } = require('@vue/compiler-sfc');

const files = [
	'src/renderer/toys/Danmaku/DanmakuWidget.vue',
	'src/renderer/toys/Danmaku/DanmakuPage.vue',
	'src/renderer/components/options/TextSettingsModal.vue',
];

let failed = false;
for (const f of files) {
	const src = fs.readFileSync(f, 'utf8');
	const { descriptor, errors } = parse(src, { filename: f });
	if (errors && errors.length) {
		console.error('PARSE ERRORS in', f, errors);
		failed = true; continue;
	}
	const id = 'x' + Math.random().toString(36).slice(2);
	try {
		if (descriptor.scriptSetup || descriptor.script) {
			compileScript(descriptor, { id });
		}
		if (descriptor.template) {
			const r = compileTemplate({
				source: descriptor.template.content,
				filename: f,
				id,
				compilerOptions: { mode: 'module' },
			});
			if (r.errors && r.errors.length) {
				console.error('TEMPLATE ERRORS in', f, r.errors);
				failed = true; continue;
			}
		}
		console.log('OK  ', f);
	} catch (e) {
		console.error('COMPILE FAIL in', f, '\n', e.message);
		failed = true;
	}
}
process.exit(failed ? 1 : 0);
