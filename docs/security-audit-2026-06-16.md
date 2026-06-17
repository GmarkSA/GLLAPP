# Auditoría de Seguridad — ContaERP
**Fecha:** 2026-06-16 · **Versión:** 1.0 · **Autor:** GLL Consulting

---

## Resumen ejecutivo

| Capa | CRÍTICO | ALTO | MEDIO | BAJO |
|------|---------|------|-------|------|
| Infraestructura | 2 | 3 | 3 | 2 |
| Backend | 4 | 5 | 4 | 2 |
| Frontend | 2 | 4 | 3 | 3 |
| **Total** | **8** | **12** | **10** | **7** |

---

## 1. INFRAESTRUCTURA

### CRÍTICO

**INF-C1 · JWT_SECRET y ENCRYPTION_KEY con valores placeholder**
- `.env` líneas 27–29, 65: `super_secret_jwt_key_change_in_production_minimum_64_chars` y `32_char_encryption_key_here_xxxx`
- Si Railway no sobreescribe estas vars, cualquiera puede forjar JWTs firmando con el secret conocido.
- **Fix:** Generar con `openssl rand -base64 64` y configurar en Railway como secret environment variables (nunca en `.env` commiteado).

**INF-C2 · `synchronize: true` activo en producción**
- `database.module.ts:40` y `tenant-datasource.service.ts:182`
- TypeORM sincroniza el esquema en cada arranque — puede DROP implícito de columnas si la entidad cambia.
- **Fix:** `synchronize: false` en producción; implementar migrations con `npm run migration:generate`.

### ALTO

**INF-A1 · Redis sin contraseña**
- `.env` línea 25: `REDIS_PASSWORD=` (vacío)
- Redis expuesto en red local sin autenticación. En Railway o cualquier red compartida, cualquier proceso puede leer/escribir la cola de Bull.
- **Fix:** Habilitar Redis AUTH y configurar `REDIS_PASSWORD` en Railway.

**INF-A2 · CORS permite cualquier puerto localhost y todo `.vercel.app`**
- `main.ts:31–36`: `localhost:\d+` y `\.vercel\.app$`
- Un atacante puede publicar una preview de Vercel y desde ahí hacer peticiones autenticadas si el usuario tiene sesión abierta.
- **Fix:** En producción, permitir solo el dominio exacto del frontend (`gllapp.vercel.app`); eliminar el wildcard de Vercel.

**INF-A3 · Swagger activo en staging/QA**
- `main.ts:69`: `if (nodeEnv !== 'production')` — si el entorno se llama `staging` expone toda la documentación de la API.
- **Fix:** Deshabilitar Swagger o protegerlo con Basic Auth en cualquier entorno accesible desde Internet.

### MEDIO

**INF-M1 · Credenciales de base de datos débiles en `.env` local**
- `.env` líneas 15–17: `contaerp_user / contaerp_secret`
- Aceptable en desarrollo local pero debe ser diferente en producción.
- **Fix:** Usar credenciales fuertes en Railway; rotar periódicamente.

**INF-M2 · MinIO con credenciales por defecto**
- `.env` líneas 42–44: `minioadmin / minioadmin`
- Si MinIO está accesible, cualquiera puede acceder a archivos del sistema.
- **Fix:** Cambiar credenciales MinIO antes de ir a producción con archivos reales.

**INF-M3 · Sin SSL forzado en conexión a PostgreSQL**
- `database.module.ts`: no hay `ssl: { rejectUnauthorized: true }` para producción.
- **Fix:** Agregar `ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : false`.

---

## 2. BACKEND

### CRÍTICO

**BE-C1 · `satAgenciaPassword` guardada en plaintext en JSONB**
- `tenant.entity.ts:105`: columna `settings: Record<string, any>` — JSONB sin cifrar.
- La contraseña de la Agencia Virtual SAT se guarda tal cual. Un acceso no autorizado a la DB expone credenciales fiscales de todos los tenants.
- **Fix:** Cifrar con `ENCRYPTION_KEY` (AES-256) antes de guardar y descifrar al leer. El servicio de configuración debe usar el mismo patrón que `fel.service.ts` y `integraciones.service.ts`.

**BE-C2 · Refresh tokens guardados en plaintext en DB**
- `auth.service.ts:392–404`: `token: refreshTokenValue` se guarda directamente.
- Si la tabla `refresh_tokens` se filtra, todos los tokens activos quedan expuestos.
- **Fix:** Guardar `bcrypt.hash(refreshToken, 10)` en DB; en validación comparar con `bcrypt.compare()`.

