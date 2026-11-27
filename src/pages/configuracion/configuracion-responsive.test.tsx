import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

/**
 * Los listados de Configuración en el teléfono.
 *
 * La regla de los tres tamaños: teléfono (≤767) tarjetas, tablet (768–1024)
 * la misma tabla corrida de lado, escritorio la tabla completa.
 *
 * En Configuración hay dos cosas que no se pueden perder al pasar a
 * tarjetas: lo que DISTINGUE un registro peligroso de uno inocuo —un perfil
 * FEL en producción frente a uno en sandbox, un impuesto sin cuenta
 * contable, un usuario bloqueado— y los controles que se editan en la
 * propia fila —el rol de un usuario en la empresa, el interruptor de una
 * unidad de medida—. Eso es lo que se vigila aquí.
 */

/** Finge una pantalla de ese ancho para `window.matchMedia`. */
function pantallaDe(ancho: number) {
  window.matchMedia = ((query: string) => {
    const max = /max-width:\s*(\d+)px/.exec(query)
    const min = /min-width:\s*(\d+)px/.exec(query)
    const cumpleMax = max ? ancho <= Number(max[1]) : true
    const cumpleMin = min ? ancho >= Number(min[1]) : true
    return {
      matches: cumpleMax && cumpleMin,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
    }
  }) as any
}

const EMPRESA = {
  id: '11111111-2222-3333-4444-555555555555',
  legalName: 'Kaizen Consulting, S.A.', tradeName: 'Kaizen',
  taxId: '117457620', taxIdLabel: 'NIT',
  countryCode: 'GT', currencyCode: 'GTQ',
  status: 'active', isDefault: true,
}
const EMPRESA_2 = {
  ...EMPRESA,
  id: '66666666-7777-8888-9999-000000000000',
  legalName: 'Mario Alberto de Paz', tradeName: null,
  taxId: null, taxIdLabel: null, status: 'inactive', isDefault: false,
}

const UNIDADES = [
  { id: 'u-1', code: 'UND', name: 'Unidad', description: 'Pieza suelta', isActive: true,  isSystem: true,  sortOrder: 1 },
  /** Sin descripción e inactiva, y no es del sistema: sí se puede eliminar. */
  { id: 'u-2', code: 'CAJ', name: 'Caja',   description: undefined,      isActive: false, isSystem: false, sortOrder: 2 },
]

const SUCURSALES = [
  { id: 'b-1', companyId: EMPRESA.id, name: 'Casa central', code: 'S-01', city: 'Guatemala', phone: '22334455', managerName: 'Ana López', isDefault: true,  isActive: true },
  { id: 'b-2', companyId: EMPRESA.id, name: 'Bodega zona 12', code: undefined, city: undefined, phone: undefined, managerName: undefined, isDefault: false, isActive: true },
]

const PERFILES_FEL = [
  {
    id: 'fel-1', companyId: EMPRESA.id, provider: 'infile', status: 'active',
    environment: 'production', lastTestedAt: '2026-11-20T15:00:00Z', lastTestResult: null,
    apiConfigurationJson: { regimeCode: 'GEN', defaultDocumentType: 'FACT' },
  },
  {
    id: 'fel-2', companyId: EMPRESA.id, provider: 'megaprint', status: 'inactive',
    environment: 'sandbox', lastTestedAt: null, lastTestResult: null,
    apiConfigurationJson: {},
  },
]

const PERFILES_BANCO = [
  {
    id: 'bp-1', companyId: EMPRESA.id, bankName: 'Banco Industrial', status: 'active',
    integrationProvider: 'bi_api', countryCode: 'GT', lastTestedAt: '2026-11-18T10:00:00Z',
  },
  {
    id: 'bp-2', companyId: EMPRESA.id, bankName: 'Banrural', status: 'inactive',
    integrationProvider: undefined, countryCode: 'GT', lastTestedAt: null,
  },
]

const SERIES = [
  { id: 's-1', companyId: EMPRESA.id, documentType: 'factura_venta', prefix: 'FAC', series: null, separator: '-', currentNumber: 120, padding: 5 },
]

const USUARIOS_EMPRESA = [
  /** Un Super Admin no cambia de rol: ni aquí ni en la tabla. */
  { id: 'cu-1', userId: 'us-1', companyId: EMPRESA.id, roleIds: [] },
  { id: 'cu-2', userId: 'us-2', companyId: EMPRESA.id, roleIds: ['contador'] },
]

