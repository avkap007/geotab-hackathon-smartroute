import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { viteStaticCopy } from 'vite-plugin-static-copy'

// Dev: base = '/' so localhost:517X/ works
// Build: base = GitHub Pages subpath so assets resolve correctly
export default defineConfig(({ command }) => ({
  plugins: [
    react(),
    viteStaticCopy({
      targets: [
        {
          src: '../backend/smartroute-algo.js',
          dest: '.',
        },
      ],
    }),
  ],
  base: command === 'build' ? './' : '/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
}))
