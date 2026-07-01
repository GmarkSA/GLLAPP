# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## ONBOARDING — Leer antes de hacer cualquier cosa

### Identidad y repositorios
- **Owner:** GmarkSA / chogui23@gmail.com
- **Socio revisor:** cesargomez-211 (aprueba PRs antes de merge a master)
- **Frontend repo:** https://github.com/GmarkSA/GLLAPP.git
- **Backend repo:** https://github.com/GmarkSA/contaerp-backend.git
- **Branch protection:** master bloqueado — nunca push directo a master

### START OF SESSION (hacer siempre primero)
1. Verificar identidad git local:
   ```bash
   git config --local user.name   # debe ser: GmarkSA
   git config --local user.email  # debe ser: chogui23@gmail.com
   ```
   Si no está configurado:
   ```bash
   git config --local user.name "GmarkSA"
   git config --local user.email "chogui23@gmail.com"
   ```
2. Traer últimos cambios:
   ```bash
   git checkout master
   git pull origin master
   ```
3. Mostrar `git status` y los últimos 3 commits.

### DURANTE EL TRABAJO
- Nunca trabajar directamente en master
- Crear rama feature antes de cualquier cambio:
  ```bash
  git checkout -b feature/descripcion-del-cambio
  ```
- Una rama por feature o fix — nunca mezclar cambios no relacionados

### END OF SESSION (hacer siempre al final)
1. `git add .`
2. Mostrar `git status` para confirmar qué se va a commitear
3. `npm run typecheck` — verificar que no hay errores TypeScript
4. `git commit -m "feat: [descripción de lo realizado]"`
5. `git push origin feature/descripcion-del-cambio`
6. Dar la URL directa para abrir el Pull Request hacia master:
   `https://github.com/GmarkSA/GLLAPP/compare/master...feature/descripcion-del-cambio`

### NUNCA
- Push directo a master (`git push origin master`)
- Commitear `node_modules/`, `dist/`, o archivos `.env`
- Mezclar cambios no relacionados en un solo commit
- Mover o eliminar archivos en `docs/archive/`

---

## Proyecto: ConTaERP — Frontend

Sistema de contabilidad y ERP para Guatemala. Desarrollado íntegramente por Claude Code junto con el propietario (GLL Consulting). El backend está en `/Users/luischajon/Documents/GLLAPP/contaerp-backend` (Mac).

## Comandos

```bash
npm run dev          # servidor de desarrollo en http://localhost:5173
npm run build        # build de producción (Vite)
npm run typecheck    # verificar tipos TypeScript (tsc -b) — usar antes de cada commit
npm run lint         # ESLint
```

TypeScript es la fuente de verdad. Ejecutar `npm run typecheck` después de cualquier cambio estructural.

---

## Arquitectura

### Stack
- React 19 + TypeScript + Vite
- Ant Design 5 (componentes UI exclusivos — no usar otras librerías de UI)
- React Router v7 (SPA, todas las rutas en `src/App.tsx`)
- Zustand (`src/store/authStore.ts`) para estado global de autenticación
- Axios con interceptors JWT en `src/api/axios.ts`
- Day.js para fechas

### Estructura de carpetas
```
src/
  api/          # Un archivo por dominio (facturas.ts, contactos.ts, etc.)
  components/   # Componentes reutilizables entre módulos
  pages/        # Páginas organizadas por módulo (ventas/, compras/, etc.)
  store/        # Zustand stores
  layouts/      # MainLayout con sidebar
```

### Autenticación y multi-tenant
- JWT guardado en `localStorage` (`accessToken`, `refreshToken`, `tenantId`)
- Cada request envía `Authorization: Bearer <token>` y `X-Tenant-ID: <tenantId>`
- Refresh automático implementado en el interceptor de Axios
- El backend aísla datos por tenant con PostgreSQL schemas separados