**BE-C3 · APIFY_TOKEN parcialmente expuesto en logs**
- `dte-sat.service.ts:223`: `tokenPrefix=${token?.slice(0,12)}`
- Los primeros 12 caracteres del token aparecen en logs de Railway. Suficiente para un ataque de fuerza bruta asistida.
- **Fix:** Eliminar `tokenPrefix` del log; loggear solo `tokenLen`.

**BE-C4 · FEL API Key y SAT password sin cifrado at-rest consistente**
- `fel.service.ts:34`, `company-integrations/electronic-invoicing.service.ts:20`, `integraciones.service.ts:13`: usan `ENCRYPTION_KEY` — correcto.
- Pero `tenant.settings.satAgenciaPassword` no pasa por ese cifrado (ver BE-C1).
- **Fix:** Centralizar toda persistencia de credenciales en un `CredentialVaultService` que garantice cifrado uniforme.

### ALTO

**BE-A1 · Rate limiting no verificado en endpoints de auth**
- `.env:68–69`: `THROTTLE_TTL=60 THROTTLE_LIMIT=100` configurado, pero hay que confirmar que `ThrottlerGuard` está aplicado globalmente o en `AuthController`.
- 100 requests/min es insuficiente para endpoints de login (brute force en 60s con listas de passwords).
- **Fix:** Aplicar throttler específico en login/register: 5 intentos / 15 min por IP.

**BE-A2 · `console.error` con stacks en servicios**
- `notas-credito.service.ts:242,548`: `err?.message, err?.stack` en logs
- Los stacks incluyen rutas de archivo, versiones de librerías, info de SQL — útil para un atacante.
- **Fix:** Usar `this.logger.error(msg)` de NestJS sin stack en producción; el stack solo en `NODE_ENV=development`.

**BE-A3 · Rutas `@Public()` — verificar que register no esté abierto en producción**
- `auth.controller.ts:22,31,41`: login, refresh, y register son `@Public()`.
- El endpoint `/auth/register` abierto permite crear tenants indefinidamente (resource exhaustion).
- **Fix:** En producción, proteger `/auth/register` con un token de invitación o deshabilitarlo si el onboarding es controlado.

**BE-A4 · `xlsx` con vulnerabilidades HIGH en backend**
- `package.json:67`: `xlsx: ^0.18.5` — Prototype Pollution + ReDoS confirmados, sin fix disponible.
- **Fix:** Migrar a `exceljs` (activamente mantenido, sin vulns activas). Evaluar impacto en módulos de exportación.

**BE-A5 · `bcryptjs` en lugar de `bcrypt` nativo**
- `package.json:46`: `bcryptjs` (JavaScript puro) es ~5× más lento que `bcrypt` (bindings C++).
- Más lento = más susceptible a DoS con peticiones de login masivas (cada hash bloquea el event loop por más tiempo).
- **Fix:** Migrar a `bcrypt` con bindings nativos o usar `argon2` (más seguro y recomendado por OWASP 2024).

### MEDIO

**BE-M1 · `synchronize: true` en `TenantDataSourceService`**
- `tenant-datasource.service.ts:182,327`: cada nuevo tenant crea/actualiza tablas con synchronize.
- En producción, TypeORM puede perder datos al cambiar entidades sin migrations.
- **Fix:** Implementar migrations por tenant; usar `synchronize: false`.

**BE-M2 · Sin validación de `tenantId` en header vs claim JWT**
- El JWT lleva `tenantId` en el payload (auth.service.ts:383), pero los requests también envían `X-Tenant-ID` en header. Si no se verifica que ambos coincidan, un usuario podría enviar un `X-Tenant-ID` diferente al de su JWT.
- **Fix:** En el JWT guard, ignorar `X-Tenant-ID` del header y usar siempre el claim del token; o validar que header === claim.

**BE-M3 · Raw SQL queries sin verificar schema path**
- `clientes.service.ts:121–142`, `admin.service.ts:39–234`, `asientos.service.ts:165–178`
- Las queries usan `$1, $2` (bien — no hay string interpolation detectada), pero algunos servicios hacen `ds.query(sql)` sin `SET search_path` previo.
- **Fix:** Garantizar que cada `ds.query()` use el helper `tenantQuery(ds, schema, sql, params)` que ya establece `search_path`.

**BE-M4 · Startup log expone variables de entorno**
- `main.ts:14`: `console.log('[STARTUP] Variables recibidas de Railway:', customVars.join(', '))`
- Lista los nombres de todas las variables de entorno en los logs al arrancar.
- **Fix:** Eliminar este log en producción (`if (nodeEnv !== 'production')`).

---

## 3. FRONTEND

### CRÍTICO

