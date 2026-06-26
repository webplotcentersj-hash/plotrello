import { useRef, useState } from 'react'
import { TIPO_PLANILLA_LABEL } from '../cajaCoherencia'
import { importarPlanillaAlSistema } from '../cajaPlanillaImport'
import { resolverDestinoPlanilla } from '../cajaPlanillaRouter'
import type { CajaEstadoOperativaHoy } from '../cajaOperativaHoy'
import { isPlanillaAiAvailable } from '../planillaCajaGemini'
import { parsePlanillaCajaPdf, type PlanillaCajaParsed } from '../parsePlanillaCajaPdf'
import type { CajaSectionId } from '../types'
import { CajaMensajeOkPlotLab } from './CajaVolverPlotLab'

const SECCION_LABEL: Partial<Record<CajaSectionId, string>> = {
  arqueo: 'Mi arqueo',
  cierre_turno: 'Cierre de turno',
  pase_caja: 'Pase de caja',
  traspasos: 'Mis traspasos',
  egresos: 'Egresos',
  historial: 'Historial'
}

type Props = {
  usuarioNombre: string
  usuarioId?: number
  estado?: CajaEstadoOperativaHoy | null
  onNavigate: (section: CajaSectionId) => void
  onPlanillaParsed?: (planilla: PlanillaCajaParsed | null) => void
  onImported?: () => void
  /** Si false, no cambia de sección tras importar (p. ej. admin en Cierres). */
  autoNavigate?: boolean
  /** Si true, va colapsado al final del menú (secundario respecto a ventas Plot Lab). */
  collapsible?: boolean
}

export default function CajaSubidaInteligente({
  usuarioNombre,
  usuarioId,
  estado,
  onNavigate,
  onPlanillaParsed,
  onImported,
  autoNavigate = true,
  collapsible = false
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [abierto, setAbierto] = useState(!collapsible)
  const [busy, setBusy] = useState(false)
  const [etapa, setEtapa] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [ultimoDestino, setUltimoDestino] = useState<CajaSectionId | null>(null)

  const procesarPdf = async (file: File) => {
    if (!abierto) setAbierto(true)
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setErr('Elegí un PDF exportado desde PLOT CENTER.')
      return
    }
    setBusy(true)
    setErr(null)
    setOk(null)
    setEtapa('Leyendo PDF…')
    try {
      const buf = (await file.arrayBuffer()).slice(0)
      const useAi = isPlanillaAiAvailable()
      setEtapa(useAi ? 'PlotAI interpretando…' : 'Extrayendo comprobantes…')
      const parsed = await parsePlanillaCajaPdf(buf, file.name, { useAi })

      const previewDestino = resolverDestinoPlanilla(parsed, {
        arqueoHecho: estado?.arqueoHecho,
        cierreTurnoHecho: estado?.cierreTurnoHecho
      })
      setEtapa(
        `Detectado: ${TIPO_PLANILLA_LABEL[previewDestino.tipo]} → ${SECCION_LABEL[previewDestino.section] ?? previewDestino.section}`
      )

      const res = await importarPlanillaAlSistema({
        planilla: parsed,
        usuarioNombre,
        usuarioId,
        estadoOperativa: {
          arqueoHecho: estado?.arqueoHecho,
          cierreTurnoHecho: estado?.cierreTurnoHecho
        },
        onProgress: setEtapa,
        permitirArchivoDuplicado: false
      })

      if (!res.success) {
        setErr(res.error ?? 'No se pudo importar la planilla.')
        return
      }

      onPlanillaParsed?.(res.planilla)
      onImported?.()
      setUltimoDestino(res.destino)
      setOk(res.mensaje ?? `Importado como ${res.destinoTitulo}.`)
      if (autoNavigate) onNavigate(res.destino)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error al procesar el PDF')
    } finally {
      setBusy(false)
      setEtapa(null)
    }
  }

  return (
    <section
      className={`caja-cc-subida-inteligente${collapsible ? ' caja-cc-subida-inteligente--secondary' : ''}`}
      aria-label="Subida inteligente de PDF"
    >
      {collapsible ? (
        <button
          type="button"
          className="caja-cc-subida-inteligente-toggle"
          aria-expanded={abierto}
          onClick={() => setAbierto((v) => !v)}
        >
          <span className="caja-cc-subida-inteligente-toggle-icon" aria-hidden>
            {abierto ? '▾' : '▸'}
          </span>
          <span>
            <strong>Importar PDF del día</strong>
            <small>Opcional — cierre, pase, traspaso o egresos desde PLOT CENTER</small>
          </span>
        </button>
      ) : null}

      {(!collapsible || abierto) && (
        <>
      <input
        ref={fileRef}
        type="file"
        accept=".pdf,application/pdf"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) void procesarPdf(f)
          e.target.value = ''
        }}
      />
      <button
        type="button"
        className="caja-cc-subida-inteligente-drop"
        disabled={busy}
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          e.currentTarget.classList.add('is-drag')
        }}
        onDragLeave={(e) => e.currentTarget.classList.remove('is-drag')}
        onDrop={(e) => {
          e.preventDefault()
          e.currentTarget.classList.remove('is-drag')
          const f = e.dataTransfer.files?.[0]
          if (f) void procesarPdf(f)
        }}
      >
        <span className="caja-cc-subida-inteligente-icon" aria-hidden>
          ✦
        </span>
        <strong>{busy ? 'Procesando…' : 'Subir PDF del día'}</strong>
        <span className="caja-cc-subida-inteligente-hint">
          Único lugar para el PDF. Detecta cierre, pase (IN/IV), traspaso (MEC) o egresos, importa sin duplicar
          comprobantes
          {autoNavigate ? ' y te lleva a la sección correcta' : ''}.
        </span>
        {etapa ? <span className="caja-cc-subida-inteligente-etapa">{etapa}</span> : null}
      </button>

      {err ? (
        <p className="caja-cc-planilla-error" role="alert">
          {err}
        </p>
      ) : null}
      {ok ? (
        <CajaMensajeOkPlotLab className="caja-cc-subida-inteligente-ok">
          {ok}
          {ultimoDestino ? (
            <>
              {' '}
              <button type="button" className="btn-link" onClick={() => onNavigate(ultimoDestino)}>
                Ver {SECCION_LABEL[ultimoDestino] ?? 'sección'} →
              </button>
            </>
          ) : null}
        </CajaMensajeOkPlotLab>
      ) : null}
        </>
      )}
    </section>
  )
}