### Rutas especiales (sin sidebar)
Las rutas de impresión y POS se declaran **fuera** del `<MainLayout>` en `App.tsx`:
```tsx
<Route path="/ventas/facturas/:id/imprimir"     element={<FacturaImprimirPage />} />
<Route path="/ventas/estimaciones/:id/imprimir" element={<EstimacionPrintPage />} />
<Route path="/pos"                              element={<POSPage />} />
```

### Capa de API
- Cada archivo en `src/api/` exporta funciones que llaman al backend
- Patrón de unwrap: `const unwrap = (r: any) => r.data?.data ?? r.data`
- El backend devuelve `{ data: T }` o `{ data: { data: T[], total: N } }` para paginados

### Módulo de Impresión
- `PrintInvoiceButton` abre una ventana nueva a la ruta real `/ventas/facturas/:id/imprimir?format=<formatId>`
- `FacturaImprimirPage` carga sus propios datos, auto-dispara `window.print()` a los 500ms
- CSS `@page { margin: 0 }` elimina headers/footers del browser. El padding visual va en `.print-wrap`
- Formatos disponibles en `src/components/Print/printFormats.ts`: `carta`, `media-carta`, `ticket-80`, `ticket-58`
- **Nunca usar `window.open('', '_blank')` + `document.write()`** — produce URL `about:blank` en footer de impresión

### LineItemsEditor (componente crítico)
Ubicado en `src/components/DocumentForm/LineItemsEditor.tsx`. Usado en Facturas, Estimaciones, Notas de Crédito.

- **Inputs con debounce local** para evitar pérdida de foco en tabla: `CellInput`, `CellTextArea`, `CellInputNumber` usan estado local + `onBlur` para commitear al padre
- **IVA Guatemala**: `taxInclusive = true` por defecto (precio incluye IVA). La función `recalc()` extrae base e impuesto del precio ya incluido
- **Cuentas contables**: Se cargan todas las cuentas activas (no solo de ingreso) y se agrupan: ingresos primero (código 4xx o balanceType Acreedor), resto después
- **Campo `unit`**: Select desplegable con opciones UND/SER/EXP/EXE/KG/MT/LT/HRS/MT2

### Convenciones de formularios
- Todos los formularios usan `Form` de Ant Design con `layout="vertical"` y `size="small"`
- Grids con CSS Grid (`display: grid; grid-template-columns: ...`) — no usar `Row/Col` de Antd en formularios internos
- Color corporativo: `#1B3A6B` (azul navy)
- Formatos de moneda guatemalteca: `Q ${Number(n).toLocaleString('es-GT', { minimumFractionDigits: 2 })}`
- Fechas: Day.js con `format('DD/MM/YYYY')`

### FEL (Factura Electrónica — SAT Guatemala)
Los campos FEL en `FacturaFormPage` están **siempre visibles** (no colapsados). Organización:
1. Fila principal: Tipo Documento | Serie FEL | Número SAT + UUID | URL | Autorización | Fecha
2. Sección inferior separada por línea punteada: **EXPORTACIÓN / CONSIGNACIÓN** (INCOTERM | Lugar de Expedición | Consignatario | Dirección) — solo para facturas de exportación

### Anticipos
Los anticipos (`type: 'advance'`, numeración `ANT-XXXX`) se gestionan **solo** desde el módulo de Pagos Recibidos. El endpoint `/ventas/facturas` los excluye en el backend con `WHERE type != 'advance'`. **Nunca filtrar anticipos en el frontend** — la exclusión es responsabilidad del backend.

---

## Decisiones de arquitectura establecidas

| Decisión | Razonamiento |
|---|---|
| Impresión por ruta real, no `document.write` | `about:blank` ignora `@page { margin: 0 }` en Chrome |
| Debounce en celdas de tabla | Ant Design Table re-renderiza en cada onChange, causando pérdida de foco |
| Exclusión de anticipos en backend | Filtro client-side rompe paginación; la fuente de verdad es el servidor |
| Siempre `renderToStaticMarkup` para HTML de impresión | Más confiable que portales React para ventanas externas |
