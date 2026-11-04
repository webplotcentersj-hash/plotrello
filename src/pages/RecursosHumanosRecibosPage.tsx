import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import {
  rrhhDocItemAgregar,
  rrhhDocItemEliminar,
  rrhhDocItemsListar,
  rrhhDocLoteActualizarEstado,
  rrhhDocLoteCrear,
  rrhhDocLoteEliminar,
  rrhhDocLotesListar,
  rrhhDocSubirArchivo
} from '../services/rrhhExtendidoService'
import apiService from '../services/api'
import type { RrhhDocItem, RrhhDocLote } from '../types/api'
import { labelPeriodoMes, tituloReciboPeriodo } from '../utils/rrhhLibroSueldos'
import './rrhhExtendido.css'
import './RecursosHumanosRecibosPage.css'

function badgeEstado(estado: RrhhDocLote['estado'] | RrhhDocItem['estado']): string {
  if (estado === 'enviado' || estado === 'firmado') return 'ok'
  if (estado === 'borrador' || estado === 'pendiente') return 'warn'
  return 'bad'
}

function labelEstadoLote(estado: RrhhDocLote['estado']): string {
  if (estado === 'borrador') return 'Borrador'
  if (estado === 'enviado') return 'Enviado'
  if (estado === 'cerrado') return 'Cerrado'
  return estado
}

function labelEstadoItem(estado: RrhhDocItem['estado']): string {
  if (estado === 'pendiente') return 'Pendiente de firma'
  if (estado === 'firmado') return 'Firmado'
  if (estado === 'rechazado') return 'Rechazado'
  return estado
}

