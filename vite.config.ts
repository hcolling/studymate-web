import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => ({
  plugins: [react()],

  // GitHub Pages hosts the application under /studymate-web/
  // Keep the root path for local development.
  base: mode === 'production' ? '/studymate-web/' : '/',

  server: {
    port: 5173,
    strictPort: true,
  },
}))