const USUARIOS_TENANT = [
  {
    id: 'us-1', firstName: 'Luis', lastName: 'Chajón', email: 'chogui@example.com',
    status: 'active', isSuperAdmin: true, mustChangePassword: false,
    roles: [], lastLoginAt: '2026-11-25T08:00:00Z',
    failedLoginAttempts: 0, lockedUntil: null,
  },
  {
    /** Bloqueado por el admin: la tarjeta lo tiene que decir. */
    id: 'us-2', firstName: 'Carlos', lastName: 'Pérez', email: 'carlos@example.com',
    status: 'suspended', isSuperAdmin: false, mustChangePassword: true,
    roles: [{ id: 'r-1', name: 'Contador' }], lastLoginAt: null,
    failedLoginAttempts: 0, lockedUntil: null,
  },
]

const IMPUESTOS = [
  {
    id: 'tx-1', code: 'IVA-12', name: 'IVA 12%', description: 'IVA general',
    category: 'iva', subtype: 'percentage', applicability: 'sales',
    rate: 12, isActive: true, isSystem: true, isWithholding: false,
    salesAccountId: 'acc-1', purchaseAccountId: null,
  },
  {
    /** Sin cuenta contable: es lo que frena la contabilización, y se dice. */
    id: 'tx-2', code: 'IVA-0', name: 'Exento', description: null,
    category: 'iva', subtype: 'percentage', applicability: 'sales',
    rate: 0, isActive: true, isSystem: false, isWithholding: false,
    salesAccountId: null, purchaseAccountId: null,
  },
]

const CUENTAS = [
  { id: 'acc-1', code: '210301', name: 'IVA por Pagar', isActive: true },
]

vi.mock('../../store/authStore', async (importOriginal) => {
  const real = await importOriginal<any>().catch(() => ({}))
  const estado = {
    user: {
      id: 'us-1', email: 'chogui@example.com', firstName: 'Luis', lastName: 'Chajón',
      isSuperAdmin: true, roles: [],
    },
  }
  /** Axios tambien llega al store: necesita getState y logout. */
  const useAuthStore: any = (sel: any) => (sel ? sel(estado) : estado)
  useAuthStore.getState = () => ({ ...estado, logout: () => {} })
  useAuthStore.setState = () => {}
  return { ...real, useAuthStore }
})

vi.mock('../../store/companyStore', () => ({
  useCompanyStore: (sel: any) => sel({ activeCompany: EMPRESA, setActiveCompany: () => {}, loadCompanies: () => {} }),
}))

vi.mock('../../api/unidades-medida', async (importOriginal) => {
  const real = await importOriginal<any>()
  return { ...real, getUnidades: vi.fn(async () => UNIDADES) }
})

vi.mock('../../api/companies', () => ({
  companiesApi: {
    getAll:               vi.fn(async () => [EMPRESA, EMPRESA_2]),
    getUsers:             vi.fn(async () => []),
    diagnoseData:         vi.fn(async () => ({})),
    getDocumentSeries:    vi.fn(async () => SERIES),
    updateDocumentSeries: vi.fn(),
    getCompanyUsers:      vi.fn(async () => USUARIOS_EMPRESA),
    assignUser:           vi.fn(),
    removeCompanyUser:    vi.fn(),
    updateCompanyUser:    vi.fn(),
  },
}))

vi.mock('../../api/catalogo', async (importOriginal) => {
  const real = await importOriginal<any>().catch(() => ({}))
  return { ...real, getAccounts: vi.fn(async () => CUENTAS) }
})

vi.mock('../../api/libros-sat', async (importOriginal) => {
  const real = await importOriginal<any>().catch(() => ({}))
  return {
    ...real,
    getLibroSATConfig:  vi.fn(async () => real.DEFAULT_CONFIG ?? {}),
    saveLibroSATConfig: vi.fn(),
  }
})

vi.mock('../../api/fiscalRegimes', () => ({
  fiscalRegimesApi: { getAll: vi.fn(async () => []), get: vi.fn(async () => null) },
}))

vi.mock('../../api/billing', () => ({
  getBillingState: vi.fn(async () => ({ subscription: null, tenant: { id: 't', name: 'x', plan: 'pro', status: 'active' }, plans: [], paymentHistory: [] })),
}))

vi.mock('../../api/branches', () => ({
  branchesApi: {
    getAll: vi.fn(async () => SUCURSALES),
    create: vi.fn(), update: vi.fn(), remove: vi.fn(),
  },
}))

