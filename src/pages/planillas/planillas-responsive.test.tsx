import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'
import { MemoryRouter } from 'react-router-dom'

/**
 * Los listados de Planillas en el teléfono.
 *
 * La regla de los tres tamaños: teléfono (≤767) tarjetas, tablet (768–1024)
 * la misma tabla corrida de lado, escritorio la tabla completa.
 *
 * Lo propio de este módulo son las SALIDAS de una corrida: sus dos pólizas
 * —la de planilla y la de pago—, el detalle mensual, las boletas y el
 * archivo de la planilla electrónica del IGSS. Son lo que se usa después de
 * aprobar, y por eso tienen que seguir estando en la tarjeta. Si se pierden,
 * en el teléfono la planilla queda de solo lectura sin que nadie lo haya
 * decidido: eso es lo que se vigila aquí.
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

const PERIODOS = [
  {
    /** Segunda quincena aprobada y contabilizada: trae TODAS las salidas. */
    id: 'pp-1', anio: 2026, mes: 11, quincena: 2, periodicidad: 'QUINCENAL',
    tipo: 'ORDINARIA', fechaInicio: '2026-11-16', fechaFin: '2026-11-30',
    estado: 'CONTABILIZADA', usarIsrProyectado: false,
    totalDevengado: 85000, totalDeducciones: 7225.5, totalNeto: 77774.5,
    totalCuotaPatronal: 10412.5, totalEmpleados: 12, notas: null,
    aprobadoAt: '2026-11-30T18:00:00Z', aprobadoPor: 'luis',
    asientoContableId: 'je-1', asientoPagoId: 'je-2',
  },
  {
    /** Primera quincena en borrador: sin pólizas y sin salidas de fin de mes. */
    id: 'pp-2', anio: 2026, mes: 11, quincena: 1, periodicidad: 'QUINCENAL',
    tipo: 'ORDINARIA', fechaInicio: '2026-11-01', fechaFin: '2026-11-15',
    estado: 'BORRADOR', usarIsrProyectado: false,
    totalDevengado: 42500, totalDeducciones: 0, totalNeto: 42500,
    totalCuotaPatronal: 0, totalEmpleados: 12, notas: null,
    aprobadoAt: null, aprobadoPor: null,
    asientoContableId: null, asientoPagoId: null,
  },
  {
    /** Corrida anual: quincena 0, con su propio rango de cómputo. */
    id: 'pp-3', anio: 2026, mes: 7, quincena: 0, periodicidad: 'QUINCENAL',
    tipo: 'BONO14', fechaInicio: '2026-07-01', fechaFin: '2026-07-14',
    estado: 'PAGADA', usarIsrProyectado: false,
    totalDevengado: 38000, totalDeducciones: 0, totalNeto: 38000,
    totalCuotaPatronal: 0, totalEmpleados: 11, notas: null,
    aprobadoAt: '2026-07-10T18:00:00Z', aprobadoPor: 'luis',
    asientoContableId: 'je-3', asientoPagoId: null,
  },
]

const EMPLEADOS = [
  {
    id: 'em-1', codigo: 'EMP-001',
    primerNombre: 'Jorge', segundoNombre: null, primerApellido: 'Acevedo', segundoApellido: null,
    apellidoCasada: null, nit: '1234567', dpi: null, fechaNacimiento: null,
    direccion: null, telefono: null, email: null, puesto: 'Contador general',
    tipoActividadEconomica: 'NO_AGRICOLA', circunscripcionEconomica: 'CE1',
    tipoJornada: 'DIURNA', tipoContrato: 'INDEFINIDO',
    numeroAfiliadoIGSS: '123456789', codigoOcupacionIGSS: null, centroTrabajoId: null,
    metodoPago: 'TRANSFERENCIA', bancoCodigo: null, bancoNombre: null,
    tipoCuentaBancaria: null, monedaCuenta: 'GTQ', numeroCuentaBancaria: null,
    centroCostoId: null, centroBeneficioId: null,
    fechaAlta: '2024-03-01', fechaBaja: null, estado: 'ACTIVO',
    fechaAntiguedad: null, saldosInicialesAnio: null,
    ingresosAcumuladosInicial: 0, isrRetenidoInicial: 0, igssLaboralInicial: 0,
    salarioVigente: 9500, salarioDesde: '2026-01-01',
  },
  {
    /** Sin puesto y sin afiliado IGSS: el pendiente frena el archivo del
     *  IGSS, así que la tarjeta lo dice en vez de esconderlo. */
    id: 'em-2', codigo: 'EMP-002',
    primerNombre: 'María', segundoNombre: null, primerApellido: 'López', segundoApellido: null,
    apellidoCasada: null, nit: null, dpi: null, fechaNacimiento: null,
    direccion: null, telefono: null, email: null, puesto: null,
    tipoActividadEconomica: 'NO_AGRICOLA', circunscripcionEconomica: 'CE1',
    tipoJornada: 'MIXTA', tipoContrato: 'INDEFINIDO',
    numeroAfiliadoIGSS: null, codigoOcupacionIGSS: null, centroTrabajoId: null,
    metodoPago: 'EFECTIVO', bancoCodigo: null, bancoNombre: null,
    tipoCuentaBancaria: null, monedaCuenta: 'GTQ', numeroCuentaBancaria: null,
    centroCostoId: null, centroBeneficioId: null,
    fechaAlta: '2026-09-15', fechaBaja: null, estado: 'ACTIVO',
    fechaAntiguedad: null, saldosInicialesAnio: null,
    ingresosAcumuladosInicial: 0, isrRetenidoInicial: 0, igssLaboralInicial: 0,
    salarioVigente: null, salarioDesde: null,
  },
]

