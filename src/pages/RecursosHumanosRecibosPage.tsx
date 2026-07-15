import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import {
  rrhhDocItemAgregar,
  rrhhDocItemsListar,
  rrhhDocLoteActualizarEstado,
  rrhhDocLoteCrear,
  rrhhDocLotesListar,
  rrhhDocSubirArchivo
} from '../services/rrhhExtendidoService'
import apiService from '../services/api'
import type { RrhhDocItem, RrhhDocLote } from '../types/api'
import './rrhhExtendido.css'

const RecursosHumanosRecibosPage = () => {
  const navigate = useNavigate()
  const { usuario, canManageRecursosHumanos, loading: authLoading } = useAuth()
  const canAccess = !!usuario && (canManageRecursosHumanos || usuario.rol === 'gerencia')
  const [lotes, setLotes] = useState<RrhhDocLote[]>([])
  const [selected, setSelected] = useState<RrhhDocLote | null>(null)
  const [items, setItems] = useState<RrhhDocItem[]>([])
  const [usuarios, setUsuarios] = useState<Array<{ id: number; nombre: string }>>([])
  const [periodo, setPeriodo] = useState(() => new Date().toISOString().slice(0, 7))
  const [titulo, setTitulo] = useState('Recibos de sueldo')
  const [idUsuarioUpload, setIdUsuarioUpload] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadLotes = useCallback(async () => {
    const res = await rrhhDocLotesListar()
    if (res.success && res.data) setLotes(res.data)
  }, [])

  const loadItems = useCallback(async (loteId: number) => {
    const res = await rrhhDocItemsListar(loteId)
    if (res.success && res.data) setItems(res.data)
  }, [])

  useEffect(() => {
    if (authLoading) return
    if (!canAccess) {
      navigate('/rrhh')
      return
    }
    void loadLotes()
    void apiService.getUsuarios().then((r) => {
      if (r.success && r.data) setUsuarios(r.data.map((u) => ({ id: u.id, nombre: u.nombre })))
    })
  }, [authLoading, canAccess, navigate, loadLotes])

  useEffect(() => {
    if (selected) void loadItems(selected.id)
  }, [selected, loadItems])

  const crear = async () => {
    if (!usuario) return
    const res = await rrhhDocLoteCrear({
      periodo,
      titulo: `${titulo} ${periodo}`,
      created_by: usuario.id
    })
    if (!res.success) setError(res.error || 'Error')
    else {
      await loadLotes()
      if (res.data) setSelected(res.data)
    }
  }

  const upload = async () => {
    if (!selected || !file || !idUsuarioUpload) {
      setError('Lote, usuario y archivo requeridos')
      return
    }
    const up = await rrhhDocSubirArchivo(file, Number(idUsuarioUpload))
    if (!up.success || !up.data) {
      setError(up.error || 'Upload falló')
      return
    }
    const add = await rrhhDocItemAgregar({
      id_lote: selected.id,
      id_usuario: Number(idUsuarioUpload),
      archivo_url: up.data.url,
      archivo_nombre: up.data.nombre
    })
    if (!add.success) setError(add.error || 'Error')
    else {
      setFile(null)
      await loadItems(selected.id)
    }
  }

  const firmados = items.filter((i) => i.estado === 'firmado').length

  return (
    <div className="rrhh-ext-page">
      <header className="rrhh-ext-header">
        <div>
          <h1>Recibos / documentación firmada</h1>
          <p>Lotes mensuales: subir PDFs y seguimiento de firmas.</p>
        </div>
        <button type="button" className="rrhh-ext-btn ghost" onClick={() => navigate('/rrhh')}>
          Volver
        </button>
      </header>
      {error ? <p className="rrhh-ext-error">{error}</p> : null}

      <div className="rrhh-ext-grid">
        <div className="rrhh-ext-card">
          <h3>Lotes</h3>
          <div className="rrhh-ext-form" style={{ marginBottom: 12 }}>
            <label>
              Período
              <input type="month" value={periodo} onChange={(e) => setPeriodo(e.target.value)} />
            </label>
            <label>
              Título base
              <input value={titulo} onChange={(e) => setTitulo(e.target.value)} />
            </label>
            <button type="button" className="rrhh-ext-btn primary" onClick={() => void crear()}>
              Crear lote
            </button>
          </div>
          <ul className="rrhh-ext-list">
            {lotes.map((l) => (
              <li
                key={l.id}
                className={selected?.id === l.id ? 'active' : ''}
                onClick={() => setSelected(l)}
              >
                <span>
                  {l.titulo}
                  <br />
                  <small className="rrhh-ext-badge">{l.estado}</small>
                </span>
                <span>{l.periodo}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rrhh-ext-card">
          {selected ? (
            <>
              <h3>
                {selected.titulo}{' '}
                <span className="rrhh-ext-badge">
                  {firmados}/{items.length} firmados
                </span>
              </h3>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                {selected.estado === 'borrador' ? (
                  <button
                    type="button"
                    className="rrhh-ext-btn primary"
                    onClick={() =>
                      void rrhhDocLoteActualizarEstado(selected.id, 'enviado').then(() => loadLotes())
                    }
                  >
                    Marcar enviado
                  </button>
                ) : null}
                {selected.estado === 'enviado' ? (
                  <button
                    type="button"
                    className="rrhh-ext-btn"
                    onClick={() =>
                      void rrhhDocLoteActualizarEstado(selected.id, 'cerrado').then(() => loadLotes())
                    }
                  >
                    Cerrar lote
                  </button>
                ) : null}
              </div>
              <div className="rrhh-ext-form" style={{ marginBottom: 16 }}>
                <label>
                  Empleado
                  <select value={idUsuarioUpload} onChange={(e) => setIdUsuarioUpload(e.target.value)}>
                    <option value="">—</option>
                    {usuarios.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.nombre}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  PDF / archivo
                  <input
                    type="file"
                    accept=".pdf,image/*"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                  />
                </label>
                <button type="button" className="rrhh-ext-btn primary" onClick={() => void upload()}>
                  Subir al lote
                </button>
              </div>
              <table className="rrhh-ext-table">
                <thead>
                  <tr>
                    <th>Empleado</th>
                    <th>Archivo</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((i) => (
                    <tr key={i.id}>
                      <td>{i.nombre_usuario || i.id_usuario}</td>
                      <td>
                        <a href={i.archivo_url} target="_blank" rel="noreferrer">
                          {i.archivo_nombre || 'Ver'}
                        </a>
                      </td>
                      <td>
                        <span className={`rrhh-ext-badge ${i.estado === 'firmado' ? 'ok' : 'warn'}`}>
                          {i.estado}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : (
            <p>Seleccioná un lote</p>
          )}
        </div>
      </div>
    </div>
  )
}

export default RecursosHumanosRecibosPage
