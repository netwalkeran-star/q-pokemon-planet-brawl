import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  base: './',
  build: {
    assetsDir: '',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        brawl: resolve(__dirname, 'brawl/index.html'),
        dungeon: resolve(__dirname, 'dungeon_trial.html'),
        showcase: resolve(__dirname, 'cape_showcase.html')
      }
    }
  }
});
