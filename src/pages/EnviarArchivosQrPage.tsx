import { useCallback, useEffect, useId, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  enviarArchivosQrFijo,
  enviarArchivosSesionQr,
  leerSesionQrPantalla
} from '../services/envioArchivosQrService'
import {
  ENVIO_ACCEPT,
  ENVIO_MAX_ARCHIVOS,
  ENVIO_MAX_MB,
  agregarArchivosElegidos,
  esImagenVisible,
  esPdf,
  extensionDe,
  formatearBytes
} from '../utils/envioArchivosQr'
import './EnviarArchivosQrPage.css'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type Vista = 'cargando' | 'elegir' | 'enviado' | 'vencida' | 'invalida'

const PASOS = ['Elegí', 'Enviá', 'Listo'] as const

/**
 * Página pública que abre el celular al escanear el QR.
 * - `/enviar-archivos`            → QR fijo impreso: al terminar muestra un código para el mostrador.
 * - `/enviar-archivos/:sessionId` → QR en pantalla: los archivos aparecen en la PC que mostró el QR.
 */
export default function EnviarArchivosQrPage() {
  const { sessionId } = useParams<{ sessionId?: string }>()
  const modoSesion = sessionId != null
  const inputId = useId()
  const [vista, setVista] = useState<Vista>(modoSesion ? 'cargando' : 'elegir')
  const [files, setFiles] = useState<File[]>([])
  const [aviso, setAviso] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [avance, setAvance] = useState<number[]>([])
  const [codigo, setCodigo] = useState<string | null>(null)
  const [honeypot, setHoneypot] = useState('')
  const [arrastrando, setArrastrando] = useState(false)

  const cargarSesion = useCallback(async () => {
    if (!modoSesion) return
    if (!UUID_RE.test(sessionId || '')) {
      setVista('invalida')
      return
    }
    const s = await leerSesionQrPantalla(sessionId!)
    if (s.estado === 'abierta') setVista('elegir')
    else if (s.estado === 'completada') setVista('enviado')
    else if (s.estado === 'expirada') setVista('vencida')
    else setVista('invalida')
  }, [modoSesion, sessionId])

  useEffect(() => {
    void cargarSesion()
  }, [cargarSesion])

  // Miniaturas de las fotos elegidas.
  const previews = useMemo(
    () => files.map((f) => (esImagenVisible(f.name) ? URL.createObjectURL(f) : null)),
    [files]
  )
  useEffect(() => () => previews.forEach((u) => u && URL.revokeObjectURL(u)), [previews])

  const agregar = (lista: FileList | null) => {
    setError(null)
    if (!lista?.length) return
    const r = agregarArchivosElegidos(files, Array.from(lista))
    setFiles(r.lista)
    setAviso(r.aviso)
  }

  const enviar = async () => {
    if (!files.length || enviando) return
    setEnviando(true)
    setError(null)
    setAvance(files.map(() => 0))
    try {
      if (modoSesion) {
        const r = await enviarArchivosSesionQr(sessionId!, files, setAvance)
        if (!r.success) {
          setError(/vencida|cerrada|inexistente/i.test(r.error) ? 'El QR venció. Pedí que te muestren uno nuevo.' : r.error)
          return
        }
        setVista('enviado')
      } else {
        const r = await enviarArchivosQrFijo(files, honeypot, setAvance)
        if (!r.success) {
          setError(r.error)
          return
        }
        setCodigo(r.data.codigo)
        setVista('enviado')
      }
    } finally {
      setEnviando(false)
    }
  }

  const lleno = files.length >= ENVIO_MAX_ARCHIVOS
  const totalBytes = files.reduce((s, f) => s + f.size, 0)
  const paso = vista === 'enviado' ? 2 : files.length ? 1 : 0
  const bytesHechos = files.reduce((s, f, i) => s + f.size * (avance[i] ?? 0), 0)
  const progreso = totalBytes ? Math.round((bytesHechos * 100) / totalBytes) : 0
  const hechos = avance.filter((v) => v >= 1).length

  return (
    <div className="env-qr-page">
      <div className="env-qr-glow env-qr-glow--a" aria-hidden />
      <div className="env-qr-glow env-qr-glow--b" aria-hidden />

      <main className="env-qr-shell">
        <header className="env-qr-hero">
          <img src="/favicon.png" alt="Plot Center" className="env-qr-logo" />
          <h1>
            Enviá tus <span className="env-qr-grad">archivos</span>
          </h1>
          <p>Directo desde tu celular a nuestro equipo. Sin WhatsApp, mail ni pendrive.</p>

          {(vista === 'elegir' || vista === 'enviado') && (
            <ol className="env-qr-pasos" aria-label="Pasos">
              {PASOS.map((p, i) => (
                <li key={p} className={i < paso ? 'is-done' : i === paso ? 'is-on' : ''}>
                  <span className="env-qr-paso-num">{i < paso ? '✓' : i + 1}</span>
                  {p}
                </li>
              ))}
            </ol>
          )}
        </header>

        <section className="env-qr-card">
          {vista === 'cargando' && (
            <div className="env-qr-estado">
              <span className="env-qr-spinner" aria-hidden />
              <p>Conectando con Plot Center…</p>
            </div>
          )}

          {vista === 'invalida' && (
            <div className="env-qr-estado">
              <div className="env-qr-estado-icon is-warn" aria-hidden>
                !
              </div>
              <h2>Este enlace no es válido</h2>
              <p>Escaneá de nuevo el QR que te mostraron en Plot Center.</p>
            </div>
          )}

          {vista === 'vencida' && (
            <div className="env-qr-estado">
              <div className="env-qr-estado-icon is-warn" aria-hidden>
                <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <circle cx="12" cy="13" r="8" />
                  <path d="M12 9v4l2.5 2M9.5 2.5h5" />
                </svg>
              </div>
              <h2>Este QR venció</h2>
              <p>Pedí en el mostrador que te muestren uno nuevo. Dura unos minutos.</p>
            </div>
          )}

          {vista === 'enviado' && (
            <div className="env-qr-estado env-qr-exito" role="status">
              <svg className="env-qr-check" viewBox="0 0 80 80" aria-hidden>
                <circle className="env-qr-check-ring" cx="40" cy="40" r="36" />
                <path className="env-qr-check-tick" d="M25 41l10 10 20-22" />
              </svg>
              {codigo ? (
                <>
                  <h2>¡Recibimos tus archivos!</h2>
                  <p>Decí este código en el mostrador</p>
                  <div className="env-qr-codigo" aria-label={`Código ${codigo.split('').join(' ')}`}>
                    {codigo.split('').map((d, i) => (
                      <span key={i} style={{ animationDelay: `${0.35 + i * 0.08}s` }}>
                        {d}
                      </span>
                    ))}
                  </div>
                  <p className="env-qr-tip">📸 Sacale una captura por las dudas</p>
                  <button
                    type="button"
                    className="env-qr-secundario"
                    onClick={() => {
                      setFiles([])
                      setCodigo(null)
                      setAviso(null)
                      setVista('elegir')
                    }}
                  >
                    Enviar otros archivos
                  </button>
                </>
              ) : (
                <>
                  <h2>¡Listo, ya llegaron!</h2>
                  <p>Tus archivos aparecieron en la pantalla de quien te atiende. Podés cerrar esta página.</p>
                </>
              )}
            </div>
          )}

          {vista === 'elegir' && (
            <div className="env-qr-form">
              <div
                className={`env-qr-drop${arrastrando ? ' is-drag' : ''}${lleno ? ' is-full' : ''}${files.length ? ' is-compact' : ''}`}
                onDragOver={(e) => {
                  e.preventDefault()
                  if (!lleno) setArrastrando(true)
                }}
                onDragLeave={() => setArrastrando(false)}
                onDrop={(e) => {
                  e.preventDefault()
                  setArrastrando(false)
                  agregar(e.dataTransfer.files)
                }}
              >
                <input
                  id={inputId}
                  type="file"
                  multiple
                  accept={ENVIO_ACCEPT}
                  className="env-qr-file"
                  disabled={lleno || enviando}
                  onChange={(e) => {
                    agregar(e.target.files)
                    e.target.value = ''
                  }}
                />
                <label htmlFor={inputId} className="env-qr-drop-label">
                  <span className="env-qr-drop-icon" aria-hidden>
                    <svg viewBox="0 0 48 48" width="34" height="34" fill="none">
                      <path d="M24 31V11m0 0-8 8m8-8 8 8" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M10 31v5a4 4 0 0 0 4 4h20a4 4 0 0 0 4-4v-5" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  <span className="env-qr-drop-text">
                    <strong>
                      {lleno ? 'Llegaste al máximo' : files.length ? 'Agregar más archivos' : 'Tocá para elegir tus archivos'}
                    </strong>
                    <span>
                      Hasta {ENVIO_MAX_ARCHIVOS} archivos · {ENVIO_MAX_MB} MB cada uno
                    </span>
                  </span>
                  {!files.length && (
                    <span className="env-qr-formatos" aria-hidden>
                      {['PDF', 'JPG', 'PNG', 'HEIC'].map((x) => (
                        <span key={x}>{x}</span>
                      ))}
                    </span>
                  )}
                </label>
              </div>

              {files.length > 0 && (
                <>
                  <div className="env-qr-resumen">
                    <strong>
                      {files.length} archivo{files.length === 1 ? '' : 's'}
                    </strong>
                    <span>{formatearBytes(totalBytes)}</span>
                  </div>
                  <ul className="env-qr-lista">
                    {files.map((f, i) => {
                      const v = avance[i] ?? 0
                      const ok = enviando && v >= 1
                      const subiendo = enviando && !ok
                      const pct = Math.round(v * 100)
                      return (
                        <li key={`${f.name}-${f.size}`} className={`${ok ? 'is-ok' : ''}${subiendo ? ' is-up' : ''}`}>
                          {subiendo && <span className="env-qr-item-barra" style={{ width: `${pct}%` }} aria-hidden />}
                          <span className="env-qr-thumb" data-pdf={esPdf(f.name) || undefined}>
                            {previews[i] ? (
                              <img src={previews[i]!} alt="" />
                            ) : (
                              <span>{(extensionDe(f.name) || 'archivo').toUpperCase()}</span>
                            )}
                          </span>
                          <span className="env-qr-nombre">
                            <strong>{f.name}</strong>
                            <small>
                              {ok
                                ? 'Enviado'
                                : subiendo
                                  ? pct > 0
                                    ? `${pct}% · ${formatearBytes(f.size)}`
                                    : 'En espera…'
                                  : formatearBytes(f.size)}
                            </small>
                          </span>
                          {enviando ? (
                            <span className={`env-qr-estado-item${ok ? ' is-ok' : ''}`} aria-hidden>
                              {ok ? '✓' : pct > 0 ? <span className="env-qr-spinner is-sm" /> : null}
                            </span>
                          ) : (
                            <button
                              type="button"
                              className="env-qr-quitar"
                              aria-label={`Quitar ${f.name}`}
                              onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                            >
                              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                                <path d="M6 6l12 12M18 6 6 18" />
                              </svg>
                            </button>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                </>
              )}

              {/* Campo trampa para bots: oculto a las personas. */}
              {!modoSesion && (
                <div className="env-qr-hp" aria-hidden="true">
                  <label>
                    Sitio web
                    <input tabIndex={-1} autoComplete="off" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} />
                  </label>
                </div>
              )}

              {aviso && <p className="env-qr-aviso">{aviso}</p>}
              {error && <p className="env-qr-error">{error}</p>}

              <div className="env-qr-accion">
                {enviando && (
                  <div className="env-qr-barra" aria-hidden>
                    <span style={{ width: `${Math.max(progreso, 6)}%` }} />
                  </div>
                )}
                <button type="button" className="env-qr-enviar" disabled={!files.length || enviando} onClick={() => void enviar()}>
                  {enviando ? (
                    <>
                      Enviando… {progreso}%
                      {files.length > 1 && (
                        <span className="env-qr-enviar-sub">
                          {hechos}/{files.length}
                        </span>
                      )}
                    </>
                  ) : (
                    <>
                      {files.length > 1 ? `Enviar ${files.length} archivos` : 'Enviar archivo'}
                      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="M4 12h15m0 0-6-6m6 6-6 6" />
                      </svg>
                    </>
                  )}
                </button>
                {enviando && <p className="env-qr-muted">No cierres esta página hasta que termine.</p>}
              </div>
            </div>
          )}
        </section>

        <footer className="env-qr-pie">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <rect x="5" y="11" width="14" height="9" rx="2" />
            <path d="M8 11V8a4 4 0 0 1 8 0v3" />
          </svg>
          Usamos tus archivos solo para tu trabajo.
        </footer>
      </main>
    </div>
  )
}
