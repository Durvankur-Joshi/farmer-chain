import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load .env files for the current mode (reads .env, .env.local, etc.)
  // The third argument '' means load ALL env vars, not just VITE_-prefixed ones.
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react(), tailwindcss()],

    // Inject non-VITE_ environment variables into the browser bundle at build time.
    // Only public configuration values — no secrets.
    define: {
      '__ENV_API_BASE_URL__': JSON.stringify(env.API_BASE_URL || ''),
      '__ENV_FACTORY_CONTRACT__': JSON.stringify(env.FACTORY_CONTRACT || ''),
      '__ENV_CHAIN_ID__': JSON.stringify(env.CHAIN_ID || ''),
      '__ENV_NETWORK__': JSON.stringify(env.NETWORK || ''),
      '__ENV_CROP_PASSPORT_CONTRACT__': JSON.stringify(env.CROP_PASSPORT_CONTRACT || ''),
      '__ENV_ESCROW_CONTRACT_ADDRESS__': JSON.stringify(env.ESCROW_CONTRACT_ADDRESS || ''),
    },

    server: {
      proxy: {
        "/api": {
          target: "http://127.0.0.1:8000",
          changeOrigin: true,
        },
        "/socket.io": {
          target: "http://127.0.0.1:3001",
          ws: true,
          changeOrigin: true,
        },
      },
    },
  }
})
