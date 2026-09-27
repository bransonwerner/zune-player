import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Spotify no longer accepts "localhost" redirect URIs — the loopback IP must be used.
// Production builds are served from GitHub Pages at /zune-player/.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/zune-player/' : '/',
  plugins: [react()],
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
  preview: { host: '127.0.0.1', port: 5173, strictPort: true },
}))
