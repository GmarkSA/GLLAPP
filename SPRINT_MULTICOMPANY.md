# ROADMAP MVP ENTERPRISE — Multi-Company
## ConTaERP · GLL Consulting · 2026

> **Decisión definitiva:** Multi-Company es parte del núcleo del ERP, no funcionalidad futura.
> **Principio:** company_id obligatorio · Integraciones por company_id · Multi-país desde el inicio

---

## SPRINT 0 — FUNDACIÓN ✅ COMPLETADO
### Riesgo: Cero · 100% aditivo · GMARK S.A. sin impacto
### Commits: `ca88e5e` (backend) · `86360c0` (frontend)

---

### BACKEND

#### Módulo `companies`

**Entidades**
- [x] `companies/entities/company.entity.ts` — CompanyEntity
- [x] `companies/entities/company-settings.entity.ts` — CompanySettingsEntity
- [x] `companies/entities/branch.entity.ts` — BranchEntity
- [x] `companies/entities/warehouse.entity.ts` — WarehouseEntity
- [x] `companies/entities/company-user.entity.ts` — CompanyUserEntity
- [x] `companies/entities/company-bank-account.entity.ts` — CompanyBankAccountEntity
- [x] `companies/entities/document-series.entity.ts` — DocumentSeriesEntity

**Servicios y Controladores**
- [x] `companies/companies.service.ts` — CRUD empresas + auto-seed empresa default
- [x] `companies/companies.controller.ts` — GET/POST/PATCH/DELETE /companies
- [x] `companies/branches.service.ts` + `branches.controller.ts`
- [x] `companies/warehouses.service.ts` + `warehouses.controller.ts`
- [x] `companies/company-users.service.ts` + `company-users.controller.ts`
- [x] `companies/company-bank-accounts.service.ts` + `company-bank-accounts.controller.ts`
- [x] `companies/document-series.service.ts` — CRUD series + `nextNumber()`
- [x] `companies/companies.module.ts`

#### Módulo `company-integrations`

- [x] `company-integrations/entities/bank-profile.entity.ts` — CompanyBankProfileEntity
- [x] `company-integrations/entities/electronic-invoicing.entity.ts` — CompanyElectronicInvoicingEntity
- [x] `company-integrations/bank-profiles.service.ts` — CRUD + cifrado AES
- [x] `company-integrations/electronic-invoicing.service.ts` — CRUD + certificados
- [x] `company-integrations/company-integrations.controller.ts` + `company-integrations.module.ts`

#### Schema `public` — Módulo `fiscal-regimes`

- [x] `fiscal-regimes/entities/fiscal-regime.entity.ts` — FiscalRegimeEntity en schema `public`
- [x] `fiscal-regimes/fiscal-regimes.service.ts` — Catálogo global
- [x] `fiscal-regimes/fiscal-regimes.controller.ts` — GET /fiscal-regimes
- [x] `fiscal-regimes/fiscal-regimes.module.ts`
- [x] Seed: Guatemala (GT) · Honduras (HN) · El Salvador (SV) · Panamá (PA) · Costa Rica (CR) · México (MX)

#### Auth — Company Context Guard

- [x] `common/guards/company-context.guard.ts` — Valida X-Company-ID + acceso usuario→empresa
- [x] `common/decorators/current-user.decorator.ts` — `@CurrentCompanyId()`
- [x] `common/context/company-context.ts` — CompanyContext REQUEST-SCOPED

### FRONTEND

- [x] `src/store/authStore.ts` — `activeCompanyId`, `activeCompany`, `setActiveCompany()`
- [x] `src/api/companies.ts`, `branches.ts`, `fiscalRegimes.ts`, `companyIntegrations.ts`
- [x] `src/api/axios.ts` — Interceptor `X-Company-ID`
- [x] `src/pages/configuracion/empresas/EmpresasPage.tsx`
- [x] `src/pages/configuracion/empresas/EmpresaFormPage.tsx`
- [x] `src/pages/configuracion/empresas/SucursalesPage.tsx`
- [x] `src/components/CompanySelector.tsx` — Dropdown empresa activa en sidebar
- [x] `src/layouts/MainLayout.tsx` — CompanySelector integrado + menú Empresas
- [x] Rutas: `/configuracion/empresas`, `/nueva`, `/:id`, `/:id/sucursales`

### CIERRE SPRINT 0

- [x] Typecheck frontend sin errores
- [x] Build backend sin errores
- [x] Company Selector visible en sidebar y funcional
- [x] X-Company-ID header enviado en cada request
- [x] Deploy Railway + Vercel

---
---

## SPRINT 1 — MIGRACIÓN BASE DE DATOS ✅ COMPLETADO
### Riesgo: Bajo · Nullable + auto-sync = sin downtime
### Commits: `8678b04` (Sprint 1) · `ab94762` (Cierre Sprint 1)

- [x] `company_id UUID nullable` + `@Index()` agregado a 30 tablas del tenant:
  - [x] Maestras: customers, vendors, accounts, taxes, products, bank_accounts
  - [x] Transaccionales: invoices, estimates, purchase_invoices, purchase_orders, expenses, vendor_payments, invoice_payments
  - [x] Contables: journal_entries, fixed_assets
  - [x] Inventario: almacenes, centros, grupos, ajustes, movimientos, entregas, importaciones, expedientes, ubicaciones, orden_produccion
  - [x] Soporte: projects, fel_documents, ocr_documents, workflows
