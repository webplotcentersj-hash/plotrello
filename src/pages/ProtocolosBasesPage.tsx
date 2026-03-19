import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import apiService from '../services/api'
import { uploadAttachmentAndGetUrl } from '../utils/storage'
import { generateContent } from '../services/plotAIService'
import type { ProtocoloBaseRecord } from '../types/api'
import './ProtocolosBasesPage.css'

type UploadMode = 'file' | 'plotai'
type TipoDocumento = 'protocolo' | 'base' | 'otro'

const DEFAULT_TIPO: TipoDocumento = 'protocolo'

function parseTags(input: string): string[] {
  return input
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
}

function escapeForRtf(text: string) {
  // Minimal escaping so Word can open the downloaded .doc (as RTF).
  return text
    .replace(/\\/g, '\\\\')
    .replace(/{/g, '\\{')
    .replace(/}/g, '\\}')
}

function buildRtfDocument(contentText: string) {
  const safe = escapeForRtf(contentText)
  // Convert newlines to RTF paragraph breaks.
  const body = safe.replace(/\r\n/g, '\n').replace(/\n/g, '\\par\n')
  return `{\\rtf1\\ansi\\deff0{\\fonttbl{\\f0 Arial;}}\\fs24 ${body}}`
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export default function ProtocolosBasesPage() {
  const navigate = useNavigate()
  const { usuario, canManageRecursosHumanos, loading: authLoading } = useAuth()

  // Solo pueden subir: Administracion y Recursos Humanos
  const canUpload = !!usuario && (usuario.rol === 'administracion' || usuario.rol === 'recursos-humanos' || canManageRecursosHumanos)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<ProtocoloBaseRecord[]>([])

  const [search, setSearch] = useState('')
  const [tipoFilter, setTipoFilter] = useState<TipoDocumento | 'todos'>('todos')

  const [uploadMode, setUploadMode] = useState<UploadMode>('file')
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const [titulo, setTitulo] = useState('')
  const [categoria, setCategoria] = useState('')
  const [tagsInput, setTagsInput] = useState('')
  const [tipoDoc, setTipoDoc] = useState<TipoDocumento>(DEFAULT_TIPO)
  const [archivo, setArchivo] = useState<File | null>(null)

  const [plotPrompt, setPlotPrompt] = useState('')
  const [plotGenerating, setPlotGenerating] = useState(false)
  const [contenidoGenerado, setContenidoGenerado] = useState('')
  const [plotError, setPlotError] = useState<string | null>(null)

  const [selected, setSelected] = useState<ProtocoloBaseRecord | null>(null)

  useEffect(() => {
    if (authLoading) return
    if (!usuario) {
      navigate('/login')
      return
    }

    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const resp = await apiService.getProtocolosBases()
        if (cancelled) return
        if (resp.success && resp.data) {
          setItems(resp.data)
        } else {
          setError(resp.error || 'Error al cargar protocolos y bases.')
        }
      } catch (e) {
        if (cancelled) return
        setError(e instanceof Error ? e.message : 'Error al cargar protocolos y bases.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()

    return () => {
      cancelled = true
    }
  }, [authLoading, usuario, navigate])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return items.filter((it) => {
      const matchesTipo = tipoFilter === 'todos' || it.tipo === tipoFilter
      if (!matchesTipo) return false
      if (!q) return true

      const hayTags = (it.tags || []).join(', ').toLowerCase()
      return (
        it.titulo.toLowerCase().includes(q) ||
        (it.categoria || '').toLowerCase().includes(q) ||
        hayTags.includes(q) ||
        (it.archivo_nombre || '').toLowerCase().includes(q)
      )
    })
  }, [items, search, tipoFilter])

  const resetUploadForm = () => {
    setTitulo('')
    setCategoria('')
    setTagsInput('')
    setTipoDoc(DEFAULT_TIPO)
    setArchivo(null)
    setPlotPrompt('')
    setPlotError(null)
    setContenidoGenerado('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleUploadFile = async () => {
    if (!usuario) return
    if (!canUpload) return
    if (!archivo) {
      setError('Seleccioná un archivo (PDF/DOC/DOCX/TXT).')
      return
    }
    if (!titulo.trim()) {
      setError('Ingresá el título del documento.')
      return
    }

    setError(null)
    setLoading(true)
    try {
      const tags = parseTags(tagsInput)
      const archivoNombre = archivo.name
      const mime = archivo.type || 'application/octet-stream'

      const archivoUrl = await uploadAttachmentAndGetUrl(archivo, 'protocolos-bases')

      const resp = await apiService.createProtocoloBase({
        titulo: titulo.trim(),
        categoria: categoria.trim() || null,
        tipo: tipoDoc,
        tags,
        archivoUrl,
        archivoNombre,
        fileMime: mime,
        contenidoTexto: null
      })

      if (!resp.success) {
        setError(resp.error || 'No se pudo guardar el documento.')
        return
      }
      resetUploadForm()

      const listResp = await apiService.getProtocolosBases()
      if (listResp.success && listResp.data) setItems(listResp.data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al subir/guardar el documento.')
    } finally {
      setLoading(false)
    }
  }

  const handleGenerateWithPlotAI = async () => {
    if (!usuario) return
    if (!canUpload) return
    if (!plotPrompt.trim()) {
      setPlotError('Escribí un tema o consigna para generar el protocolo con PlotAI.')
      return
    }

    setPlotError(null)
    setPlotGenerating(true)
    setContenidoGenerado('')
    try {
      const prompt = [
        'Genera un documento interno para la empresa con el siguiente objetivo:',
        plotPrompt.trim(),
        '',
        'Requisitos del documento:',
        '- Titulo en la primera línea.',
        '- Estructura clara con secciones y viñetas.',
        '- Estilo profesional y accionable.',
        '- Incluir: alcance, responsabilidades, procedimiento y validaciones.',
        '- Usar español.'
      ].join('\n')

      const response = await generateContent({
        contents: prompt,
        useCompleteContext: false,
        useMemory: false,
        learnFromResponse: false
      })

      setContenidoGenerado(response.trim())
    } catch (e) {
      setPlotError(e instanceof Error ? e.message : 'Error generando con PlotAI.')
    } finally {
      setPlotGenerating(false)
    }
  }

  const handleSaveGenerated = async () => {
    if (!usuario) return
    if (!canUpload) return
    if (!titulo.trim()) {
      setError('Ingresá el título del documento.')
      return
    }
    if (!contenidoGenerado.trim()) {
      setError('No hay contenido generado para guardar.')
      return
    }

    setError(null)
    setLoading(true)
    try {
      const tags = parseTags(tagsInput)
      const resp = await apiService.createProtocoloBase({
        titulo: titulo.trim(),
        categoria: categoria.trim() || null,
        tipo: tipoDoc,
        tags,
        archivoUrl: null,
        archivoNombre: null,
        fileMime: null,
        contenidoTexto: contenidoGenerado.trim()
      })

      if (!resp.success) {
        setError(resp.error || 'No se pudo guardar el documento generado.')
        return
      }

      resetUploadForm()
      const listResp = await apiService.getProtocolosBases()
      if (listResp.success && listResp.data) setItems(listResp.data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar el documento.')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!usuario) return
    if (!canUpload) return

    // eslint-disable-next-line no-alert
    if (!window.confirm('¿Eliminar este documento?')) return

    setLoading(true)
    setError(null)
    try {
      const resp = await apiService.deleteProtocoloBase(id)
      if (!resp.success) {
        setError(resp.error || 'No se pudo eliminar el documento.')
        return
      }
      const listResp = await apiService.getProtocolosBases()
      if (listResp.success && listResp.data) setItems(listResp.data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al eliminar el documento.')
    } finally {
      setLoading(false)
    }
  }

  const downloadContent = (doc: ProtocoloBaseRecord, format: 'txt' | 'doc') => {
    const content = doc.contenido_texto || ''
    if (!content.trim()) return

    if (format === 'txt') {
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
      downloadBlob(blob, `${doc.titulo}.txt`)
      return
    }

    const rtf = buildRtfDocument(content)
    const blob = new Blob([rtf], { type: 'application/msword;charset=utf-8' })
    downloadBlob(blob, `${doc.titulo}.doc`)
  }

  if (authLoading || loading && items.length === 0) {
    return (
      <div className="protocolos-bases-page">
        <div className="loading-container">
          <div className="spinner" />
          <p>Cargando protocolos y bases...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="protocolos-bases-page">
      <header className="protocolos-bases-header">
        <div className="protocolos-bases-header-content">
          <button type="button" className="back-button" onClick={() => navigate('/')}>
            ← Volver al Tablero
          </button>
          <div className="protocolos-bases-title">
            <img
              className="protocolos-bases-logo"
              src="https://trello.plotcenter.com.ar/Group%20187.png"
              alt="Plot Center Logo"
            />
            <div className="protocolos-bases-title-text">
              <h1>Protocolos y Bases</h1>
              <p className="subtitle">Documentos para que el equipo trabaje con el mismo criterio.</p>
            </div>
          </div>
        </div>
      </header>

      {error && (
        <div className="error-message protocolos-error" role="alert">
          {error}
        </div>
      )}

      <main className="protocolos-bases-main">
        {canUpload && (
          <section className="protocolos-bases-upload">
            <div className="protocolos-bases-upload-header">
              <h2>Subir o generar</h2>
              <div className="upload-mode-toggle">
                <button
                  type="button"
                  className={`brand-button ${uploadMode === 'file' ? 'active' : ''}`}
                  onClick={() => setUploadMode('file')}
                >
                  Subir archivo
                </button>
                <button
                  type="button"
                  className={`brand-button ${uploadMode === 'plotai' ? 'active' : ''}`}
                  onClick={() => setUploadMode('plotai')}
                >
                  Generar con PlotAI
                </button>
              </div>
            </div>

            <div className="protocolos-bases-form">
              <div className="form-row">
                <label className="form-label">Titulo</label>
                <input className="form-input" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ej: Protocolo de Calidad - 2026" />
              </div>

              <div className="form-row">
                <label className="form-label">Tipo</label>
                <select className="form-input" value={tipoDoc} onChange={(e) => setTipoDoc(e.target.value as TipoDocumento)}>
                  <option value="protocolo">Protocolo</option>
                  <option value="base">Base</option>
                  <option value="otro">Otro</option>
                </select>
              </div>

              <div className="form-row">
                <label className="form-label">Categoria</label>
                <input className="form-input" value={categoria} onChange={(e) => setCategoria(e.target.value)} placeholder="Ej: Calidad / Seguridad / Operaciones" />
              </div>

              <div className="form-row">
                <label className="form-label">Tags (separados por coma)</label>
                <input className="form-input" value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} placeholder="Ej: seguridad, rrhh, procedimiento" />
              </div>

              {uploadMode === 'file' && (
                <>
                  <div className="form-row">
                    <label className="form-label">Archivo (PDF/DOC/DOCX/TXT)</label>
                    <input
                      ref={fileInputRef}
                      className="form-input"
                      type="file"
                      accept=".pdf,.doc,.docx,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                      onChange={(e) => setArchivo(e.target.files?.[0] || null)}
                    />
                  </div>

                  <div className="upload-actions">
                    <button type="button" className="brand-button primary" onClick={handleUploadFile} disabled={!archivo || !titulo.trim()}>
                      Guardar documento
                    </button>
                    <button type="button" className="brand-button" onClick={resetUploadForm}>
                      Limpiar
                    </button>
                  </div>
                </>
              )}

              {uploadMode === 'plotai' && (
                <>
                  <div className="form-row">
                    <label className="form-label">Consigna / Tema</label>
                    <textarea
                      className="form-textarea"
                      value={plotPrompt}
                      onChange={(e) => setPlotPrompt(e.target.value)}
                      placeholder="Ej: Cómo debe operar el sector de RRHH al recibir documentación de nuevos empleados (paso a paso)."
                      rows={4}
                    />
                  </div>

                  <div className="upload-actions">
                    <button type="button" className="brand-button primary" onClick={handleGenerateWithPlotAI} disabled={plotGenerating}>
                      {plotGenerating ? 'Generando...' : 'Generar con PlotAI'}
                    </button>
                    <button
                      type="button"
                      className="brand-button"
                      onClick={() => {
                        setPlotError(null)
                        setContenidoGenerado('')
                      }}
                      disabled={plotGenerating}
                    >
                      Limpiar resultado
                    </button>
                  </div>

                  {plotError && (
                    <div className="error-message" role="alert">
                      {plotError}
                    </div>
                  )}

                  <div className="form-row">
                    <label className="form-label">Contenido (editá si querés)</label>
                    <textarea
                      className="form-textarea"
                      value={contenidoGenerado}
                      onChange={(e) => setContenidoGenerado(e.target.value)}
                      placeholder="El contenido generado aparecerá aquí..."
                      rows={10}
                    />
                  </div>

                  <div className="upload-actions">
                    <button type="button" className="brand-button primary" onClick={handleSaveGenerated} disabled={!contenidoGenerado.trim()}>
                      Guardar documento generado
                    </button>
                  </div>
                </>
              )}
            </div>
          </section>
        )}

        <section className="protocolos-bases-library">
          <div className="protocolos-bases-library-toolbar">
            <div className="search-row">
              <div className="protocolos-bases-search-title">Buscar</div>
              <input
                className="form-input"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por título, categoría o tag..."
              />
              <select className="form-input" value={tipoFilter} onChange={(e) => setTipoFilter(e.target.value as any)}>
                <option value="todos">Todos</option>
                <option value="protocolo">Protocolos</option>
                <option value="base">Bases</option>
                <option value="otro">Otros</option>
              </select>
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="empty-state">
              <p>No se encontraron documentos.</p>
            </div>
          ) : (
            <div className="protocolos-bases-list">
              {filtered.map((doc) => (
                <div key={doc.id} className="protocolos-bases-card">
                  <div className="protocolos-bases-card-header">
                    <div className="protocolos-bases-card-main">
                      <h3 className="protocolos-bases-card-title">{doc.titulo}</h3>
                      <div className="protocolos-bases-meta">
                        <span className="pill">{doc.tipo}</span>
                        {doc.categoria && <span className="pill pill-secondary">{doc.categoria}</span>}
                        <span className="protocolos-bases-date">
                          {doc.created_at ? new Date(doc.created_at).toLocaleString('es-AR') : ''}
                        </span>
                      </div>
                      {!!doc.tags?.length && (
                        <div className="protocolos-bases-tags">
                          {doc.tags.map((t) => (
                            <span key={t} className="tag">
                              {t}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="protocolos-bases-card-actions">
                      {doc.archivo_url ? (
                        <>
                          <a className="brand-button" href={doc.archivo_url} target="_blank" rel="noreferrer">
                            Abrir
                          </a>
                          <a
                            className="brand-button primary"
                            href={doc.archivo_url}
                            download={doc.archivo_nombre || `${doc.titulo}`}
                          >
                            Descargar
                          </a>
                        </>
                      ) : (
                        <>
                          <button type="button" className="brand-button" onClick={() => setSelected(doc)}>
                            Ver
                          </button>
                          <button
                            type="button"
                            className="brand-button primary"
                            onClick={() => downloadContent(doc, 'txt')}
                          >
                            Descargar .txt
                          </button>
                          <button
                            type="button"
                            className="brand-button"
                            onClick={() => downloadContent(doc, 'doc')}
                          >
                            Descargar .doc
                          </button>
                        </>
                      )}

                      {canUpload && (
                        <button type="button" className="btn-danger" onClick={() => handleDelete(doc.id)}>
                          Eliminar
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {selected && (
        <div className="protocolos-bases-modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && setSelected(null)}>
          <div className="protocolos-bases-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="protocolos-bases-modal-header">
              <h3>{selected.titulo}</h3>
              <button type="button" className="protocolos-bases-modal-close" onClick={() => setSelected(null)} aria-label="Cerrar">
                ✕
              </button>
            </div>
            <div className="protocolos-bases-modal-body">
              <pre className="protocolos-bases-content-pre">{selected.contenido_texto || ''}</pre>
            </div>
            <div className="protocolos-bases-modal-footer">
              <button type="button" className="brand-button" onClick={() => downloadContent(selected, 'txt')}>
                Descargar .txt
              </button>
              <button type="button" className="brand-button primary" onClick={() => downloadContent(selected, 'doc')}>
                Descargar .doc
              </button>
              <button type="button" className="brand-button" onClick={() => setSelected(null)}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

