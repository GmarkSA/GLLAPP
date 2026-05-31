# ROADMAP MVP ENTERPRISE — Multi-Company
## ConTaERP · GLL Consulting · 2026

> **Decisión definitiva:** Multi-Company es parte del núcleo del ERP, no funcionalidad futura.
> **Principio:** company_id obligatorio · Integraciones por company_id · Multi-país desde el inicio

---

## SPRINT 0 — FUNDACIÓN
### Riesgo: Cero · 100% aditivo · GMARK S.A. sin impacto

---

### BACKEND

#### Módulo `companies`

**Entidades**
- [ ] `companies/entities/company.entity.ts` — CompanyEntity (id, tenant_id, company_number, legal_name, trade_name, tax_id, country_code, currency_code, timezone, fiscal_regime_id, is_default, status)
- [ ] `companies/entities/company-settings.entity.ts` — CompanySettingsEntity (base_currency, language, timezone, date_format, fiscal_year_start/end, inventory_method, default_payment_terms, default_sales_series, default_purchase_series, settings_json)
- [ ] `companies/entities/branch.entity.ts` — BranchEntity (id, company_id, name, code, address, is_default, status)
- [ ] `companies/entities/warehouse.entity.ts` — WarehouseEntity (id, company_id, branch_id nullable, name, code, address, is_default, is_active)
- [ ] `companies/entities/company-user.entity.ts` — CompanyUserEntity (id, company_id, user_id, role_ids[], branch_id nullable, module_overrides JSONB, is_active) — acceso de usuario a empresa
- [ ] `companies/entities/company-bank-account.entity.ts` — CompanyBankAccountEntity (id, company_id, bank_name, account_number, account_type, currency_code, account_id FK→accounts, is_default, status) — cuenta bancaria contable, distinta del perfil de integración
- [ ] `companies/entities/document-series.entity.ts` — DocumentSeriesEntity (company_id, document_type, series, current_number, padding)

**Servicios y Controladores**
- [ ] `companies/companies.service.ts` — CRUD empresas + auto-seed empresa default al crear tenant
- [ ] `companies/companies.controller.ts` — `GET /companies` · `POST /companies` · `GET /companies/:id` · `PATCH /companies/:id` · `DELETE /companies/:id`
- [ ] `companies/branches.service.ts` — CRUD sucursales
- [ ] `companies/branches.controller.ts` — `GET /companies/:id/branches` · `POST /companies/:id/branches` · `PATCH /branches/:id`
- [ ] `companies/warehouses.service.ts` — CRUD bodegas/almacenes por empresa
- [ ] `companies/warehouses.controller.ts` — `GET /companies/:id/warehouses` · `POST /companies/:id/warehouses` · `PATCH /warehouses/:id`
- [ ] `companies/company-users.service.ts` — Gestión de acceso usuario-empresa (asignar roles, sucursal, módulos)
- [ ] `companies/company-users.controller.ts` — `GET /companies/:id/users` · `POST /companies/:id/users` · `PATCH /companies/:id/users/:userId` · `DELETE /companies/:id/users/:userId`
- [ ] `companies/company-bank-accounts.service.ts` — CRUD cuentas bancarias contables por empresa
- [ ] `companies/company-bank-accounts.controller.ts` — `GET /companies/:id/bank-accounts` · `POST /companies/:id/bank-accounts` · `PATCH /bank-accounts/:id`
- [ ] `companies/document-series.service.ts` — CRUD series + `nextNumber(companyId, documentType)`
- [ ] `companies/companies.module.ts`

#### Módulo `company-integrations`

**Entidades**
- [ ] `company-integrations/entities/bank-profile.entity.ts` — CompanyBankProfileEntity (company_id, bank_name, country_code, integration_provider, credentials_encrypted, certificate_path, api_configuration_json, status)
- [ ] `company-integrations/entities/electronic-invoicing.entity.ts` — CompanyElectronicInvoicingEntity (company_id, country_code, provider, environment, certificate, private_key, credentials_encrypted, api_configuration_json, status)

