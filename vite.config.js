import { defineConfig } from 'vite';

export default defineConfig({
  root: 'src',
  publicDir: '../public',
  assetsInclude: ['**/*.glb', '**/*.fbx', '**/*.obj', '**/*.tga', '**/*.wav'],
  build: {
    outDir: '../dist'
  }
});
