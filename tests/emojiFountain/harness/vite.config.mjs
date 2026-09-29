/*
	Builds the stand-in page used by tests/emojiFountain/dance.e2e.cjs: the
	real Emoji Fountain toy + its real widget on one page.
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
		outDir: Path.join(os.tmpdir(), 'ct-emoji-dance-harness'),
		emptyOutDir: true,
		copyPublicDir: false,
		chunkSizeWarningLimit: 100000,
		rollupOptions: { input: { dance: Path.join(HERE, 'dance.html') } },
	},
});