**Servicios y Controladores**
- [ ] `company-integrations/bank-profiles.service.ts` — CRUD + cifrado AES de credenciales
- [ ] `company-integrations/electronic-invoicing.service.ts` — CRUD + gestión certificados FEL/CFDI/DTE
- [ ] `company-integrations/company-integrations.controller.ts`
- [ ] `company-integrations/company-integrations.module.ts`

#### Schema `public` — Módulo `fiscal-regimes`

**Entidades y Seeds**
- [ ] `fiscal-regimes/entities/fiscal-regime.entity.ts` — FiscalRegimeEntity en schema `public` (country_code, code, name, tax_config JSONB, is_active)
- [ ] `fiscal-regimes/fiscal-regimes.service.ts` — Solo lectura (catálogo global)
- [ ] `fiscal-regimes/fiscal-regimes.controller.ts` — `GET /fiscal-regimes` · `GET /fiscal-regimes?country=GT`
- [ ] `fiscal-regimes/fiscal-regimes.module.ts`
- [ ] `db/seeds/fiscal-regimes.seed.ts` — Seeding inicial:
  - [ ] Guatemala (GT) — NIT · IVA 12% · FEL (infile/digifact/felplex)
  - [ ] Honduras (HN) — RTN · ISV 15% · SAR
  - [ ] El Salvador (SV) — NIT · IVA 13% · DTE (Ministerio Hacienda)
  - [ ] Panamá (PA) — RUC · ITBMS 7% · DGI Panamá
  - [ ] Costa Rica (CR) — Cédula Jurídica · IVA 13% · Hacienda CR
  - [ ] México (MX) — RFC · IVA 16% · CFDI + PAC

#### Auth — Company Context Guard

- [ ] `auth/guards/company-context.guard.ts` — Lee `X-Company-ID` header, valida que usuario tenga acceso, inyecta en request
- [ ] `auth/decorators/company.decorator.ts` — `@CurrentCompany()` + `@CurrentCompanyId()`

> JWT **no cambia**. Solo se agrega el guard. Todos los endpoints existentes siguen funcionando.

#### Migraciones y Seeds de producción

- [ ] `migrations/XXXX-create-companies-module.ts` — Crea tablas: companies, company_settings, branches, document_series, company_bank_profiles, company_electronic_invoicing
- [ ] `migrations/XXXX-create-public-fiscal-regimes.ts` — Crea tabla en schema public + ejecuta seed 6 países
- [ ] `migrations/XXXX-seed-default-company-gmark.ts` — Crea "GMARK S.A." como empresa default del tenant en producción (NIT, GTQ, GT, zona horaria Guatemala)

---

### FRONTEND

#### Store y API

- [ ] `src/store/authStore.ts` — Agregar `activeCompanyId: string | null`, `activeCompany: Company | null`, `setActiveCompany(company)`
- [ ] `src/api/companies.ts` — `getCompanies()`, `getCompany(id)`, `createCompany()`, `updateCompany()`, `getCompanySettings()`, `updateCompanySettings()`
- [ ] `src/api/branches.ts` — `getBranches(companyId)`, `createBranch()`, `updateBranch()`
- [ ] `src/api/fiscalRegimes.ts` — `getFiscalRegimes()`, `getFiscalRegimesByCountry(code)`
- [ ] `src/api/companyIntegrations.ts` — `getBankProfiles(companyId)`, `getElectronicInvoicingProfiles(companyId)`, CRUD de ambos
- [ ] `src/api/axios.ts` — Interceptor: agregar header `X-Company-ID` desde `authStore.activeCompanyId` en cada request

#### Páginas — Configuración → Empresa

- [ ] `src/pages/configuracion/EmpresasPage.tsx` — Lista de empresas del tenant (tabla con columnas: Nombre, NIT, País, Moneda, Estado, Acciones)
- [ ] `src/pages/configuracion/EmpresaFormPage.tsx` — Crear / editar empresa (campos: Nombre Legal, Nombre Comercial, NIT, País, Moneda, Zona horaria, Régimen Fiscal)
- [ ] `src/pages/configuracion/EmpresaSettingsPage.tsx` — Configuración operativa de la empresa (moneda base, año fiscal, método inventario, series por defecto, impuestos)
- [ ] `src/pages/configuracion/SucursalesPage.tsx` — Lista y CRUD de sucursales de una empresa