- [x] `@Unique(['companyId', 'campo'])` en 23 entidades — elimina colisiones entre empresas
- [x] `invoice_payments` — company_id agregado + @Unique
- [x] `ordenes_produccion` — omitida en Sprint 1 inicial, corregida en cierre
- [x] `BranchEntity.code` — compound unique por empresa
- [x] CompanyContext REQUEST-SCOPED (`src/common/context/company-context.ts`)
- [x] TenantMiddleware actualizado — extrae `X-Company-ID` → `req.companyId`
- [x] CompanyContextGuard fortalecido — valida user→empresa vía `company_users` table
  - [x] Modo migración fail-open (sin asignaciones → permite)
  - [x] Con asignaciones fail-closed (403 si empresa no autorizada)
  - [x] SuperAdmin bypass
- [x] CompanyContextGuard registrado como `APP_GUARD` global en AppModule
- [x] FiscalRegimesBootstrap — `OnApplicationBootstrap` crea `public.fiscal_regimes` si no existe + seed automático
- [x] Deploy Railway

---

## SPRINT 2 — SERVICIOS CORE
### Riesgo: Medio · Deploy coordinado

**Patrón mecánico en cada servicio:**
```typescript
// Antes: where: { tenantId }
// Después: where: { tenantId, companyId }
// Firma pública de métodos: sin cambios
```

- [ ] `customers.service.ts` — filtrado por companyId
- [ ] `vendors.service.ts` — filtrado por companyId
- [ ] `invoices.service.ts` — filtrado + asignación al crear
- [ ] `purchase-invoices.service.ts`
- [ ] `catalogo.service.ts` (cuentas) — plan de cuentas por empresa + `cloneChartOfAccounts(templateId, companyId)`
- [ ] `journal-entries.service.ts` — asientos por empresa
- [ ] `bank-accounts.service.ts`
- [ ] `payments.service.ts` (pagos recibidos)
- [ ] `vendor-payments.service.ts`
- [ ] Verificar paginación correcta por empresa

---

## SPRINT 3 — SERVICIOS SECUNDARIOS
### Riesgo: Bajo

- [ ] `estimates.service.ts` (cotizaciones)
- [ ] `purchase-orders.service.ts` (órdenes de compra)
- [ ] `credit-notes.service.ts` (notas de crédito)
- [ ] `expenses.service.ts` (gastos)
- [ ] `fixed-assets.service.ts` (activos fijos)
- [ ] `items.service.ts` (artículos/inventario)
- [ ] `taxes.service.ts` — company_id nullable: null = compartido, valor = empresa específica
- [ ] `fel.service.ts` — refactorizar para usar `company_electronic_invoicing`
- [ ] Reportes: Libro de Compras filtrado por empresa
- [ ] Reportes: Libro de Ventas filtrado por empresa
- [ ] Reportes: AP Aging por empresa
- [ ] Reportes: AR Aging por empresa

---

## SPRINT 4 — FRONTEND MULTI-EMPRESA
### Riesgo: Bajo · Solo UI

- [ ] Breadcrumb en header: `[Grupo Castillo] > [Castillo Guatemala] > Facturas`
- [ ] Todas las listas operan en contexto de empresa activa
- [ ] Formularios de creación asignan `company_id` desde contexto
- [ ] Permisos: usuario de Empresa A no ve datos de Empresa B
- [ ] Configuración → Integraciones FEL por empresa
- [ ] Configuración → Bancos por empresa
- [ ] Configuración → Numeraciones por empresa
- [ ] Platform Admin (GLL): vista de todos los tenants, empresas, planes
- [ ] Manejo de estado sin empresa asignada

---

## SPRINT 5 — ONBOARDING Y DEMO
### Riesgo: Cero · Datos demo separados

- [ ] Wizard: Tenant → Empresa → Régimen Fiscal → Plan de Cuentas → Usuarios → Módulos
- [ ] Templates de plan de cuentas por país (Guatemala primero)
- [ ] Tenant demo "Grupo Castillo" con 5 empresas:
  - [ ] Castillo Guatemala S.A.
  - [ ] Castillo Honduras S.A.
  - [ ] Castillo El Salvador S.A.
  - [ ] Castillo Panamá S.A.
  - [ ] Castillo Inmobiliaria S.A.
- [ ] Verificación: factura Empresa A invisible en Empresa B
- [ ] Verificación: FEL Empresa A no expuesto en Empresa B
- [ ] Documentación técnica para el cliente

---

## RESUMEN EJECUTIVO

| Sprint | Estado | Contenido | Commit |
|--------|--------|-----------|--------|
| **0 — Fundación** | ✅ Completado | Entidades + APIs + Company Selector | `ca88e5e` / `86360c0` |
| **1 — Migración BD** | ✅ Completado | company_id en 30 tablas + UNIQUE + Guard | `8678b04` / `ab94762` |
| **2 — Servicios Core** | ⏳ Pendiente | 9 servicios principales | — |
| **3 — Servicios Rest** | ⏳ Pendiente | Secundarios + FEL + Reportes | — |
| **4 — Frontend** | ⏳ Pendiente | UI multi-empresa completa | — |
| **5 — Onboarding Demo** | ⏳ Pendiente | Wizard + Grupo Castillo | — |

**Resultado final objetivo:** ERP Enterprise con soporte para grupos empresariales multi-país, sin necesidad de rediseño arquitectónico futuro.
