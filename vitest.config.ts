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
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    restoreMocks: true,
    /**
     * El tope por omisión de vitest son 5 s, pensados para pruebas de cálculo.
     * Aquí la mayoría monta pantallas enteras de Ant Design, y el runner de CI
     * levanta 28 procesos a la vez sobre una máquina compartida: lo que aquí
     * tarda 200 ms allá tarda más de un segundo, y una prueba de un segundo se
     * queda sin margen. Ya cortó dos veces pruebas que no tenían nada malo.
     *
     * Veinte segundos dan aire sin tapar nada: una prueba colgada de verdad
     * sigue fallando, solo que más tarde.
     */
    testTimeout: 20_000,
  },
})
