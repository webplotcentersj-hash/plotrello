import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useSignatureCanvas } from '../hooks/useSignatureCanvas'
import { rrhhDocItemFirmar, rrhhDocItemsListar } from '../services/rrhhExtendidoService'
import type { RrhhDocItem } from '../types/api'
import { tituloReciboPeriodo } from '../utils/rrhhLibroSueldos'
import './rrhhExtendido.css'
import './MisRecibosPage.css'

function tituloRecibo(item: RrhhDocItem): string {
  if (item.archivo_nombre && /recibo de sueldo ·/i.test(item.archivo_nombre)) {
    return item.archivo_nombre.trim()
  }
  if (item.lote_titulo?.trim() && /recibo de sueldo ·/i.test(item.lote_titulo)) {
    return item.lote_titulo.trim()
  }
  const periodo = item.lote_periodo?.trim()
  if (periodo) return tituloReciboPeriodo(periodo)
  if (item.lote_titulo?.trim()) return item.lote_titulo.trim()
  const raw = (item.archivo_nombre || '').replace(/\.[^.]+$/, '')
  const m = raw.match(/recibo[_-]?(\d{4}-\d{2})/i)
  if (m) return tituloReciboPeriodo(m[1])
  if (raw && !/^LstWFrm/i.test(raw)) return raw.replace(/_/g, ' ')
  return 'Recibo de sueldo'
}

