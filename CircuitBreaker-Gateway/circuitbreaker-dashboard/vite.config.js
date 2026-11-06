import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],

  server: {
    port: 5173,

    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true
      },

      '/health/gateway': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        rewrite: () => '/actuator/health'
      },

      '/health/product': {
        target: 'http://localhost:8081',
        changeOrigin: true,
        rewrite: () => '/actuator/health'
      },

      '/health/inventory': {
        target: 'http://localhost:8082',
        changeOrigin: true,
        rewrite: () => '/actuator/health'
      },

      '/health/recommendation': {
        target: 'http://localhost:8083',
        changeOrigin: true,
        rewrite: () => '/actuator/health'
      }
    }
  }
})

