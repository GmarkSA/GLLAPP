/**
 * Motor de insights para reportes analíticos por dimensión.
 *
 * Reglas puras (sin dependencias de UI ni de red) que interpretan los datos
 * de los reportes de Centros de Beneficio y Centros de Costo y producen
 * conclusiones accionables en lenguaje claro. Cada regla es determinista y
 * fácil de testear; para agregar una nueva basta con empujar otro Insight.
 */
import type {
  RentabilidadCBData, CentroBeneficioPyG,
  EjecucionCCData,
} from '../api/reportes-analiticos'

export type InsightNivel = 'danger' | 'warning' | 'info' | 'success'

export interface Insight {
  nivel:   InsightNivel
  titulo:  string
  detalle: string
}

const fmtQ = (n: number) =>
  `Q ${Math.abs(n).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

// ─── Centros de Beneficio ─────────────────────────────────────────────────────

/** Meses consecutivos (hacia atrás desde el último con datos) con utilidad negativa */
function mesesConsecutivosEnPerdida(d: RentabilidadCBData, centroId: string | null): number {
  const serie = d.tendencia
    .filter(t => t.centroId === centroId)
    .sort((a, b) => a.ym.localeCompare(b.ym))
  let n = 0
  for (let i = serie.length - 1; i >= 0; i--) {
    if (serie[i].ingresos - serie[i].egresos < 0) n++
    else break
  }
  return n
}

export function insightsCentrosBeneficio(d: RentabilidadCBData): Insight[] {
  const out: Insight[] = []
  const conMovimiento = d.data.filter(c =>
    c.ingresos + c.otrosIngresos !== 0 || c.costos + c.gastos + c.otrosGastos !== 0)

  // 1. Centros operando con pérdida (con racha de meses consecutivos)
  for (const c of conMovimiento) {
    if (c.utilidadOperativa < 0) {
      const racha = mesesConsecutivosEnPerdida(d, c.centroId)
      const rachaTxt = racha >= 2 ? ` por ${racha} meses consecutivos` : ''
      out.push({
        nivel: 'danger',
        titulo: `${c.nombre} opera con pérdida${rachaTxt}`,
        detalle: `Sus costos y gastos superan a los ingresos en ${fmtQ(c.utilidadOperativa)} en el período. ` +
          (c.responsable ? `Responsable: ${c.responsable}. ` : '') +
          `Revisar la estructura de gasto o la política de precios de esta línea.`,
      })
    }
  }

  // 2. Riesgo de concentración: un centro aporta > 60% de la utilidad total
  const utilTotalPositiva = conMovimiento
    .filter(c => c.utilidadOperativa > 0)
    .reduce((s, c) => s + c.utilidadOperativa, 0)
  if (utilTotalPositiva > 0 && conMovimiento.length > 1) {
    const lider = [...conMovimiento].sort((a, b) => b.utilidadOperativa - a.utilidadOperativa)[0]
    const share = lider.utilidadOperativa / utilTotalPositiva
    if (share > 0.6) {
      out.push({
        nivel: 'warning',
        titulo: `Concentración: ${Math.round(share * 100)}% de la utilidad depende de ${lider.nombre}`,
        detalle: `Si esta línea se debilita, el resultado global queda expuesto. ` +
          `Considerar diversificar o fortalecer los demás centros de beneficio.`,
      })
    }
  }

  // 3. Calidad de datos: movimiento P&L sin centro de beneficio asignado
  const volumenSin = Math.abs(d.sinAsignar.ingresos + d.sinAsignar.otrosIngresos) +
    Math.abs(d.sinAsignar.costos + d.sinAsignar.gastos + d.sinAsignar.otrosGastos)
  const volumenTotal = Math.abs(d.totales.ingresos + d.totales.otrosIngresos) +
    Math.abs(d.totales.costos + d.totales.gastos + d.totales.otrosGastos)
  if (volumenTotal > 0 && volumenSin / volumenTotal > 0.05) {
    out.push({
      nivel: 'warning',
      titulo: `${Math.round((volumenSin / volumenTotal) * 100)}% del movimiento no tiene centro asignado`,
      detalle: `Hay ${fmtQ(volumenSin)} en cuentas de resultados sin centro de beneficio. ` +
        `Los márgenes por centro pierden precisión; revisar los asientos del período y ` +
        `considerar marcar las cuentas críticas con "requiere centro de beneficio" en el catálogo.`,
    })
  }

  // 4. Variación de margen vs período comparativo
  if (d.compPeriod) {
    for (const c of conMovimiento) {
      if (!c.comp || c.margenOperativo == null || c.comp.margenOperativo == null) continue
      const delta = c.margenOperativo - c.comp.margenOperativo
      if (delta <= -3) {
        out.push({
          nivel: 'warning',
          titulo: `${c.nombre}: el margen operativo cayó ${Math.abs(delta).toFixed(1)} puntos`,
          detalle: `Pasó de ${c.comp.margenOperativo.toFixed(1)}% a ${c.margenOperativo.toFixed(1)}% ` +
            `respecto al período comparado. Verificar aumentos de costo o caída de precios.`,
        })
      } else if (delta >= 3) {
        out.push({
          nivel: 'success',
          titulo: `${c.nombre}: el margen operativo mejoró ${delta.toFixed(1)} puntos`,
          detalle: `Pasó de ${c.comp.margenOperativo.toFixed(1)}% a ${c.margenOperativo.toFixed(1)}%. ` +
            `Identificar qué cambió para replicarlo en otros centros.`,
        })
      }
    }
  }

  // 5. Centro líder (solo si no hay alertas más urgentes sobre él)
  const rentables = conMovimiento.filter(c => c.utilidadOperativa > 0)
  if (rentables.length > 0) {
    const lider = [...rentables].sort((a, b) =>
      (b.margenOperativo ?? -Infinity) - (a.margenOperativo ?? -Infinity))[0]
    if (lider.margenOperativo != null) {
      out.push({
        nivel: 'success',
        titulo: `${lider.nombre} es el centro más rentable del período`,
        detalle: `Margen operativo de ${lider.margenOperativo.toFixed(1)}% con una utilidad de ` +
          `${fmtQ(lider.utilidadOperativa)}.`,
      })
    }
  }

  const orden: Record<InsightNivel, number> = { danger: 0, warning: 1, info: 2, success: 3 }
  return out.sort((a, b) => orden[a.nivel] - orden[b.nivel])
}

// ─── Centros de Costo ─────────────────────────────────────────────────────────

export interface EjecucionCentro {
  centroId:      string | null
  codigo:        string
  nombre:        string
  responsable:   string | null
  presupuestoAnual:  number
  presupuestoYTD:    number
  realYTD:           number
  disponible:        number | null   // presupuestoAnual - realYTD (null sin presupuesto)
  ejecucionPct:      number | null   // realYTD / presupuestoAnual
  esperadoPct:       number | null   // presupuestoYTD / presupuestoAnual
  proyeccionCierre:  number | null   // run-rate a 12 meses
  desviacionProyectada: number | null // proyección - presupuesto anual
  mesAgotamiento:    number | null   // 1-12 si el run-rate agota el presupuesto dentro del año
  gastoMensual:      number[]        // índice 0-11
  presupuestoMensualArr: number[]    // índice 0-11
  estado: 'ok' | 'warning' | 'danger' | 'sin-presupuesto'
}

/** Construye las métricas de ejecución por centro a partir de la respuesta del backend */
export function calcularEjecucion(d: EjecucionCCData): EjecucionCentro[] {
  const mesActual = d.mesActual

  const keys = new Set<string>([
    ...d.centros.map(c => c.id),
    ...d.real.filter(r => r.centroId != null).map(r => r.centroId as string),
  ])

  const build = (centroId: string | null): EjecucionCentro => {
    const meta = centroId ? d.centros.find(c => c.id === centroId) : null
    const gastoMensual = Array.from({ length: 12 }, (_, i) =>
      d.real.filter(r => r.centroId === centroId && r.mes === i + 1)
        .reduce((s, r) => s + r.total, 0))
    const presupuestoMensualArr = Array.from({ length: 12 }, (_, i) =>
      d.presupuestoMensual.filter(p => p.centroId === centroId && p.mes === i + 1)
        .reduce((s, p) => s + p.monto, 0))

    const presupuestoAnual = presupuestoMensualArr.reduce((s, n) => s + n, 0)
    const presupuestoYTD = presupuestoMensualArr.slice(0, mesActual).reduce((s, n) => s + n, 0)
    const realYTD = gastoMensual.slice(0, mesActual || 12).reduce((s, n) => s + n, 0)

    const mesesTranscurridos = Math.max(mesActual, 1)
    const proyeccionCierre = mesActual > 0 ? (realYTD / mesesTranscurridos) * 12 : null

    // Mes en que el gasto acumulado (a ritmo promedio) agota el presupuesto anual
    let mesAgotamiento: number | null = null
    if (presupuestoAnual > 0 && mesActual > 0) {
      const ritmo = realYTD / mesesTranscurridos
      if (ritmo > 0) {
        let acumulado = realYTD
        if (acumulado >= presupuestoAnual) {
          // Ya se agotó: encontrar el mes real donde ocurrió
          let cum = 0
          for (let i = 0; i < 12; i++) {
            cum += gastoMensual[i]
            if (cum >= presupuestoAnual) { mesAgotamiento = i + 1; break }
          }
        } else {
          for (let m = mesActual + 1; m <= 12; m++) {
            acumulado += ritmo
            if (acumulado >= presupuestoAnual) { mesAgotamiento = m; break }
          }
        }
      }
    }

    const ejecucionPct = presupuestoAnual > 0 ? (realYTD / presupuestoAnual) * 100 : null
    const esperadoPct = presupuestoAnual > 0 ? (presupuestoYTD / presupuestoAnual) * 100 : null

    let estado: EjecucionCentro['estado'] = 'ok'
    if (presupuestoAnual <= 0) estado = 'sin-presupuesto'
    else if (presupuestoYTD > 0 && realYTD > presupuestoYTD) estado = 'danger'
    else if (presupuestoYTD > 0 && realYTD > presupuestoYTD * 0.9) estado = 'warning'

    return {
      centroId,
      codigo: meta?.codigo ?? '—',
      nombre: meta?.nombre ?? (centroId ? 'Centro eliminado' : 'Sin asignar'),
      responsable: meta?.responsable ?? null,
      presupuestoAnual, presupuestoYTD, realYTD,
      disponible: presupuestoAnual > 0 ? presupuestoAnual - realYTD : null,
      ejecucionPct, esperadoPct,
      proyeccionCierre,
      desviacionProyectada: presupuestoAnual > 0 && proyeccionCierre != null
        ? proyeccionCierre - presupuestoAnual : null,
      mesAgotamiento,
      gastoMensual, presupuestoMensualArr,
      estado,
    }
  }

  const centros = [...keys].map(id => build(id))
  const sinAsignar = build(null)
  if (sinAsignar.realYTD !== 0) centros.push(sinAsignar)

  return centros.sort((a, b) => a.codigo.localeCompare(b.codigo))
}

export function insightsCentrosCosto(centros: EjecucionCentro[], d: EjecucionCCData): Insight[] {
  const out: Insight[] = []
  const mesActual = d.mesActual

  const topCuentaDelMes = (centroId: string | null, mes: number): string | null => {
    const filas = d.real.filter(r => r.centroId === centroId && r.mes === mes)
    if (filas.length === 0) return null
    const porCuenta = new Map<string, number>()
    filas.forEach(r => porCuenta.set(r.name, (porCuenta.get(r.name) ?? 0) + r.total))
    const top = [...porCuenta.entries()].sort((a, b) => b[1] - a[1])[0]
    return top && top[1] > 0 ? top[0] : null
  }

  for (const c of centros) {
    if (c.centroId === null) continue

    // 1. Agotamiento anticipado del presupuesto
    if (c.mesAgotamiento != null && c.mesAgotamiento <= 12) {
      const antes = 12 - c.mesAgotamiento
      out.push({
        nivel: 'danger',
        titulo: `${c.nombre} agotará su presupuesto en ${MESES[c.mesAgotamiento - 1]}`,
        detalle: `A ritmo actual (${fmtQ(c.realYTD / Math.max(mesActual, 1))} por mes) el presupuesto anual de ` +
          `${fmtQ(c.presupuestoAnual)} se agota ${antes > 0 ? `${antes} ${antes === 1 ? 'mes' : 'meses'} antes del cierre` : 'justo al cierre'}. ` +
          (c.responsable ? `Responsable: ${c.responsable}. ` : '') +
          `Ajustar el ritmo de gasto o ampliar el presupuesto.`,
      })
    } else if (c.estado === 'danger') {
      out.push({
        nivel: 'danger',
        titulo: `${c.nombre} va adelantado respecto al presupuesto`,
        detalle: `Lleva ${fmtQ(c.realYTD)} ejecutados contra ${fmtQ(c.presupuestoYTD)} esperados a la fecha ` +
          `(${c.presupuestoYTD > 0 ? Math.round((c.realYTD / c.presupuestoYTD) * 100) : 0}% del avance esperado).`,
      })
    } else if (c.estado === 'warning') {
      out.push({
        nivel: 'warning',
        titulo: `${c.nombre} se acerca al límite del avance esperado`,
        detalle: `Lleva ${fmtQ(c.realYTD)} de ${fmtQ(c.presupuestoYTD)} esperados a la fecha. Vigilar el ritmo del próximo mes.`,
      })
    }

    // 2. Gasto atípico: un mes supera media + 2 desviaciones estándar
    const meses = c.gastoMensual.slice(0, mesActual).filter(g => g !== 0)
    if (meses.length >= 3) {
      const media = meses.reduce((s, n) => s + n, 0) / meses.length
      const sigma = Math.sqrt(meses.reduce((s, n) => s + (n - media) ** 2, 0) / meses.length)
      for (let i = 0; i < mesActual; i++) {
        const g = c.gastoMensual[i]
        if (sigma > 0 && g > media + 2 * sigma) {
          const driver = topCuentaDelMes(c.centroId, i + 1)
          out.push({
            nivel: 'warning',
            titulo: `${c.nombre}: gasto atípico en ${MESES[i]}`,
            detalle: `${fmtQ(g)} frente a una media mensual de ${fmtQ(media)}.` +
              (driver ? ` Principal cuenta del mes: ${driver}.` : '') +
              ` Verificar si fue un gasto extraordinario o un error de registro.`,
          })
        }
      }
    }

    // 3. Crecimiento sostenido: 3+ meses consecutivos al alza
    let rachaAlza = 0
    for (let i = mesActual - 1; i >= 1; i--) {
      if (c.gastoMensual[i] > c.gastoMensual[i - 1] && c.gastoMensual[i] > 0) rachaAlza++
      else break
    }
    if (rachaAlza >= 3) {
      out.push({
        nivel: 'warning',
        titulo: `${c.nombre} acumula ${rachaAlza + 1} meses de gasto creciente`,
        detalle: `El gasto mensual viene subiendo de forma sostenida desde ${MESES[mesActual - 1 - rachaAlza]}. ` +
          `Revisar si responde a crecimiento planificado o a pérdida de control.`,
      })
    }

    // 4. Centros con gasto pero sin presupuesto
    if (c.estado === 'sin-presupuesto' && c.realYTD > 0 && d.tienePresupuesto) {
      out.push({
        nivel: 'info',
        titulo: `${c.nombre} no tiene presupuesto asignado`,
        detalle: `Registra ${fmtQ(c.realYTD)} de gasto en el ejercicio sin línea presupuestaria. ` +
          `Asignarle presupuesto permite controlarlo con este reporte.`,
      })
    }
  }

  // 5. Gasto sin centro de costo asignado
  const sinAsignar = centros.find(c => c.centroId === null)
  const totalReal = centros.reduce((s, c) => s + c.realYTD, 0)
  if (sinAsignar && totalReal > 0 && sinAsignar.realYTD / totalReal > 0.05) {
    out.push({
      nivel: 'warning',
      titulo: `${Math.round((sinAsignar.realYTD / totalReal) * 100)}% del gasto no tiene centro de costo`,
      detalle: `Hay ${fmtQ(sinAsignar.realYTD)} sin dimensión asignada. El control presupuestario ` +
        `pierde cobertura; revisar los asientos y marcar las cuentas de gasto con "requiere centro de costo".`,
    })
  }

  // 6. Sin presupuesto activo en el ejercicio
  if (!d.tienePresupuesto) {
    out.push({
      nivel: 'info',
      titulo: `No hay presupuesto activo para ${d.year}`,
      detalle: `El reporte muestra el gasto real por centro, pero sin presupuesto no puede calcular ` +
        `ejecución ni proyecciones de agotamiento. Crear y activar un presupuesto en Contabilidad → Presupuesto.`,
    })
  }

  const orden: Record<InsightNivel, number> = { danger: 0, warning: 1, info: 2, success: 3 }
  return out.sort((a, b) => orden[a.nivel] - orden[b.nivel])
}