#### Páginas — Configuración → Integraciones por empresa

- [ ] `src/pages/configuracion/BankProfilesPage.tsx` — Lista y formulario de perfiles bancarios por empresa
- [ ] `src/pages/configuracion/ElectronicInvoicingPage.tsx` — Lista y formulario de perfiles FEL/CFDI/DTE por empresa

#### Componente Company Selector (sidebar)

- [ ] `src/components/CompanySelector.tsx` — Dropdown en el sidebar mostrando empresa activa; al seleccionar otra, llama `setActiveCompany()` y actualiza `X-Company-ID`
- [ ] `src/layouts/MainLayout.tsx` — Integrar `CompanySelector` sobre el menú de navegación

#### Rutas en `App.tsx`

- [ ] `/configuracion/empresas` → `EmpresasPage`
- [ ] `/configuracion/empresas/nueva` → `EmpresaFormPage`
- [ ] `/configuracion/empresas/:id` → `EmpresaFormPage`
- [ ] `/configuracion/empresas/:id/configuracion` → `EmpresaSettingsPage`
- [ ] `/configuracion/empresas/:id/sucursales` → `SucursalesPage`
- [ ] `/configuracion/empresas/:id/integraciones/bancos` → `BankProfilesPage`
- [ ] `/configuracion/empresas/:id/integraciones/facturacion` → `ElectronicInvoicingPage`

#### Menú de Configuración

- [ ] `src/layouts/MainLayout.tsx` — Agregar sección "Empresa" al submenú de Configuración con los nuevos ítems

---

### CIERRE SPRINT 0

- [ ] Typecheck frontend sin errores (`npm run typecheck`)
- [ ] Build backend sin errores (`npm run build`)
- [ ] GMARK S.A. aparece como empresa default al iniciar sesión
- [ ] Company Selector visible en sidebar y funcional
- [ ] Cambio de empresa actualiza el header `X-Company-ID` en Axios
- [ ] Todos los módulos existentes siguen funcionando (sin regresiones)
- [ ] Deploy a Railway (backend) y Vercel (frontend)

---
---

## SPRINT 1 — MIGRACIÓN BASE DE DATOS
### Riesgo: Bajo · Backfill garantiza continuidad

- [ ] Migración SQL atómica: agregar `company_id UUID` a las ~45 tablas
  - [ ] Tablas maestras: customers, vendors, accounts, taxes, items, bank_accounts, employees
  - [ ] Tablas transaccionales: invoices, purchase_invoices, estimates, purchase_orders, payments, vendor_payments, journal_entries, journal_entry_lines
  - [ ] Tablas de soporte: credit_notes, expenses, fixed_assets, warehouses, cost_centers, projects
- [ ] Backfill automático: todos los registros existentes → empresa default del tenant
- [ ] Agregar `NOT NULL` en tablas críticas (invoices, customers, vendors, accounts, journal_entries) post-backfill
- [ ] Índices: `CREATE INDEX ON invoices(company_id)` en todas las tablas críticas
- [ ] CompanyContext REQUEST-SCOPED (NestJS): `@Injectable({ scope: Scope.REQUEST })`
- [ ] Middleware actualizado: resuelve `companyId` desde `X-Company-ID` header o empresa default del usuario
- [ ] Guard `CompanyContextGuard` aplicado globalmente
- [ ] Validación: si `company_id` inválido para el tenant → 403 Forbidden
- [ ] Verificar GMARK en producción: datos existentes correctamente asignados a empresa default

---

## SPRINT 2 — SERVICIOS CORE
### Riesgo: Medio · Deploy coordinado

**Patrón mecánico en cada servicio:**
```typescript
// Antes: where: { tenantId }
// Después: where: { tenantId: this.ctx.tenantId, companyId: this.ctx.companyId }
// Firma pública de métodos: sin cambios
```

