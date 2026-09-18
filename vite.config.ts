import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { sentryVitePlugin } from '@sentry/vite-plugin'
import { writeFileSync } from 'fs'

// Versión única por build: se hornea dentro del bundle (__APP_VERSION__) y se
// escribe también a public/version.json, para que el código sepa con qué versión
// fue compilado y pueda compararla contra la versión viva del servidor.
const APP_VERSION = Date.now().toString()

// Versión que se reporta al panel de errores: el commit con el que Vercel
// construyó. Sin esto, Sentry no puede decir qué cambio introdujo un error
// aunque el repositorio esté conectado. En local no hay commit: queda 'dev'.
const COMMIT = process.env.VERCEL_GIT_COMMIT_SHA ?? 'dev'

// Los mapas de origen solo se suben cuando hay token: en local y en cualquier
// build sin credenciales, el complemento no se activa y nada falla por eso.
const subirMapasASentry = Boolean(process.env.SENTRY_AUTH_TOKEN)

const versionPlugin = () => ({
  name: 'version-file',
  buildStart() {
    writeFileSync('./public/version.json', JSON.stringify({ v: APP_VERSION }))
  },
})

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(APP_VERSION),
    __COMMIT__:      JSON.stringify(COMMIT),
  },
  plugins: [
    react(),
    versionPlugin(),
    ...(subirMapasASentry ? [sentryVitePlugin({
      org:          process.env.SENTRY_ORG     ?? 'gll-consulting',
      project:      process.env.SENTRY_PROJECT ?? 'lucia-frontend',
      authToken:    process.env.SENTRY_AUTH_TOKEN,
      release:      { name: COMMIT },
      // Los mapas se suben a Sentry y NO se publican en el sitio: quedan fuera
      // del despliegue para no exponer el código fuente.
      sourcemaps:   { filesToDeleteAfterUpload: ['./dist/**/*.map'] },
      telemetry:    false,
    })] : []),
  ],
  server: {
    port: 5173,
    strictPort: true,   // falla con error claro si 5173 está ocupado — no se mueve a 5174
    watch: {
      usePolling: true, // más confiable en Windows (NTFS no siempre dispara eventos nativos)
      interval: 300,
    },
  },
  build: {
    // Necesario para que el rastro del error apunte a la línea del código fuente
    // y no a `index-a3f9c2.js:1:48211`.
    sourcemap: subirMapasASentry,
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
