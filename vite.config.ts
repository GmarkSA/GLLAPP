import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { writeFileSync } from 'fs'

const versionPlugin = () => ({
  name: 'version-file',
  buildStart() {
    writeFileSync('./public/version.json', JSON.stringify({ v: Date.now() }))
  },
})

export default defineConfig({
  plugins: [react(), versionPlugin()],
  server: {
    port: 5173,
    strictPort: true,   // falla con error claro si 5173 está ocupado — no se mueve a 5174
    watch: {
      usePolling: true, // más confiable en Windows (NTFS no siempre dispara eventos nativos)
      interval: 300,
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('framer-motion'))             return 'vendor-motion'
            if (id.includes('antd') || id.includes('@ant-design')) return 'vendor-antd'
            if (id.includes('react-dom') || id.includes('react-router')) return 'vendor-react'
            if (id.includes('react'))                     return 'vendor-react'
            if (id.includes('axios') || id.includes('zustand') || id.includes('dayjs')) return 'vendor-utils'
            return 'vendor-misc'
          }
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
})
