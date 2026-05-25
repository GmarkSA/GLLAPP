import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
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
