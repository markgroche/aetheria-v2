import { defineConfig } from 'vite';
export default defineConfig({
base: '/aetheria-v2/',
resolve: { alias: { 'three/addons/': 'three/examples/jsm/' } }
});