vi.mock('../../api/companyIntegrations', () => ({
  companyIntegrationsApi: {
    getEInvoicing:  vi.fn(async () => PERFILES_FEL),
    testEInvoicing: vi.fn(async () => ({ success: true, message: 'ok' })),
    getBankProfiles:  vi.fn(async () => PERFILES_BANCO),
    testBankProfile:  vi.fn(async () => ({ success: true, message: 'ok' })),
    createBankProfile: vi.fn(), updateBankProfile: vi.fn(), removeBankProfile: vi.fn(),
    createEInvoicing: vi.fn(), updateEInvoicing: vi.fn(), removeEInvoicing: vi.fn(),
    getSeries:        vi.fn(async () => SERIES),
  },
}))

vi.mock('../../api/usuarios', async (importOriginal) => {
  const real = await importOriginal<any>().catch(() => ({}))
  return {
    ...real,
    getUsers:  vi.fn(async () => USUARIOS_TENANT),
    getRoles:  vi.fn(async () => [{ id: 'r-1', name: 'Contador', permissions: [] }]),
    getMe:     vi.fn(async () => USUARIOS_TENANT[0]),
  }
})

vi.mock('../../api/impuestos', async (importOriginal) => {
  const real = await importOriginal<any>().catch(() => ({}))
  return { ...real, getTaxes: vi.fn(async () => IMPUESTOS) }
})

vi.mock('../../api/cuentas', async (importOriginal) => {
  const real = await importOriginal<any>().catch(() => ({}))
  return { ...real, getAccounts: vi.fn(async () => CUENTAS) }
})