**FE-C1 · `document.write()` para generar HTML de impresión**
- `src/components/ReportHeader/printLibro.ts:260`
- HTML construido con interpolación de strings incluye datos de empresa (`company`, `legal`, `nit`). Si alguno de esos campos contiene `<script>`, se ejecuta.
- **Fix:** Usar `renderToStaticMarkup()` (React) para generar el HTML de forma segura, igual que los demás módulos de impresión del sistema.

**FE-C2 · Tokens en `localStorage` (inherente al modelo SPA)**
- `src/store/authStore.ts:71–72,95–96`, `src/api/axios.ts:15,53,58–59`
- `accessToken`, `refreshToken`, `tenantId` en localStorage son accesibles a cualquier XSS.
- **Fix a largo plazo:** Migrar a `httpOnly` + `Secure` cookies (requiere cambio en backend). Mitigation inmediata: implementar CSP estricto para eliminar el vector XSS.

### ALTO

**FE-A1 · `console.error` en interceptor Axios (debug en producción)**
- `src/api/axios.ts:24`: `console.error('[Axios] Request bloqueado: X-Tenant-ID ausente —', config.url)`
- Expone URLs internas en DevTools en producción.
- **Fix:** Eliminar o envolver en `if (import.meta.env.DEV)`. Agregar `vite-plugin-remove-console` para build de producción.

**FE-A2 · Sin CSP (Content Security Policy)**
- No hay headers de CSP configurados en ninguna capa.
- Un XSS exitoso puede exfiltrar todos los datos de localStorage.
- **Fix:** Configurar CSP en el servidor de Railway/Vercel: `default-src 'self'; script-src 'self'; connect-src 'self' https://api.railway.app`.

**FE-A3 · `window.open` en `printLibro.ts` abre URL vacía (`''`)**
- `printLibro.ts:258`: `window.open('', '_blank')` + `document.write()` — viola la decisión arquitectónica del CLAUDE.md.
- Produce URL `about:blank` en footer de impresión y abre vector XSS.
- **Fix:** Igual que FE-C1 — migrar a ruta real de impresión.

**FE-A4 · `xlsx` vulnerable (Prototype Pollution + ReDoS)**
- `package.json`: `xlsx ^0.18.5` — misma versión que en backend, sin fix disponible.
- **Fix:** Migrar a `exceljs` también en frontend.

### MEDIO

**FE-M1 · `PUBLIC_PATHS` con `includes()` demasiado permisivo**
- `src/api/axios.ts:22`: `.some(p => config.url?.includes(p))`
- Un endpoint llamado `/admin/logout-users` pasaría el filtro porque contiene `/auth/logout`.
- **Fix:** Cambiar a `startsWith` o comparación exacta.

**FE-M2 · `activeCompany` completo serializado en localStorage**
- `src/store/companyStore.ts:68`: `JSON.stringify(company)` — incluye `taxId`, `legalName`, `status`, `currencyCode`.
- **Fix:** Guardar solo `activeCompanyId`; cargar el objeto `Company` desde API al montar la app.

**FE-M3 · Sin `Subresource Integrity` en recursos externos**
- No hay CDN externo actualmente, pero cualquier import futuro de CDN sin SRI es un vector.
- **Fix:** Documentar política: no usar CDN sin SRI.

---

## 4. PLAN DE REMEDIACIÓN

### Sprint A — Crítico (hacer antes del siguiente deploy)

| # | Fix | Archivo(s) | Esfuerzo |
|---|-----|-----------|----------|
| 1 | Generar JWT_SECRET y ENCRYPTION_KEY reales en Railway | Railway secrets | 15 min |
| 2 | Cifrar `satAgenciaPassword` al guardar en `tenant.settings` | `configuracion.service.ts` | 2h |
| 3 | Eliminar `tokenPrefix` del log APIFY | `dte-sat.service.ts:223`, `dte-sat-emitidos.service.ts` | 5 min |
| 4 | `synchronize: false` en producción (ambos DataSources) | `database.module.ts`, `tenant-datasource.service.ts` | 1h |
| 5 | Migrar `printLibro.ts` de `document.write` a `renderToStaticMarkup` | `printLibro.ts` | 3h |
| 6 | Startup log de vars en producción | `main.ts:14` | 5 min |

### Sprint B — Alto (esta semana)

| # | Fix | Esfuerzo |
|---|-----|----------|
| 7 | Hashear refresh tokens en DB | 3h |
| 8 | Rate limiting estricto en `/auth/login` (5 req/15min por IP) | 1h |
| 9 | CORS producción: solo dominio exacto, sin wildcard Vercel | 30 min |
| 10 | Remover `@Public()` de `/auth/register` o añadir token de invitación | 2h |
| 11 | CSP header en Vercel/Railway | 1h |
| 12 | Eliminar `console.error` en `notas-credito.service.ts` | 10 min |
| 13 | `if (import.meta.env.DEV)` en console de axios | 5 min |

