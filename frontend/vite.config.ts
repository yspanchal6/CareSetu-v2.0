import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  base: process.env.VITE_BASE_PATH || (process.env.NODE_ENV === 'production' ? '/CareSetu/' : '/'),
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true, // Prevents Vite from picking a different port if 5173 is busy
    allowedHosts: ['.trycloudflare.com', '.loca.lt', '.ngrok-free.app', 'localhost'],
    // REMOVED the hmr block completely
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
      "/ws": {
        target: "http://localhost:3000",
        ws: true,
        changeOrigin: true,
      },
      "/socket.io": {
        target: "http://localhost:3000",
        ws: true,
        changeOrigin: true
      }
    },
  },
  preview: {
    port: 4173,
    strictPort: true,
    allowedHosts: ['.trycloudflare.com', '.loca.lt', '.ngrok-free.app', 'localhost'],
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
})