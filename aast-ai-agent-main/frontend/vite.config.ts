import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    strictPort: false,
    watch: {
      ignored: [
        '**/.git/**',
        '**/node_modules/**',
        '**/dist/**',
        '**/coverage/**',
        '**/*.log',
        '**/frontend/college-decision-system-backend/**',
        '**/frontend/aast-ai-agent-main/**',
      ],
    },
    hmr: {
      overlay: false,
    },
    proxy: {
      '/api': {
        target: 'http://localhost:8004',
        changeOrigin: true,
      },
    },
  },
  clearScreen: false,
  optimizeDeps: {
    include: ["react-force-graph"],
    exclude: ["@qdrant/js-client-rest", "chromadb"],
  },
  build: {
    sourcemap: false,
    chunkSizeWarningLimit: 1200,
  },
})
