import { useCallback, useEffect, useMemo, useState } from 'react'
import { Segmented, Tooltip, Typography } from 'antd'
import { getExchangeRateForDate } from '../../api/monedas'
import type { MonthRange } from '../../utils/reportMonthly'
import {
  enDolares, filasEnDolares, fmtMonto, mesesSinTasa, quetzalesPorDolar,
  type ClaseDeTotal, type MonedaDelReporte,
} from './monedaDelReporte'

const { Text } = Typography

/**
 * El interruptor de moneda de los reportes financieros.
 *
 * Trae el tipo de cambio de FIN DE MES de cada columna —el del último día del
 * mes, que es el que usa el contador para presentar— y convierte las filas
 * del reporte. Solo pide tasas cuando alguien mueve el interruptor a dólares:
 * un reporte en quetzales no cuesta ni una consulta de más.
 *
 * Las tasas se recuerdan mientras la pantalla viva, así que ir y venir entre
 * las dos monedas es instantáneo.
 */
export function useMonedaDelReporte(meses: MonthRange[], claseDeTotal: ClaseDeTotal) {
  const [moneda, setMoneda] = useState<MonedaDelReporte>('GTQ')
  const [tasas, setTasas]   = useState<Record<string, number>>({})
  const [cargando, setCargando] = useState(false)

  /** La lista de meses como texto, para no re-pedir en cada render. */
  const clave = meses.map(m => m.yearMonth).join(',')

  useEffect(() => {
    if (moneda !== 'USD' || meses.length === 0) return
    const faltan = meses.filter(m => tasas[m.yearMonth] == null)
    if (faltan.length === 0) return

    let vivo = true
    setCargando(true)
    Promise.all(faltan.map(async m => {
      try {
        // El endpoint devuelve la tasa en el sentido que le toque al par de
        // la empresa; aquí se guarda siempre como quetzales por dólar.
        const tasa = quetzalesPorDolar(await getExchangeRateForDate('USD', m.to))
        return tasa ? [m.yearMonth, tasa] as const : null
      } catch {
        // Un mes sin tipo de cambio se avisa en pantalla; no tumba el reporte.
        return null
      }
    }))
      .then(resultados => {
        if (!vivo) return
        const nuevas = Object.fromEntries(resultados.filter(Boolean) as Array<readonly [string, number]>)
        if (Object.keys(nuevas).length > 0) setTasas(prev => ({ ...prev, ...nuevas }))
      })
      .finally(() => { if (vivo) setCargando(false) })

    return () => { vivo = false }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moneda, clave])

  const tasaDe = useCallback((yearMonth: string) => tasas[yearMonth] ?? null, [tasas])

  /** Las filas listas para la tabla, en la moneda que se esté viendo. */
  const enMoneda = useCallback(<T extends Record<string, any>>(filas: T[]): T[] =>
    moneda === 'USD'
      ? filasEnDolares(filas, meses.map(m => m.yearMonth), tasaDe, claseDeTotal)
      : filas,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [moneda, clave, tasaDe, claseDeTotal])

  const sinTasa = useMemo(
    () => moneda === 'USD' && !cargando ? mesesSinTasa(meses.map(m => m.yearMonth), tasaDe) : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [moneda, clave, tasaDe, cargando],
  )

  return { moneda, setMoneda, tasaDe, enMoneda, cargando, sinTasa }
}

/**
 * Lo mismo para un reporte de un solo corte —movimiento de capital—.
 *
 * Aquí hay una sola tasa: la del día del corte. Devuelve el formateador ya
 * hecho, que es lo único que necesita una pantalla que no tiene columnas.
 */
export function useMonedaDeUnCorte(fecha: string) {
  const [moneda, setMoneda] = useState<MonedaDelReporte>('GTQ')
  const [tasa, setTasa] = useState<number | null>(null)
  const [cargando, setCargando] = useState(false)

  useEffect(() => {
    if (moneda !== 'USD' || !fecha) return
    let vivo = true
    setCargando(true)
    getExchangeRateForDate('USD', fecha)
      .then(r => { if (vivo) setTasa(quetzalesPorDolar(r)) })
      .catch(() => { if (vivo) setTasa(null) })
      .finally(() => { if (vivo) setCargando(false) })
    return () => { vivo = false }
  }, [moneda, fecha])

  /** Una cifra ya convertida y con el signo que le toca. */
  const fmt = useCallback((n: unknown) => {
    if (moneda !== 'USD') return fmtMonto(n, 'GTQ')
    return fmtMonto(enDolares(Number(n) || 0, tasa), 'USD')
  }, [moneda, tasa])

  const sinTasa = moneda === 'USD' && !cargando && tasa == null ? [fecha] : []

  return { moneda, setMoneda, tasa, fmt, cargando, sinTasa }
}

/**
 * El interruptor, con el aviso de cómo se convirtió.
 *
 * Decir «al tipo de cambio de fin de mes» no es un adorno: quien recibe el
 * reporte en dólares necesita saber con qué tasa se armó.
 */
export function SwitchDeMoneda({ moneda, onChange, cargando, sinTasa }: {
  moneda:   MonedaDelReporte
  onChange: (m: MonedaDelReporte) => void
  cargando?: boolean
  sinTasa?:  string[]
}) {
  const aviso = (sinTasa?.length ?? 0) > 0
    ? `Sin tipo de cambio para ${sinTasa!.length} ${sinTasa!.length === 1 ? 'mes' : 'meses'}: esas columnas salen en blanco`
    : 'Cada mes se convierte con el tipo de cambio de su fin de mes'

  return (
    <Tooltip title={aviso}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <Segmented
          size="small"
          value={moneda}
          onChange={v => onChange(v as MonedaDelReporte)}
          options={[{ label: 'GTQ', value: 'GTQ' }, { label: 'USD', value: 'USD' }]}
          disabled={cargando}
        />
        {moneda === 'USD' && (
          <Text type={(sinTasa?.length ?? 0) > 0 ? 'warning' : 'secondary'} style={{ fontSize: 10 }}>
            {cargando ? 'tipo de cambio…' : 'al cierre de cada mes'}
          </Text>
        )}
      </span>
    </Tooltip>
  )
}