describe('los listados de Configuración en el teléfono', () => {
  let div: HTMLDivElement
  let root: Root
  const original = window.matchMedia

  beforeEach(() => {
    div = document.createElement('div')
    document.body.appendChild(div)
    root = createRoot(div)
  })

  afterEach(() => {
    act(() => { root.unmount() })
    div.remove()
    document.body.querySelectorAll(':scope > div').forEach(e => e.remove())
    window.matchMedia = original
  })

  const dibujar = async (ruta: string, nodo?: (P: any) => any) => {
    const { default: Pagina } = await import(/* @vite-ignore */ ruta)
    await act(async () => {
      root.render(nodo ? nodo(Pagina) : <MemoryRouter><Pagina /></MemoryRouter>)
    })
    await act(async () => { await new Promise(r => setTimeout(r, 90)) })
  }

  /** Una tabla de AntD deja su `<table>` en el DOM; una pila de tarjetas, no. */
  const hayTabla = () => div.querySelectorAll('table').length > 0
  const texto = () => div.textContent ?? ''
  const hayBoton = (t: string) =>
    [...div.querySelectorAll('button')].some(b => (b.textContent ?? '').includes(t))

  describe('Unidades de medida', () => {
    const PAGINA = './UnidadesMedidaPage'

    it('la tarjeta trae el código, la descripción y el interruptor de activa', async () => {
      pantallaDe(375)
      await dibujar(PAGINA)
      expect(texto()).toContain('Unidad')
      expect(texto()).toContain('UND')
      expect(texto()).toContain('Pieza suelta')
      expect(texto()).toContain('del sistema')
      // El interruptor de activa, que es el control propio de este listado.
      expect(div.querySelectorAll('.ant-switch').length).toBeGreaterThan(0)
      expect(hayTabla()).toBe(false)
    })

    /** Una unidad del sistema no se puede eliminar: hay un solo botón de
     *  eliminar, el de la que no es del sistema. */
    it('solo la unidad que no es del sistema se puede eliminar', async () => {
      pantallaDe(375)
      await dibujar(PAGINA)
      expect(texto()).toContain('Caja')
      expect(texto()).toContain('Inactiva')
      const eliminar = [...div.querySelectorAll('button.ant-btn-dangerous')]
      expect(eliminar).toHaveLength(1)
    })

    it('en tablet y escritorio sigue siendo la tabla', async () => {
      pantallaDe(810)
      await dibujar(PAGINA)
      expect(hayTabla()).toBe(true)
      act(() => { root.unmount() })
      root = createRoot(div)
      pantallaDe(1440)
      await dibujar(PAGINA)
      expect(hayTabla()).toBe(true)
    })
  })

  describe('Empresas', () => {
    const PAGINA = './empresas/EmpresasPage'

    it('la tarjeta trae el ID de organización, el NIT y las acciones', async () => {
      pantallaDe(375)
      await dibujar(PAGINA)
      expect(texto()).toContain('Kaizen Consulting, S.A.')
      expect(texto()).toContain('ID org')
      expect(texto()).toContain('NIT: 117457620')
      expect(texto()).toContain('GT GTQ')
      expect(hayBoton('Usar')).toBe(true)
      expect(hayBoton('Editar')).toBe(true)
      expect(hayTabla()).toBe(false)
    })

    /** La principal no se elimina ni se marca como principal otra vez; la
     *  bloqueada ofrece Activar en vez de Bloquear. */
    it('cada empresa ofrece solo las acciones que le corresponden', async () => {
      pantallaDe(375)
      await dibujar(PAGINA)
      expect(texto()).toContain('Mario Alberto de Paz')
      expect(texto()).toContain('sin NIT')
      expect(hayBoton('Principal')).toBe(true)   // la segunda, que no lo es
      expect(hayBoton('Bloquear')).toBe(true)    // la activa
      expect(hayBoton('Activar')).toBe(true)     // la inactiva
    })

    it('en tablet sigue siendo la tabla', async () => {
      pantallaDe(810)
      await dibujar(PAGINA)
      expect(hayTabla()).toBe(true)
    })
  })

  describe('Sucursales', () => {
    const PAGINA = './empresas/SucursalesPage'
    const conRuta = (P: any) => (
      <MemoryRouter initialEntries={[`/configuracion/empresas/${EMPRESA.id}/sucursales`]}>
        <Routes><Route path="/configuracion/empresas/:id/sucursales" element={<P />} /></Routes>
      </MemoryRouter>
    )

    it('la tarjeta trae código, ciudad y encargado', async () => {
      pantallaDe(375)
      await dibujar(PAGINA, conRuta)
      expect(texto()).toContain('Casa central')
      expect(texto()).toContain('S-01')
      expect(texto()).toContain('Guatemala')
      expect(texto()).toContain('Ana López')
      expect(texto()).toContain('Principal')
      expect(hayTabla()).toBe(false)
    })

    it('una sucursal sin código ni encargado no deja undefined', async () => {
      pantallaDe(375)
      await dibujar(PAGINA, conRuta)
      expect(texto()).toContain('Bodega zona 12')
      expect(texto()).toContain('sin código')
      expect(texto()).not.toContain('undefined')
    })

    it('en tablet sigue siendo la tabla', async () => {
      pantallaDe(810)
      await dibujar(PAGINA, conRuta)
      expect(hayTabla()).toBe(true)
    })
  })

  describe('Facturación electrónica (FEL)', () => {
    const PAGINA = './empresas/ElectronicInvoicingPage'

    /** Producción y sandbox es lo que no se puede confundir en esta pantalla. */
    it('la tarjeta distingue producción de sandbox', async () => {
      pantallaDe(375)
      await dibujar(PAGINA)
      expect(texto()).toContain('Producción')
      expect(texto()).toContain('Sandbox')
      expect(texto()).toContain('sin régimen')     // el perfil sin configurar
      expect(texto()).toContain('sin pruebas')
      expect(hayBoton('Probar')).toBe(true)
      expect(hayTabla()).toBe(false)
    })

    it('en tablet sigue siendo la tabla', async () => {
      pantallaDe(810)
      await dibujar(PAGINA)
      expect(hayTabla()).toBe(true)
    })
  })

  describe('Perfiles bancarios', () => {
    const PAGINA = './empresas/BankProfilesPage'

    it('la tarjeta dice si el perfil es por API o manual', async () => {
      pantallaDe(375)
      await dibujar(PAGINA)
      expect(texto()).toContain('Banco Industrial')
      expect(texto()).toContain('Banrural')
      expect(texto()).toContain('Manual')          // el que no tiene proveedor
      expect(hayBoton('Probar')).toBe(true)
      expect(hayTabla()).toBe(false)
    })

    it('en tablet sigue siendo la tabla', async () => {
      pantallaDe(810)
      await dibujar(PAGINA)
      expect(hayTabla()).toBe(true)
    })
  })

  describe('Usuarios y roles', () => {
    const PAGINA = './usuarios/UsuariosPage'

    it('la tarjeta dice el rol, el último acceso y si está bloqueado', async () => {
      pantallaDe(375)
      await dibujar(PAGINA)
      expect(texto()).toContain('Luis Chajón')
      expect(texto()).toContain('Super Admin')
      expect(texto()).toContain('Carlos Pérez')
      expect(texto()).toContain('Contador')
      expect(texto()).toContain('Bloqueado por admin')
      expect(texto()).toContain('Clave temporal')
      expect(texto()).toContain('sin accesos')
      expect(hayTabla()).toBe(false)
    })

    /** Un usuario bloqueado ofrece Desbloquear; el propio usuario no se
     *  puede bloquear a sí mismo. */
    it('las acciones del usuario siguen en la tarjeta', async () => {
      pantallaDe(375)
      await dibujar(PAGINA)
      expect(hayBoton('Editar')).toBe(true)
      expect(hayBoton('Empresas')).toBe(true)
      expect(hayBoton('Clave')).toBe(true)
      expect(hayBoton('Desbloquear')).toBe(true)
      expect(hayBoton('Bloquear')).toBe(false)   // el único otro es uno mismo
    })

    it('en tablet sigue siendo la tabla', async () => {
      pantallaDe(810)
      await dibujar(PAGINA)
      expect(hayTabla()).toBe(true)
    })
  })

  describe('Correlativos internos (series)', () => {
    const PAGINA = './empresas/SeriesDocumentalesPage'

    /** De una serie, lo que se viene a ver es qué número sale ahora. */
    it('la tarjeta trae el actual y el próximo número', async () => {
      pantallaDe(375)
      await dibujar(PAGINA)
      expect(texto()).toContain('Facturas de Venta')
      expect(texto()).toContain('Prefijo FAC')
      expect(texto()).toContain('5 díg.')
      expect(texto()).toContain('FAC-00120')     // el actual
      expect(texto()).toContain('FAC-00121')     // el próximo
      expect(hayBoton('Ajustar contador')).toBe(true)
      expect(hayTabla()).toBe(false)
    })

    it('en tablet sigue siendo la tabla', async () => {
      pantallaDe(810)
      await dibujar(PAGINA)
      expect(hayTabla()).toBe(true)
    })
  })

  describe('Usuarios de la empresa', () => {
    const PAGINA = './empresas/CompanyUsersPage'
    const conRuta = (P: any) => (
      <MemoryRouter initialEntries={[`/configuracion/empresas/${EMPRESA.id}/usuarios`]}>
        <Routes><Route path="/configuracion/empresas/:id/usuarios" element={<P />} /></Routes>
      </MemoryRouter>
    )

    /** El rol por empresa se cambia en la propia fila: el selector tiene que
     *  seguir estando en la tarjeta, y un Super Admin no se toca. */
    it('la tarjeta conserva el selector de rol, y el Super Admin no', async () => {
      pantallaDe(375)
      await dibujar(PAGINA, conRuta)
      expect(texto()).toContain('Luis Chajón')
      expect(texto()).toContain('chogui@example.com')
      expect(texto()).toContain('Super Admin')
      expect(texto()).toContain('Carlos Pérez')
      expect(div.querySelectorAll('.ant-select').length).toBe(1)
      expect(hayTabla()).toBe(false)
    })

    it('en tablet sigue siendo la tabla', async () => {
      pantallaDe(810)
      await dibujar(PAGINA, conRuta)
      expect(hayTabla()).toBe(true)
    })
  })

  describe('Impuestos', () => {
    const PAGINA = './impuestos/ImpuestosPage'

    /** Un código sin cuenta contable es lo que frena la contabilización:
     *  la tarjeta lo dice en vez de dejar una raya. */
    it('la tarjeta trae la tasa y avisa del código sin cuenta', async () => {
      pantallaDe(375)
      await dibujar(PAGINA)
      expect(texto()).toContain('IVA 12%')
      expect(texto()).toContain('IVA-12')
      expect(texto()).toContain('210301')
      expect(texto()).toContain('Exento')
      expect(texto()).toContain('Sin cuenta contable')
      expect(hayBoton('Bloquear')).toBe(true)
      expect(hayTabla()).toBe(false)
    })

    it('en tablet sigue siendo la tabla', async () => {
      pantallaDe(810)
      await dibujar(PAGINA)
      expect(hayTabla()).toBe(true)
    })
  })

  describe('Espacio de desarrollo', () => {
    const PAGINA = './EspacioDesarrolloPage'

    it('los perfiles FEL salen como tarjeta, con su botón de probar', async () => {
      pantallaDe(375)
      await dibujar(PAGINA)
      expect(texto()).toContain('Producción')
      expect(texto()).toContain('Sandbox')
      expect(hayBoton('Probar conexión')).toBe(true)
    })
  })
})