const FINIQUITOS = [
  {
    id: 'fq-1', empleadoId: 'em-3', empleadoNombre: 'Pedro Ramírez', empleadoCodigo: 'EMP-003',
    motivoBaja: 'DESPIDO_INJUSTIFICADO', fechaBaja: '2026-10-31',
    netoAPagar: 23450.75, estado: 'CONTABILIZADO',
  },
]

const CENTROS = [
  {
    id: 'ct-1', codigo: '1', nombre: 'Oficinas centrales', direccion: null, zona: '10',
    telefono: null, departamento: '01', municipio: '0101',
    codigoActividadEconomica: '7020', activo: true,
  },
  /** Centro sin geografía ni actividad: no debe dejar «undefined» en la tarjeta. */
  {
    id: 'ct-2', codigo: '2', nombre: 'Bodega', direccion: null, zona: null,
    telefono: null, departamento: null, municipio: null,
    codigoActividadEconomica: null, activo: false,
  },
]

const SALARIOS = [
  { id: 'sm-1', anio: 2026, circunscripcionEconomica: 'CE1', tipoActividadEconomica: 'NO_AGRICOLA', montoDiario: 112.07, montoMensual: 3406.79, fechaVigenciaDesde: null, fechaVigenciaHasta: null },
  { id: 'sm-2', anio: 2026, circunscripcionEconomica: 'CE2', tipoActividadEconomica: 'AGRICOLA',    montoDiario: 108.00, montoMensual: 3283.20, fechaVigenciaDesde: null, fechaVigenciaHasta: null },
]

vi.mock('../../api/planillas-corrida', async (importOriginal) => {
  const real = await importOriginal<any>()
  return { ...real, getPeriodosPlanilla: vi.fn(async () => PERIODOS) }
})

vi.mock('../../api/planillas-empleados', async (importOriginal) => {
  const real = await importOriginal<any>()
  return {
    ...real,
    getEmpleados:       vi.fn(async () => EMPLEADOS),
    getCentrosTrabajo:  vi.fn(async () => CENTROS),
  }
})

vi.mock('../../api/planillas-finiquito', async (importOriginal) => {
  const real = await importOriginal<any>()
  return { ...real, listarFiniquitos: vi.fn(async () => FINIQUITOS) }
})

vi.mock('../../api/planillas', async (importOriginal) => {
  const real = await importOriginal<any>()
  return {
    ...real,
    getPatrono:          vi.fn(async () => ({ periodicidadPago: 'QUINCENAL' })),
    getSalariosMinimos:  vi.fn(async () => SALARIOS),
    getParametroFiscal:  vi.fn(async () => null),
  }
})

