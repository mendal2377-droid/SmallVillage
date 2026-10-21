import {resolve} from 'node:path';
import {defineConfig} from 'vite';

// Two pages: the rebuilt village (index.html, the front page since 21 Oct 2026) and the original app (classic.html).
export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        classic: resolve(import.meta.dirname, 'classic.html'),
      },
    },
  },
});
