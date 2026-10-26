import react from '@vitejs/plugin-react'
import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // loadEnv reads .env files as well as the shell; process.env alone would ignore .env.local.
  const env = loadEnv(mode, process.cwd(), '')
  const proxy = { '/api': env.VITE_API_PROXY_TARGET || 'http://localhost:5080' }

  return {
    plugins: [react()],
    // `vite preview` doesn't inherit the dev server's proxy, so both are set explicitly.
    server: { proxy },
    preview: { proxy },
    test: {
      environment: 'jsdom',
      setupFiles: './src/test/setup.js',
    },
  }
})