function formatFirmado(at: string | null | undefined): string {
  if (!at) return ''
  const d = new Date(at)
  if (Number.isNaN(d.getTime())) return at
  return d.toLocaleString('es-AR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const MisRecibosPage = () => {
  const navigate = useNavigate()
  const { usuario, loading: authLoading } = useAuth()
  const [items, setItems] = useState<RrhhDocItem[]>([])
  const [selected, setSelected] = useState<RrhhDocItem | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [filtro, setFiltro] = useState<'pendientes' | 'firmados' | 'todos'>('pendientes')

  const { canvasRef, firmaDataUrl, limpiarFirma, hasStroke } = useSignatureCanvas({
    enabled: !!selected,
    width: 640,
    height: 168
  })

  const load = useCallback(async () => {
    if (!usuario?.id) return
    setLoading(true)
    setError(null)
    const res = await rrhhDocItemsListar(undefined, usuario.id)
    if (res.success && res.data) setItems(res.data)
    else setError(res.error || 'No se pudieron cargar los recibos')
    setLoading(false)
  }, [usuario?.id])

  useEffect(() => {
    if (authLoading) return
    if (!usuario) {
      navigate('/')
      return
    }
    void load()
  }, [authLoading, usuario, navigate, load])

  const pendientes = useMemo(() => items.filter((i) => i.estado === 'pendiente'), [items])
  const firmados = useMemo(() => items.filter((i) => i.estado === 'firmado'), [items])
  const visibles = useMemo(() => {
    if (filtro === 'pendientes') return pendientes
    if (filtro === 'firmados') return firmados
    return items
  }, [filtro, pendientes, firmados, items])

  const abrirFirmar = (item: RrhhDocItem) => {
    setError(null)
    setMsg(null)
    setSelected(item)
  }

  const cerrarFirmar = () => {
    setSelected(null)
    limpiarFirma()
  }

  const firmar = async () => {
    if (!selected) return
    if (!hasStroke || !firmaDataUrl) {
      setError('Dibujá tu firma en el recuadro blanco')
      return
    }
    setBusy(true)
    setError(null)
    const res = await rrhhDocItemFirmar(selected.id, firmaDataUrl)
    setBusy(false)
    if (!res.success) {
      setError(res.error || 'No se pudo guardar la firma')
      return
    }
    setMsg('Recibo firmado correctamente')
    setSelected(null)
    limpiarFirma()
    await load()
  }

  return (
    <div className="rrhh-ext-page mis-recibos-page">
      <header className="mis-recibos-hero">
        <div>
          <div className="mis-recibos-hero-kicker">
            <span className="mis-recibos-hero-mark" aria-hidden>
              ✎
            </span>
            Documentación laboral
          </div>
          <h1>Mis recibos</h1>
          <p>Recibos de sueldo enviados por RRHH. Abrí el PDF, firmá y listo.</p>
        </div>
        <button type="button" className="rrhh-ext-btn ghost" onClick={() => navigate('/')}>
          Volver
        </button>
      </header>

      <div className="mis-recibos-stats">
        <div className={`mis-recibos-stat ${pendientes.length ? 'is-warn' : ''}`}>
          <strong>{pendientes.length}</strong>
          <span>Pendientes</span>
        </div>
        <div className={`mis-recibos-stat ${firmados.length ? 'is-ok' : ''}`}>
          <strong>{firmados.length}</strong>
          <span>Firmados</span>
        </div>
        <div className="mis-recibos-stat">
          <strong>{items.length}</strong>
          <span>Totales</span>
        </div>
      </div>

      {error ? <p className="rrhh-ext-error">{error}</p> : null}
      {msg ? <p className="mis-recibos-ok">{msg}</p> : null}

      <div className="mis-recibos-tabs" role="tablist">
        <button
          type="button"
          className={filtro === 'pendientes' ? 'is-on' : ''}
          onClick={() => setFiltro('pendientes')}
        >
          Pendientes
        </button>
        <button
          type="button"
          className={filtro === 'firmados' ? 'is-on' : ''}
          onClick={() => setFiltro('firmados')}
        >
          Firmados
        </button>
        <button
          type="button"
          className={filtro === 'todos' ? 'is-on' : ''}
          onClick={() => setFiltro('todos')}
        >
          Todos
        </button>
      </div>

      {loading ? (
        <div className="mis-recibos-empty">Cargando recibos…</div>
      ) : visibles.length === 0 ? (
        <div className="mis-recibos-empty">
          <strong>
            {filtro === 'pendientes'
              ? 'Nada pendiente'
              : filtro === 'firmados'
                ? 'Sin firmas todavía'
                : 'Sin recibos aún'}
          </strong>
          {filtro === 'pendientes'
            ? 'Cuando RRHH publique un recibo, aparece acá para firmar.'
            : filtro === 'firmados'
              ? 'Los que firmes se listan en esta pestaña.'
              : 'Cuando RRHH envíe recibos desde el libro de sueldos, van a aparecer acá.'}
        </div>
      ) : (
        <ul className="mis-recibos-list">
          {visibles.map((i) => {
            const titulo = tituloRecibo(i)
            const pendiente = i.estado === 'pendiente'
            return (
              <li key={i.id} className={`mis-recibos-item ${pendiente ? 'is-pendiente' : 'is-firmado'}`}>
                <div className="mis-recibos-item-body">
                  <div className="mis-recibos-item-icon" aria-hidden>
                    {pendiente ? '⏳' : '✓'}
                  </div>
                  <div className="mis-recibos-item-main">
                    <div className="mis-recibos-item-title">{titulo}</div>
                    <div className="mis-recibos-item-meta">
                      <span className={`rrhh-ext-badge ${pendiente ? 'warn' : 'ok'}`}>
                        {pendiente ? 'Pendiente de firma' : 'Firmado'}
                      </span>
                      {i.lote_periodo ? <span className="mis-recibos-periodo">{i.lote_periodo}</span> : null}
                      {!pendiente && i.firmado_at ? (
                        <span className="mis-recibos-fecha">Firmado {formatFirmado(i.firmado_at)}</span>
                      ) : null}
                    </div>
                  </div>
                </div>
                <div className="mis-recibos-item-actions">
                  <a
                    className="rrhh-ext-btn ghost"
                    href={i.archivo_url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Ver PDF
                  </a>
                  {pendiente ? (
                    <button
                      type="button"
                      className="rrhh-ext-btn primary"
                      onClick={() => abrirFirmar(i)}
                    >
                      Firmar
                    </button>
                  ) : i.firma_data_url ? (
                    <img
                      className="mis-recibos-firma-mini"
                      src={i.firma_data_url}
                      alt="Firma"
                      title="Tu firma"
                    />
                  ) : null}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {selected ? (
        <div
          className="mis-recibos-modal-overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !busy) cerrarFirmar()
          }}
        >
          <div className="mis-recibos-modal" role="dialog" aria-modal="true">
            <header className="mis-recibos-modal-head">
              <div>
                <h2>Firmar recibo</h2>
                <p>{tituloRecibo(selected)}</p>
              </div>
              <button type="button" className="rrhh-ext-btn ghost" onClick={cerrarFirmar} disabled={busy}>
                Cerrar
              </button>
            </header>

            <div className="mis-recibos-modal-body">
              <a
                className="mis-recibos-pdf-link"
                href={selected.archivo_url}
                target="_blank"
                rel="noreferrer"
              >
                ↗ Abrir PDF del recibo
              </a>

              <label className="mis-recibos-firma-label">Tu firma</label>
              <p className="mis-recibos-firma-hint">
                Firmá con el mouse o el dedo dentro del recuadro blanco.
              </p>
              <div className="mis-recibos-firma-wrap">
                <canvas ref={canvasRef} className="rrhh-ext-firma-canvas" />
              </div>

              <div className="mis-recibos-modal-actions">
                <button
                  type="button"
                  className="rrhh-ext-btn ghost"
                  onClick={() => limpiarFirma()}
                  disabled={busy}
                >
                  Limpiar
                </button>
                <button
                  type="button"
                  className="rrhh-ext-btn primary"
                  onClick={() => void firmar()}
                  disabled={busy || !hasStroke}
                >
                  {busy ? 'Guardando…' : 'Confirmar firma'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default MisRecibosPage
