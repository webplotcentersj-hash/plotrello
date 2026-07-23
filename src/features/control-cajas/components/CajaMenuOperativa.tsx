import { useCallback, useEffect, useState } from 'react'
import { getArgentinaDateString } from '../../../utils/dateUtils'
import { estadoPasoMenu, loadEstadoOperativaHoy, type CajaEstadoOperativaHoy } from '../cajaOperativaHoy'
import { fmtArs, fmtDateAr } from '../format'
import { useCajaMenuRealtime } from '../useCajaMenuRealtime'
import type { CajaSectionId } from '../types'
import CajaMenuResumenDia from './CajaMenuResumenDia'

type Paso = {
  section: CajaSectionId
  icon: string
  label: string
  descripcion: string
  orden: number
}

const PASOS: Paso[] = [
  {
    orden: 1,
    section: 'arqueo',
    icon: '💵',
    label: 'Mi arqueo',
    descripcion: 'Cierre / ventas del turno: efectivo a contar en billetes.'
  },
  {
    orden: 2,
    section: 'cierre_turno',
    icon: '🔁',
    label: 'Cierre de turno',
    descripcion: 'Dejá el fondo en caja, pasá el resto a administración y cerrá el turno.'
  },
  {
    orden: 3,
    section: 'pase_caja',
    icon: '↔️',
    label: 'Pase de caja',
    descripcion: 'PDF con IN/IV «PASE DE CAJA» o pase manual entre cajas.'
  },
  {
    orden: 4,
    section: 'traspasos',
    icon: '🔀',
    label: 'Mis traspasos',
    descripcion: 'Confirmá o revisá traspasos de fondo entre cajas.'
  },
  {
    orden: 5,
    section: 'egresos',
    icon: '📤',
    label: 'Egresos',
    descripcion: 'Pedí o seguí egresos de caja del día.'
  },
  {
    orden: 6,
    section: 'historial',
    icon: '📋',
    label: 'Mis movimientos',
    descripcion: 'Movimientos del día, arqueos y historial completo.'
  },
  {
    orden: 7,
    section: 'asistente',
    icon: '✨',
    label: 'Asistente IA',
    descripcion: 'Preguntale al asistente si tenés dudas sobre el proceso.'
  }
]

const BADGE_LABEL: Record<string, string> = {
  hecho: 'Listo',
  pendiente: 'Pendiente',
  alerta: 'Atención',
  opcional: ''
}

type Props = {
  usuarioNombre: string
  usuarioId?: number
  refreshToken?: number
  onNavigate: (section: CajaSectionId) => void
}

function resumenDia(estado: CajaEstadoOperativaHoy): string {
  const partes: string[] = []
  if (estado.planillasDelDia > 0) {
    partes.push(
      estado.planillasDelDia === 1 ? '1 planilla' : `${estado.planillasDelDia} planillas`
    )
  }
  if (estado.arqueoHecho) partes.push('arqueo')
  if (estado.cierreTurnoHecho) partes.push('cierre turno')
  if (!partes.length) return 'Todavía no registraste pasos del día.'
  const base = `Hoy: ${partes.join(' · ')}.`
  const t = estado.totalesDia
  if (t && (t.ingresos > 0 || t.egresos > 0)) {
    return `${base} Neto coherente: $ ${fmtArs(t.neto)} (${t.comprobantes_unicos} comprob. únicos).`
  }
  return base
}

export default function CajaMenuOperativa({
  usuarioNombre,
  usuarioId,
  refreshToken = 0,
  onNavigate
}: Props) {
  const hoy = getArgentinaDateString()
  const [estado, setEstado] = useState<CajaEstadoOperativaHoy | null>(null)
  const [cargando, setCargando] = useState(true)

  const onEstado = useCallback((e: CajaEstadoOperativaHoy | null) => {
    setEstado(e)
  }, [])

  useEffect(() => {
    if (!usuarioId) {
      setEstado(null)
      setCargando(false)
      return
    }
    let cancelled = false
    setCargando(true)
    void loadEstadoOperativaHoy(usuarioId, usuarioNombre, hoy).then((e) => {
      if (!cancelled) {
        setEstado(e)
        setCargando(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [usuarioId, usuarioNombre, hoy, refreshToken])

  useCajaMenuRealtime({
    usuarioId,
    usuarioNombre,
    fecha: hoy,
    enabled: !!usuarioId,
    onEstado
  })

  const siguientePaso = estado
    ? !estado.arqueoHecho
      ? 'arqueo'
      : !estado.cierreTurnoHecho
        ? 'cierre_turno'
        : null
    : null

  return (
    <div className="caja-cc-menu-operativa">
      <div className="caja-cc-page-head caja-cc-page-head--caja">
        <div>
          <h2>Caja — {fmtDateAr(hoy)}</h2>
          <p className="caja-cc-sub">
            <strong>{usuarioNombre}</strong>
            {estado?.cajaNombre ? (
              <>
                {' '}
                · <strong>{estado.cajaNombre}</strong>
              </>
            ) : null}
          </p>
          {cargando ? (
            <p className="caja-cc-menu-estado-line">Cargando…</p>
          ) : estado ? (
            <p className="caja-cc-menu-estado-line">{resumenDia(estado)}</p>
          ) : null}
        </div>
      </div>

      <CajaMenuResumenDia
        estado={estado}
        cargando={cargando}
        enVivo={!!usuarioId}
        onNavigate={onNavigate}
      />

      {siguientePaso && estado ? (
        <div className="caja-cc-menu-siguiente">
          <span>Siguiente paso recomendado</span>
          <button type="button" className="btn-primary" onClick={() => onNavigate(siguientePaso)}>
            {siguientePaso === 'arqueo' ? 'Ir a Mi arqueo' : 'Ir a Cierre de turno'} →
          </button>
        </div>
      ) : estado?.arqueoHecho && estado.cierreTurnoHecho ? (
        <div className="caja-cc-menu-siguiente caja-cc-menu-siguiente--ok">
          <span>✅ Arqueo y cierre de turno completados hoy.</span>
        </div>
      ) : null}

      <div className="caja-cc-menu-pasos">
        {PASOS.map((paso) => {
          const badge = estado ? estadoPasoMenu(paso.section, estado) : null
          const esSiguiente = paso.section === siguientePaso
          return (
            <button
              key={paso.orden}
              type="button"
              className={`caja-cc-menu-paso${esSiguiente ? ' caja-cc-menu-paso--siguiente' : ''}`}
              onClick={() => onNavigate(paso.section)}
            >
              <span className="caja-cc-menu-paso-orden">{paso.orden}</span>
              <span className="caja-cc-menu-paso-icon" aria-hidden>
                {paso.icon}
              </span>
              <span className="caja-cc-menu-paso-body">
                <span className="caja-cc-menu-paso-title-row">
                  <strong>{paso.label}</strong>
                  {badge && badge.tipo !== 'opcional' ? (
                    <span className={`caja-cc-menu-badge caja-cc-menu-badge--${badge.tipo}`}>
                      {BADGE_LABEL[badge.tipo]}
                    </span>
                  ) : null}
                </span>
                <span>{badge?.detalle ?? paso.descripcion}</span>
              </span>
              <span className="caja-cc-menu-paso-arrow" aria-hidden>
                →
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
