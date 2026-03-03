import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    // pdfjs-dist needs this to avoid worker bundling issues
    exclude: ['pdfjs-dist']
  },
  worker: {
    format: 'es'
  }
})
