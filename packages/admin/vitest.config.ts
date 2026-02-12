import react from '@vitejs/plugin-react'
import path from 'path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@provider-logos': path.resolve(__dirname, '../../src/renderer/src/assets/images/providers'),
      '@model-logos': path.resolve(__dirname, '../../src/renderer/src/assets/images/models')
    }
  },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules', 'dist', 'src/**/*.d.ts', 'src/**/__tests__/**']
    }
  }
})
