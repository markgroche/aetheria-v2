import { defineConfig } from 'vite';

export default defineConfig({
  resolve: {
    alias: {
      'three/addons/': 'three/examples/jsm/'
    }
  }
});
