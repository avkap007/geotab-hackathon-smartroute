import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// Dev: base = '/' so localhost:517X/ works
// Build: base = GitHub Pages subpath so assets resolve correctly
export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === 'build' ? '/geotab-hackathon-smartroute/addin/dist/' : '/',
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
