import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Spotify no longer accepts "localhost" redirect URIs — the loopback IP must be used.
export default defineConfig({
  plugins: [react()],
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
  preview: { host: '127.0.0.1', port: 5173, strictPort: true },
})
