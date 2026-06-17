# AGENTS.md — ConTaERP Frontend

Guía vinculante para Codex y cualquier agente de IA trabajando en este repositorio.

---

## Rama de trabajo

**Siempre trabajar en la rama `develop`.**

```bash
git checkout develop       # antes de comenzar cualquier tarea
git pull origin develop    # sincronizar con remoto
```

No crear ramas `feature/*` ni `fix/*` locales. Los cambios se hacen directamente en `develop` y se revisan antes de hacer PR a `master`.

---

## Comandos

```bash
npm run dev          # servidor en http://localhost:5173 (o 5174 si ocupado)
npm run typecheck    # EJECUTAR antes de cada commit — debe pasar sin errores
npm run build        # build de producción
npm run lint         # ESLint
```

**Regla**: `npm run typecheck` debe pasar sin errores antes de commitear.

---

## Stack

- React 19 + TypeScript + Vite
- Ant Design 5 — **única librería de UI permitida**, no instalar otras
- React Router v7 (SPA, todas las rutas en `src/App.tsx`)
- Zustand (`src/store/authStore.ts`) para estado global de autenticación
- Axios con interceptors JWT en `src/api/axios.ts`
- Day.js para fechas

---

## Agregar una página nueva

### 1. Crear el archivo de página
`src/pages/<modulo>/<NombrePage>.tsx`

### 2. Registrar en App.tsx

```tsx
// Import lazy al inicio del archivo (sección del módulo correspondiente):
const MiPage = lazy(() => import('./pages/modulo/MiPage'))

// Ruta dentro del <MainLayout>:
<Route path="modulo/ruta" element={<MiPage />} />
```

### 3. Agregar al sidebar en MainLayout.tsx

```tsx
{ key: '/modulo/ruta', label: 'Mi Página' },
```

### 4. Crear la capa API si aplica
`src/api/<dominio>.ts` — exportar funciones que llaman al backend.

---

## Capa de API

Patrón estándar:

```typescript
import api from './axios'
const unwrap = (r: any) => r.data?.data ?? r.data

export const miApi = {
  findAll: (params?: any) => api.get('/ruta', { params }).then(unwrap),
  findOne: (id: string)   => api.get(`/ruta/${id}`).then(unwrap),
  create:  (dto: any)     => api.post('/ruta', dto).then(unwrap),
  update:  (id: string, dto: any) => api.patch(`/ruta/${id}`, dto).then(unwrap),
  remove:  (id: string)   => api.delete(`/ruta/${id}`).then(unwrap),
}
```

El interceptor de axios agrega automáticamente:
- `Authorization: Bearer <token>`
- `X-Tenant-ID: <tenantId>`
- `X-Company-ID: <activeCompanyId>`

---

## Convenciones de UI

- **Formularios**: `<Form layout="vertical" size="small">` siempre
- **Grids**: CSS Grid (`display: grid; grid-template-columns: ...`) — no usar `Row/Col` de Antd
- **Color corporativo**: `#1B3A6B` (azul navy) para botones primarios y acentos
- **Moneda guatemalteca**: `Q ${Number(n).toLocaleString('es-GT', { minimumFractionDigits: 2 })}`
- **Fechas**: Day.js con `format('DD/MM/YYYY')`
- **Tablas con scroll**: `scroll={{ x: 'max-content', y: 'calc(100vh - 280px)' }}` para headers fijos

## Tablas (Ant Design Table)

```tsx
<Table
  dataSource={data}
  columns={columns}
  rowKey="id"
  size="small"
  loading={loading}
  scroll={{ x: 'max-content', y: 'calc(100vh - 280px)' }}
  pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `${t} registros` }}
/>
```

**No usar** `sticky={{ offsetHeader: N }}` — causa artefactos visuales. Usar siempre `scroll.y`.

---

## Módulos existentes (no duplicar)

| Módulo | Path | Descripción |
|--------|------|-------------|
| Clientes | `src/pages/ventas/clientes/` | CRUD clientes con lookup NIT/CUI |
| Facturas | `src/pages/ventas/facturas/` | Facturas venta + FEL + impresión |
| Estimaciones | `src/pages/ventas/estimaciones/` | Cotizaciones |
| Pagos recibidos | `src/pages/ventas/pagos-recibidos/` | Pagos y anticipos |
| Notas crédito | `src/pages/ventas/notas-credito/` | NC de venta |
| DTE SAT Ventas | `src/pages/ventas/dte-sat/` | Documentos SAT emitidos |
| Proveedores | `src/pages/compras/proveedores/` | CRUD proveedores con lookup NIT/CUI |
| Facturas proveedor | `src/pages/compras/facturas/` | Facturas de compra |
| Órdenes compra | `src/pages/compras/ordenes/` | OC |
| DTE SAT Compras | `src/pages/compras/dte-sat/` | Documentos SAT recibidos |
| Bancos | `src/pages/bancos/` | Cuentas, transacciones, conciliación, reglas, transferencias |
| Inventario | `src/pages/inventario/` | Artículos, almacenes, movimientos |
| Contabilidad | `src/pages/contabilidad/` | Catálogo de cuentas |
| Reportes | `src/pages/reportes/` | Libros, balanza, balance, estado resultados |
| POS | `src/pages/pos/POSPage.tsx` | Punto de venta con lookup NIT |
| Configuración | `src/pages/configuracion/` | Empresas, usuarios, series, FEL, SAT |

---

## Componentes reutilizables clave

- `src/components/DocumentForm/LineItemsEditor.tsx` — editor de líneas para facturas/estimaciones (no reemplazar)
- `src/components/Print/` — sistema de impresión por rutas reales
- `src/api/satLookup.ts` — lookup NIT/CUI vía SAT (Felplex)

---

## Rutas especiales (fuera del MainLayout)

Estas rutas **no** usan el sidebar:

```tsx
<Route path="/ventas/facturas/:id/imprimir"     element={<FacturaImprimirPage />} />
<Route path="/ventas/estimaciones/:id/imprimir" element={<EstimacionPrintPage />} />
<Route path="/pos"                              element={<POSPage />} />
```

---

## Antes de commitear

1. `npm run typecheck` — debe pasar sin errores
2. Verificar que la nueva ruta está en `App.tsx`
3. Verificar que el sidebar en `MainLayout.tsx` tiene el ítem de menú si aplica
4. Commit descriptivo en español:

```bash
git add <archivos específicos>
git commit -m "feat: descripción del cambio"
# o fix:, refactor:, chore:
```
