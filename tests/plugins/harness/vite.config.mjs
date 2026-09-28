/*
	Builds the stand-in dashboard page used by tests/plugins/pluginRuntime.e2e.cjs.
	Output goes to the OS temp dir, not the repo.
*/
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import Path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const HERE = Path.dirname(fileURLToPath(import.meta.url));
const R = Path.resolve(HERE, '..', '..', '..');

export default defineConfig({
	root: HERE,
	base: './',
	publicDir: Path.join(R, 'src/renderer/public'),
	plugins: [vue()],
	resolve: { alias: {
		'@components': Path.join(R, 'src/renderer/components'),
		'@toys': Path.join(R, 'src/renderer/toys'),
		'@scripts': Path.join(R, 'src/renderer/scripts'),
		'@assets': Path.join(R, 'src/renderer/assets'),
		'@shared': Path.join(R, 'src/shared'),
		'@plugins': Path.join(R, 'src/renderer/plugins'),
	} },
	css: { preprocessorOptions: { scss: { api: 'modern', silenceDeprecations: ['legacy-js-api'] } } },
	logLevel: 'warn',
	build: {
		target: 'esnext',
		outDir: Path.join(os.tmpdir(), 'ct-plugin-runtime-harness'),
		emptyOutDir: true,
		copyPublicDir: false,
		chunkSizeWarningLimit: 100000,
		rollupOptions: { input: { dashboard: Path.join(HERE, 'dashboard.html') } },
	},
});