### Sprint C — Medio (próximas 2 semanas)

| # | Fix | Esfuerzo |
|---|-----|----------|
| 14 | Migrations TypeORM para esquemas public y tenant | 4h |
| 15 | Redis AUTH en Railway | 30 min |
| 16 | SSL en conexión PostgreSQL prod | 30 min |
| 17 | Migrar `xlsx` → `exceljs` en backend y frontend | 4h |
| 18 | Validación `tenantId` header vs JWT claim | 2h |
| 19 | `PUBLIC_PATHS` con `startsWith` exacto | 15 min |
| 20 | `activeCompany` en localStorage: guardar solo ID | 1h |

### Sprint D — Largo plazo (siguiente mes)

| # | Fix | Esfuerzo |
|---|-----|----------|
| 21 | httpOnly cookies para `accessToken` y `refreshToken` (requiere BE+FE) | 2 días |
| 22 | Migrar `bcryptjs` → `argon2` | 1h |
| 23 | `CredentialVaultService` centralizado para cifrado at-rest | 1 día |
| 24 | Swagger con Basic Auth en staging | 2h |
| 25 | `eslint-plugin-security` + `vite-plugin-remove-console` | 1h |

---

## 5. ANÁLISIS DE RENDIMIENTO

### Backend

| Área | Estado | Observación |
|------|--------|-------------|
| Connection pool | `DB_POOL_SIZE=10` | Adecuado para MVP; aumentar a 20–50 con carga real |
| Redis (Bull queues) | Configurado | Jobs de APIFY asíncronos — correcto |
| JWT expiry | 15m access / 7d refresh | Balanceado; access corto reduce ventana de robo |
| bcryptjs rounds | 12 | Correcto; con argon2 bajar a defaults |
| N+1 queries | `auth.service.ts:125`: `relations: ['roles','roles.permissions']` | Eager load en cada login — revisar si se puede cachear perfil |
| TypeORM synchronize | True en prod | Lento en arranque; con migrations se elimina overhead |
| Raw queries en catálogo | `catalogo.service.ts:144–154` | Aceptables; ya usan `search_path` |

### Frontend

| Área | Estado | Observación |
|------|--------|-------------|
| Bundle size | Vite 8 + React 19 | Sin tree-shaking issues detectados |
| Ant Design 6 | `antd: ^6.3.7` | Import dinámico correcto con Vite |
| Zustand | 5.x | Mínimo overhead de estado |
| Axios singleton | `src/api/axios.ts` | Correcto; interceptors centralizados |
| Re-renders en tabla | LineItemsEditor con debounce | Ya optimizado (ver CLAUDE.md) |
| dayjs vs moment | dayjs | Correcto — 2KB vs 70KB |

---

## 6. RECOMENDACIONES DE MANTENIMIENTO

### Rutinas semanales
- `npm audit` en backend y frontend; vulnerabilidades HIGH/CRITICAL bloquean deploy.
- Revisar logs de Railway para `console.error` inesperados y errores 500 sin capturar.
- Validar que refresh tokens expirados se limpian (cron job de purga).

### Rutinas mensuales
- Rotar `JWT_SECRET`, `JWT_REFRESH_SECRET`, `ENCRYPTION_KEY` y `APIFY_TOKEN` en Railway.
- Revisar usuarios con `isSuperAdmin = true` — deben ser los mínimos necesarios.
- Verificar que `synchronize: false` sigue activo en producción.
- Auditar tenants inactivos: purgar datos o suspender para reducir superficie.

### Antes de cada deploy
```bash
npm run typecheck      # Sin errores TypeScript
npm audit --audit-level=high  # 0 vulns HIGH/CRITICAL
npm run build          # Build limpio
# Verificar que VITE_API_URL apunta a https:// en producción
```

### Política de secretos
- **Nunca** commitear `.env` con valores reales. El `.gitignore` actual lo excluye correctamente.
- Secrets en Railway: `JWT_SECRET`, `JWT_REFRESH_SECRET`, `ENCRYPTION_KEY`, `APIFY_TOKEN`, `REDIS_PASSWORD`, credenciales DB.
- Rotar inmediatamente si un secret aparece en un log o commit.

### Stack de monitoreo recomendado
| Herramienta | Propósito | Tier gratuito |
|-------------|-----------|---------------|
| Sentry | Error tracking + alertas | ✓ |
| Railway Metrics | CPU/Memoria/DB connections | ✓ (incluido) |
| Uptime Robot | Health check cada 5 min | ✓ |
| Snyk | CVE automático en PRs | ✓ |

---

*Documento generado post sprint de seguridad. Próxima revisión: 2026-09-16*
