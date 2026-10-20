import {resolve} from 'node:path';
import {defineConfig} from 'vite';

// Two pages: the current app (index.html) and the SmallVillage 2.0 preview (village-2027.html).
export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        village2027: resolve(import.meta.dirname, 'village-2027.html'),
      },
    },
  },
});