const RecursosHumanosRecibosPage = () => {
  const navigate = useNavigate()
  const { usuario, canManageRecursosHumanos, loading: authLoading } = useAuth()
  const canAccess = !!usuario && (canManageRecursosHumanos || usuario.rol === 'gerencia')
  const [lotes, setLotes] = useState<RrhhDocLote[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [items, setItems] = useState<RrhhDocItem[]>([])
  const [countsByLote, setCountsByLote] = useState<Record<number, { total: number; firmados: number }>>(
    {}
  )
  const [usuarios, setUsuarios] = useState<Array<{ id: number; nombre: string }>>([])
  const [periodo, setPeriodo] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const [idUsuarioUpload, setIdUsuarioUpload] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const selected = useMemo(
    () => lotes.find((l) => l.id === selectedId) || null,
    [lotes, selectedId]
  )

  const loadLotes = useCallback(async () => {
    const res = await rrhhDocLotesListar()
    if (!res.success || !res.data) {
      setError(res.error || 'No se pudieron cargar los lotes')
      return []
    }
    setLotes(res.data)
    return res.data
  }, [])

  const loadItems = useCallback(async (loteId: number) => {
    const res = await rrhhDocItemsListar(loteId)
    if (res.success && res.data) {
      setItems(res.data)
      const firmados = res.data.filter((i) => i.estado === 'firmado').length
      setCountsByLote((prev) => ({
        ...prev,
        [loteId]: { total: res.data!.length, firmados }
      }))
    } else {
      setItems([])
      setError(res.error || 'No se pudieron cargar los recibos del lote')
    }
  }, [])

  useEffect(() => {
    if (authLoading) return
    if (!canAccess) {
      navigate('/rrhh')
      return
    }
    setLoading(true)
    void (async () => {
      const list = await loadLotes()
      setSelectedId((prev) => prev ?? list[0]?.id ?? null)
      setLoading(false)
    })()
    void apiService.getUsuarios().then((r) => {
      if (r.success && r.data) setUsuarios(r.data.map((u) => ({ id: u.id, nombre: u.nombre })))
    })
  }, [authLoading, canAccess, navigate, loadLotes])

  useEffect(() => {
    if (selectedId) void loadItems(selectedId)
    else setItems([])
  }, [selectedId, loadItems])

  const crear = async () => {
    if (!usuario) return
    setBusy(true)
    setError(null)
    setMsg(null)
    const titulo = tituloReciboPeriodo(periodo)
    const res = await rrhhDocLoteCrear({
      periodo,
      titulo,
      created_by: usuario.id
    })
    setBusy(false)
    if (!res.success) setError(res.error || 'Error al crear lote')
    else {
      const list = await loadLotes()
      if (res.data) setSelectedId(res.data.id)
      else if (list[0]) setSelectedId(list[0].id)
      setMsg(`Lote creado: ${titulo}`)
    }
  }

  const upload = async () => {
    if (!selected || !file || !idUsuarioUpload) {
      setError('Elegí lote, empleado y archivo')
      return
    }
    setBusy(true)
    setError(null)
    const up = await rrhhDocSubirArchivo(file, Number(idUsuarioUpload))
    if (!up.success || !up.data) {
      setBusy(false)
      setError(up.error || 'Upload falló')
      return
    }
    const nombre = tituloReciboPeriodo(selected.periodo)
    const add = await rrhhDocItemAgregar({
      id_lote: selected.id,
      id_usuario: Number(idUsuarioUpload),
      archivo_url: up.data.url,
      archivo_nombre: nombre
    })
    setBusy(false)
    if (!add.success) setError(add.error || 'Error al agregar')
    else {
      setFile(null)
      setMsg(`Recibo cargado: ${nombre}`)
      await loadItems(selected.id)
      await apiService.createNotification({
        user_id: Number(idUsuarioUpload),
        title: nombre,
        description: 'Tenés un recibo de sueldo para ver y firmar en Mis recibos (/mis-recibos).',
        type: 'info',
        origen: 'sistema',
        related_id: 'mis-recibos'
      })
    }
  }

  const firmados = items.filter((i) => i.estado === 'firmado').length

  const eliminarItem = async (item: RrhhDocItem) => {
    const quien = item.nombre_usuario || `usuario #${item.id_usuario}`
    if (!window.confirm(`¿Eliminar el recibo de ${quien}? El empleado ya no lo verá en Mis recibos.`)) {
      return
    }
    setBusy(true)
    setError(null)
    const res = await rrhhDocItemEliminar(item.id)
    setBusy(false)
    if (!res.success) {
      setError(res.error || 'No se pudo eliminar el recibo')
      return
    }
    setMsg(`Recibo de ${quien} eliminado`)
    if (selected) await loadItems(selected.id)
  }

  const eliminarLote = async () => {
    if (!selected) return
    const titulo =
      selected.titulo?.includes('·') ? selected.titulo : tituloReciboPeriodo(selected.periodo)
    const n = items.length
    if (
      !window.confirm(
        n > 0
          ? `¿Eliminar el lote «${titulo}» y sus ${n} recibo${n === 1 ? '' : 's'}? No se puede deshacer.`
          : `¿Eliminar el lote «${titulo}»?`
      )
    ) {
      return
    }
    setBusy(true)
    setError(null)
    const res = await rrhhDocLoteEliminar(selected.id)
    setBusy(false)
    if (!res.success) {
      setError(res.error || 'No se pudo eliminar el lote')
      return
    }
    setMsg(`Lote eliminado`)
    setItems([])
    setCountsByLote((prev) => {
      const next = { ...prev }
      delete next[selected.id]
      return next
    })
    const list = await loadLotes()
    setSelectedId(list[0]?.id ?? null)
  }

  return (
    <div className="rrhh-ext-page rrhh-recibos-page">
      <header className="rrhh-recibos-hero">
        <div>
          <div className="rrhh-recibos-hero-kicker">
            <span className="rrhh-recibos-hero-mark" aria-hidden>
              ⌕
            </span>
            Recursos humanos
          </div>
          <h1>Recibos enviados</h1>
          <p>Lotes por mes, PDFs publicados y seguimiento de firmas de empleados.</p>
        </div>
        <div className="rrhh-recibos-header-actions">
          <button type="button" className="rrhh-ext-btn" onClick={() => navigate('/rrhh/libro-sueldos')}>
            Libro de sueldos
          </button>
          <button type="button" className="rrhh-ext-btn ghost" onClick={() => navigate('/rrhh')}>
            Volver
          </button>
        </div>
      </header>

      {error ? <p className="rrhh-ext-error">{error}</p> : null}
      {msg ? <p className="rrhh-recibos-ok">{msg}</p> : null}

      <div className="rrhh-recibos-layout">
        <aside className="rrhh-ext-card rrhh-recibos-aside">
          <div className="rrhh-recibos-aside-head">
            <h3>Lotes</h3>
          </div>

          <div className="rrhh-recibos-crear">
            <label>
              Mes
              <input type="month" value={periodo} onChange={(e) => setPeriodo(e.target.value)} />
            </label>
            <div className="rrhh-recibos-crear-preview">{tituloReciboPeriodo(periodo)}</div>
            <button
              type="button"
              className="rrhh-ext-btn primary"
              disabled={busy}
              onClick={() => void crear()}
            >
              Crear lote del mes
            </button>
          </div>

          {loading ? (
            <p className="rrhh-recibos-muted">Cargando…</p>
          ) : lotes.length === 0 ? (
            <p className="rrhh-recibos-muted">Todavía no hay lotes.</p>
          ) : (
            <ul className="rrhh-recibos-lotes">
              {lotes.map((l) => {
                const c = countsByLote[l.id]
                const active = selectedId === l.id
                return (
                  <li key={l.id}>
                    <button
                      type="button"
                      className={`rrhh-recibos-lote ${active ? 'is-active' : ''}`}
                      onClick={() => setSelectedId(l.id)}
                    >
                      <span className="rrhh-recibos-lote-title">
                        {l.titulo?.includes('·') ? l.titulo : tituloReciboPeriodo(l.periodo)}
                      </span>
                      <span className="rrhh-recibos-lote-meta">
                        <span className={`rrhh-ext-badge ${badgeEstado(l.estado)}`}>
                          {labelEstadoLote(l.estado)}
                        </span>
                        <span className="rrhh-recibos-muted">{labelPeriodoMes(l.periodo)}</span>
                        {c ? (
                          <span className="rrhh-recibos-muted">
                            {c.firmados}/{c.total} firmados
                          </span>
                        ) : null}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </aside>

        <section className="rrhh-ext-card rrhh-recibos-detail">
          {!selected ? (
            <div className="rrhh-recibos-empty">
              <strong>Seleccioná un lote</strong>
              <p>Elegí un mes a la izquierda para ver empleados, PDFs y firmas.</p>
            </div>
          ) : (
            <>
              <div className="rrhh-recibos-detail-head">
                <div>
                  <h2>
                    {selected.titulo?.includes('·')
                      ? selected.titulo
                      : tituloReciboPeriodo(selected.periodo)}
                  </h2>
                  <p>
                    {labelPeriodoMes(selected.periodo)} ·{' '}
                    <span className={`rrhh-ext-badge ${badgeEstado(selected.estado)}`}>
                      {labelEstadoLote(selected.estado)}
                    </span>{' '}
                    · {firmados}/{items.length} firmados
                  </p>
                </div>
                <div className="rrhh-recibos-detail-actions">
                  {selected.estado === 'borrador' ? (
                    <button
                      type="button"
                      className="rrhh-ext-btn primary"
                      disabled={busy || items.length === 0}
                      title={items.length === 0 ? 'Subí al menos un recibo antes de marcar enviado' : undefined}
                      onClick={() =>
                        void rrhhDocLoteActualizarEstado(selected.id, 'enviado').then(async () => {
                          await loadLotes()
                          setMsg('Lote marcado como enviado')
                        })
                      }
                    >
                      Marcar enviado
                    </button>
                  ) : null}
                  {selected.estado === 'enviado' ? (
                    <button
                      type="button"
                      className="rrhh-ext-btn"
                      disabled={busy}
                      onClick={() =>
                        void rrhhDocLoteActualizarEstado(selected.id, 'cerrado').then(async () => {
                          await loadLotes()
                          setMsg('Lote cerrado')
                        })
                      }
                    >
                      Cerrar lote
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="rrhh-ext-btn ghost rrhh-recibos-btn-danger"
                    disabled={busy}
                    onClick={() => void eliminarLote()}
                  >
                    Eliminar lote
                  </button>
                </div>
              </div>

              <div className="rrhh-recibos-upload">
                <h4>Agregar recibo manual</h4>
                <div className="rrhh-recibos-upload-row">
                  <label>
                    Empleado
                    <select
                      value={idUsuarioUpload}
                      onChange={(e) => setIdUsuarioUpload(e.target.value)}
                    >
                      <option value="">Elegir…</option>
                      {usuarios.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.nombre}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    PDF
                    <input
                      type="file"
                      accept=".pdf,image/*"
                      onChange={(e) => setFile(e.target.files?.[0] || null)}
                    />
                  </label>
                  <button
                    type="button"
                    className="rrhh-ext-btn primary"
                    disabled={busy}
                    onClick={() => void upload()}
                  >
                    Subir
                  </button>
                </div>
                <p className="rrhh-recibos-muted">
                  Se publica como «{tituloReciboPeriodo(selected.periodo)}» en Mis recibos del empleado.
                </p>
              </div>

              {items.length === 0 ? (
                <div className="rrhh-recibos-empty">
                  <strong>Este lote no tiene recibos</strong>
                  <p>
                    Desde el libro de sueldos usá «Enviar recibos a empleados» con la nómina marcada, o
                    subí un PDF acá.
                  </p>
                </div>
              ) : (
                <ul className="rrhh-recibos-items">
                  {items.map((i) => (
                    <li key={i.id} className="rrhh-recibos-item">
                      <div>
                        <div className="rrhh-recibos-item-name">
                          {i.nombre_usuario || `Usuario #${i.id_usuario}`}
                        </div>
                        <div className="rrhh-recibos-item-meta">
                          <span className={`rrhh-ext-badge ${badgeEstado(i.estado)}`}>
                            {labelEstadoItem(i.estado)}
                          </span>
                          <span className="rrhh-recibos-muted">
                            {i.archivo_nombre || tituloReciboPeriodo(selected.periodo)}
                          </span>
                        </div>
                      </div>
                      <div className="rrhh-recibos-item-actions">
                        <a
                          className="rrhh-ext-btn ghost"
                          href={i.archivo_url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Ver PDF
                        </a>
                        {i.firma_data_url ? (
                          <img
                            className="rrhh-recibos-firma"
                            src={i.firma_data_url}
                            alt="Firma"
                            title="Firma del empleado"
                          />
                        ) : null}
                        <button
                          type="button"
                          className="rrhh-ext-btn ghost rrhh-recibos-btn-danger"
                          disabled={busy}
                          onClick={() => void eliminarItem(i)}
                        >
                          Eliminar
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  )
}

export default RecursosHumanosRecibosPage
