import { defineConfig } from 'vitest/config'

/**
 * Pruebas del frontend. El proyecto no tenía ninguna: el único control era
 * acordarse de ejecutar la comprobación de tipos antes de subir.
 *
 * Se empieza por donde más duele un error silencioso: el cálculo de líneas de un
 * documento y los permisos que deciden qué ve cada usuario.
 */
export default defineConfig({
  test: {
    environment: 'jsdom',          // varias piezas leen sessionStorage al cargarse
    include: ['src/**/*.test.{ts,tsx}'],
    restoreMocks: true,
  },
})
