# Audit: Arquitectura de Datos — GLLAPP

**Fecha:** 13 de junio de 2026 | **Rama:** `master` | **Autor:** Claude Code (auditoría automática)

---

## Resumen Ejecutivo

El frontend está bien estructurado con separación clara de responsabilidades y sin llamadas directas a base de datos. Los riesgos principales no son de arquitectura sino de **seguridad de sesión** (JWT en localStorage), **compliance PCI** (datos de tarjeta sin tokenizar) y un **patrón de URL con token** que debe eliminarse antes de escalar a más clientes.

---

## Hallazgos por Categoría

**Autenticación y sesión**
- JWT (`accessToken` + `refreshToken`) almacenados en `localStorage` — accesibles por XSS
- Refresh singleton implementado correctamente (evita race conditions)
- No hay validación en el interceptor de Axios si `X-Tenant-ID` está ausente

**Multi-tenant / Multi-empresa**
- Aislamiento por tenant delegado correctamente al backend (PostgreSQL schemas separados)
- `activeCompany` se escribe en dos lugares independientes: Zustand persist + localStorage manual — riesgo de desincronización
- No hay guard frontend que bloquee requests sin `X-Tenant-ID`

**Datos sensibles en frontend**
- Contraseña SAT (`satAgenciaPassword`) vive en estado React y se re-envía en cada importación
- Tarjeta de crédito (PAN completo + CVV) transita por el frontend sin tokenización
- Objeto `Company` completo (con NIT) serializado en `localStorage['activeCompany']`

**Exposición de datos**
- `buildExportUrl()` en `src/api/reportes.ts:293` construye URLs con `access_token` como query param — función rota pero patrón peligroso
- 5 archivos con `console.log/error` que exponen datos de facturas, NITs y respuestas de API en la consola del navegador

**Variables de entorno**
- Solo existe `VITE_API_URL` — correcto uso de prefijo `VITE_`
- `buildExportUrl` usa claves de localStorage con typo (`access_token` vs `accessToken`) — función silenciosamente inoperante

**Inventario de entidades (CRUD completo)**
- Ventas: Clientes, Facturas, Estimaciones, Notas de Crédito, Pagos, Anticipos, DTE SAT
- Compras: Proveedores, Facturas Proveedor, Órdenes de Compra, DTE SAT
- Bancos: Cuentas, Movimientos, importación de estados de cuenta
- Inventario: Artículos, Importaciones con landed cost, Almacenes, Producción
- Contabilidad: Catálogo, Asientos (solo lectura), Libro Diario, Libro Mayor
- Configuración: Usuarios, Roles, Empresas, Sucursales, Series, FEL, Integraciones
- Billing: Suscripciones, Pagos con tarjeta, Factura FEL de la suscripción

---

## Riesgos Críticos 🔴

1. **`buildExportUrl` — token en URL** (`src/api/reportes.ts:293`)
   Función que coloca el JWT como query parameter. Actualmente inoperante por typo en las keys, pero si se "corrige" expone el token en logs de servidor e historial del navegador. **Eliminar.**

2. **Datos de tarjeta sin tokenización PCI**
   PAN completo (16 dígitos) y CVV transitan desde el formulario React al backend. Para producción real necesita tokenización en el cliente (SDK de QPayPro antes del submit). Sin esto no hay PCI compliance.

3. **JWT en `localStorage`**
   Cualquier XSS o librería npm comprometida roba ambos tokens. Migrar a `httpOnly` cookies es el estándar para SPAs con datos financieros.

---

## Recomendaciones Prioritarias 🟡

1. **Eliminar `buildExportUrl`** — reemplazar cualquier uso por `exportReporte()` (ya existe en el mismo archivo, usa Axios con headers correctos)

2. **Limpiar `console.log` con datos de negocio** — 5 archivos en `src/pages/ventas/` exponen facturas y NITs en DevTools del usuario en producción

3. **Centralizar `activeCompany`** — eliminar la doble escritura en `authStore.ts:125` y dejar solo el Zustand persist de `companyStore.ts`; el interceptor de Axios leerá siempre de una fuente

4. **Guard de `X-Tenant-ID` en el interceptor** — si `tenantId` es null en una request que no sea `/auth/*`, cancelar y redirigir a login

5. **Credenciales SAT almacenadas en backend cifrado** — el frontend solo dispara `/importar`; la contraseña no debe re-enviarse en cada importación

6. **Ocultar ítem "Platform Admin" del sidebar** para usuarios que no son `isSuperAdmin`

---

## Propuesta Cloud Storage

**Recomendación: Cloudflare R2**

R2 es la opción óptima para la escala actual y proyectada (100–300 clientes PYME):

| Criterio | R2 | AWS S3 | GCS |
|---|---|---|---|
| Costo mensual plateau\* | **~$178** | ~$282 | ~$253 |
| Egress / CDN | **$0** | $9/mes | $11/mes |
| API compatible S3 | ✅ | ✅ | ❌ |
| Migración futura | Sencilla | — | Compleja |

*\*Tier M, 200 empresas, con estrategia de archivado a los 2 años.*

**Estrategia de ciclo de vida de documentos (cumplimiento SAT Art. 98):**
- **Años 0–2:** XMLs y PDFs FEL en R2 (acceso activo desde la app)
- **Mes 24:** Job automático genera ZIP estructurado `{NIT}/{año}/{mes}/` + índice Excel con UUID/NIT/monto; se notifica al cliente para descarga
- **Años 2–4:** Archivo en local del cliente (NAS / disco); la app conserva solo metadatos para reportes históricos
- **Futuro premium:** Recarga de documento archivado bajo demanda para auditorías SAT

Resultado: el storage en cloud **se estabiliza en ~10 TB** (ventana 2 años, 200 empresas Tier M) en lugar de crecer a 24 TB al año 5. Ahorro ~59% en storage.

---

## Próximos Pasos

1. **Eliminar `buildExportUrl`** en `src/api/reportes.ts` — 5 minutos, cero riesgo
2. **Limpiar `console.log` de datos fiscales** en los 5 archivos identificados — 30 minutos
3. **Tokenización de tarjeta** — coordinar con QPayPro para obtener su JS SDK de tokenización antes de activar billing en producción
4. **Implementar upload a R2** al momento de emitir/importar DTE FEL — integrar en el flujo existente de `emitirFelInvoice` y `postSatDte`
5. **Job de archivado automático a los 2 años** — exportar ZIP + índice Excel, notificar por email al cliente