describe('los listados de Planillas en el teléfono', () => {
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

  const dibujar = async (ruta: string) => {
    const { default: Pagina } = await import(/* @vite-ignore */ ruta)
    await act(async () => { root.render(<MemoryRouter><Pagina /></MemoryRouter>) })
    await act(async () => { await new Promise(r => setTimeout(r, 90)) })
  }

  /** Una tabla de AntD deja su `<table>` en el DOM; una pila de tarjetas, no. */
  const hayTabla = () => div.querySelectorAll('table').length > 0
  const texto = () => div.textContent ?? ''
  const botones = () => [...div.querySelectorAll('button')].map(b => b.textContent ?? '')
  const hayBoton = (t: string) => botones().some(b => b.includes(t))

  describe('Generar Planilla (corridas)', () => {
    const PAGINA = './corrida/PeriodosPlanillaPage'

    it('la tarjeta lleva el neto arriba y el devengado debajo', async () => {
      pantallaDe(375)
      await dibujar(PAGINA)
      expect(texto()).toContain('Noviembre 2026')
      expect(texto()).toContain('2da quincena (16-fin)')
      expect(texto()).toContain('12 empleados')
      expect(texto()).toContain('Q 77,774.50')              // neto a pagar
      expect(texto()).toContain('Devengado Q 85,000.00')
      expect(texto()).toContain('Patronal Q 10,412.50')
      expect(texto()).toContain('CONTABILIZADA')
      expect(hayTabla()).toBe(false)
    })

    /** Una corrida de Bono 14 no tiene mes ni quincena: su propio rango. */
    it('la corrida anual se nombra por su tipo y su rango de cómputo', async () => {
      pantallaDe(375)
      await dibujar(PAGINA)
      expect(texto()).toContain('Bono 14 2026')
      expect(texto()).toContain('jul/2025 → jun/2026')
      expect(texto()).toContain('corrida anual')
    })

    it('las salidas de la corrida siguen en la tarjeta', async () => {
      pantallaDe(375)
      await dibujar(PAGINA)
      // La 2da quincena contabilizada: sus dos pólizas y las tres salidas.
      expect(hayBoton('Póliza')).toBe(true)
      expect(hayBoton('Pago')).toBe(true)
      expect(hayBoton('Detalle')).toBe(true)
      expect(hayBoton('Boletas')).toBe(true)
      expect(hayBoton('IGSS')).toBe(true)
      // Detalle, Boletas e IGSS son de fin de mes: solo la 2da quincena.
      expect(botones().filter(b => b.includes('Boletas'))).toHaveLength(1)
      // La póliza de pago existe en una sola de las tres corridas.
      expect(botones().filter(b => b === 'Pago')).toHaveLength(1)
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

  describe('Empleados', () => {
    const PAGINA = './empleados/EmpleadosPage'

    it('la tarjeta trae puesto, jornada, salario vigente y su fecha', async () => {
      pantallaDe(375)
      await dibujar(PAGINA)
      expect(texto()).toContain('Jorge Acevedo')
      expect(texto()).toContain('EMP-001')
      expect(texto()).toContain('Contador general')
      expect(texto()).toContain('Diurna')
      expect(texto()).toContain('Q 9,500.00')
      expect(texto()).toContain('desde 01/01/2026')
      expect(texto()).toContain('IGSS 123456789')
      expect(hayTabla()).toBe(false)
    })

    /** El afiliado IGSS pendiente frena la planilla electrónica: se dice. */
    it('un empleado sin puesto ni afiliado IGSS lo dice en la tarjeta', async () => {
      pantallaDe(375)
      await dibujar(PAGINA)
      expect(texto()).toContain('María López')
      expect(texto()).toContain('sin puesto')
      expect(texto()).toContain('IGSS pendiente')
      expect(texto()).not.toContain('undefined')
    })

    it('en tablet sigue siendo la tabla', async () => {
      pantallaDe(810)
      await dibujar(PAGINA)
      expect(hayTabla()).toBe(true)
    })
  })

  describe('Finiquitos', () => {
    const PAGINA = './finiquito/FiniquitosListPage'

    it('la tarjeta trae motivo, fecha de baja y neto', async () => {
      pantallaDe(375)
      await dibujar(PAGINA)
      expect(texto()).toContain('Pedro Ramírez')
      expect(texto()).toContain('EMP-003')
      expect(texto()).toContain('Despido injustificado')
      expect(texto()).toContain('baja 31/10/2026')
      expect(texto()).toContain('Q 23,450.75')
      expect(hayTabla()).toBe(false)
    })

    it('en tablet sigue siendo la tabla', async () => {
      pantallaDe(810)
      await dibujar(PAGINA)
      expect(hayTabla()).toBe(true)
    })
  })

  describe('Centros de trabajo', () => {
    const PAGINA = './configuracion/CentrosTrabajoPage'

    it('la tarjeta trae el departamento, el municipio y la actividad IGSS', async () => {
      pantallaDe(375)
      await dibujar(PAGINA)
      expect(texto()).toContain('Oficinas centrales')
      expect(texto()).toContain('Guatemala')
      expect(texto()).toContain('Actividad IGSS 7020')
      expect(hayTabla()).toBe(false)
    })

    it('un centro sin geografía ni actividad no deja undefined', async () => {
      pantallaDe(375)
      await dibujar(PAGINA)
      expect(texto()).toContain('Bodega')
      expect(texto()).toContain('Actividad IGSS —')
      expect(texto()).not.toContain('undefined')
    })

    it('en tablet sigue siendo la tabla', async () => {
      pantallaDe(810)
      await dibujar(PAGINA)
      expect(hayTabla()).toBe(true)
    })
  })

  describe('Salarios mínimos (parámetros fiscales)', () => {
    const PAGINA = './configuracion/ParametrosFiscalesPage'

    it('cada salario mínimo sale como tarjeta, con el mensual arriba', async () => {
      pantallaDe(375)
      await dibujar(PAGINA)
      expect(texto()).toContain('No agrícola')
      expect(texto()).toContain('CE1 — Depto. Guatemala')
      expect(texto()).toContain('Q 3,406.79')
      expect(texto()).toContain('Q 112.07 diario')
      expect(texto()).toContain('CE2 — Resto del país')
    })

    it('en tablet sigue siendo la tabla', async () => {
      pantallaDe(810)
      await dibujar(PAGINA)
      expect(hayTabla()).toBe(true)
    })
  })
})