- [ ] `customers.service.ts` — filtrado por companyId
- [ ] `vendors.service.ts` — filtrado por companyId
- [ ] `invoices.service.ts` — filtrado + asignación al crear
- [ ] `purchase-invoices.service.ts`
- [ ] `catalogo.service.ts` (cuentas contables) — plan de cuentas por empresa + `cloneChartOfAccounts(templateId, companyId)`
- [ ] `journal-entries.service.ts` — asientos por empresa
- [ ] `bank-accounts.service.ts`
- [ ] `payments.service.ts` (pagos recibidos)
- [ ] `vendor-payments.service.ts`
- [ ] Verificar endpoints de listado: paginación correcta por empresa

---

## SPRINT 3 — SERVICIOS SECUNDARIOS
### Riesgo: Bajo

- [ ] `estimates.service.ts` (cotizaciones)
- [ ] `purchase-orders.service.ts` (órdenes de compra)
- [ ] `credit-notes.service.ts` (notas de crédito)
- [ ] `expenses.service.ts` (gastos)
- [ ] `fixed-assets.service.ts` (activos fijos)
- [ ] `items.service.ts` (artículos/inventario)
- [ ] `taxes.service.ts` — `company_id` nullable: `null` = impuesto compartido, valor = empresa específica
- [ ] `fel.service.ts` — refactorizar para usar `company_electronic_invoicing` en lugar de integraciones del tenant
- [ ] Reportes: Libro de Compras filtrado por empresa
- [ ] Reportes: Libro de Ventas filtrado por empresa
- [ ] Reportes: AP Aging por empresa
- [ ] Reportes: AR Aging por empresa

---

## SPRINT 4 — FRONTEND MULTI-EMPRESA
### Riesgo: Bajo · Solo UI

- [ ] Breadcrumb en header: `[Grupo Castillo] > [Castillo Guatemala] > Facturas`
- [ ] Todas las listas (facturas, clientes, proveedores, etc.) operan en contexto de empresa activa
- [ ] Formularios de creación asignan `company_id` automáticamente desde contexto
- [ ] Permisos por empresa: usuario con acceso a Empresa A no ve datos de Empresa B
- [ ] Configuración → Integraciones FEL funcionando por empresa (con las nuevas entidades)
- [ ] Configuración → Bancos funcionando por empresa
- [ ] Configuración → Numeraciones de documentos por empresa
- [ ] Platform Admin (GLL): vista de todos los tenants, empresas, usuarios y planes
- [ ] Manejo de estado cuando el usuario no tiene empresa asignada

---

## SPRINT 5 — ONBOARDING Y DEMO
### Riesgo: Cero · Datos demo separados

- [ ] Wizard de onboarding: Tenant → Empresa → Régimen Fiscal → Plan de Cuentas → Usuarios → Módulos
- [ ] Templates de plan de cuentas por país (Guatemala como primer template)
- [ ] Tenant demo "Grupo Castillo" con 5 empresas completamente aisladas:
  - [ ] Castillo Guatemala S.A.
  - [ ] Castillo Honduras S.A.
  - [ ] Castillo El Salvador S.A.
  - [ ] Castillo Panamá S.A.
  - [ ] Castillo Inmobiliaria S.A.
- [ ] Verificación: factura en Empresa A no visible en Empresa B
- [ ] Verificación: FEL de Empresa A no expuesto en Empresa B
- [ ] Verificación: consolidación funciona correctamente con ChartOfAccounts + CompanyChartMapping
- [ ] Documentación técnica para el cliente

---

## RESUMEN EJECUTIVO

| Sprint | Semana | Contenido | Riesgo |
|--------|--------|-----------|--------|
| 0 — Fundación | 1 | Entidades + APIs + Company Selector | **Cero** |
| 1 — Migración BD | 2 | company_id en 45 tablas + backfill | Bajo |
| 2 — Servicios Core | 3 | 9 servicios principales | Medio |
| 3 — Servicios Rest | 4 | Servicios secundarios + FEL + Reportes | Bajo |
| 4 — Frontend | 5 | UI multi-empresa completa | Bajo |
| 5 — Demo | 6 | Onboarding + Grupo Castillo | Cero |

**Resultado final:** ERP Enterprise con soporte para grupos empresariales multi-país, sin necesidad de rediseño arquitectónico futuro.
