import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import apiService from '../services/api'
import type { ClienteRecord } from '@/types/api'
import { TotemAutogestionKioskShell } from './TotemAutogestionKioskShell'
import './TotemAutogestionImprimirPage.css'

const digitsOnly = (s: string) => String(s ?? '').replace(/\D/g, '')

const TOTEM_PRINT_EMAIL = 'totem@plotcenter.com.ar'
const WA_CHAT_URL = 'https://wa.me/5492646212163'
const MAX_PENDRIVE_BYTES = 4 * 1024 * 1024

type Step = 'form' | 'sending' | 'done'
type OrigenArchivo = 'WhatsApp' | 'Drive' | 'Email' | 'Pendrive' | 'CelularQR'

export default function TotemAutogestionImprimirPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>('form')
  const [error, setError] = useState<string | null>(null)

  const [clienteNombre, setClienteNombre] = useState('')
  const [clienteDni, setClienteDni] = useState('')
  const [clienteTelefono, setClienteTelefono] = useState('')
  const [cantidadHojas, setCantidadHojas] = useState(1)
  const [tipoImpresion, setTipoImpresion] = useState('A4 - Color')
  const [origenArchivo, setOrigenArchivo] = useState<OrigenArchivo>('CelularQR')
  const [archivoUrl, setArchivoUrl] = useState('')
  const [archivoNombre, setArchivoNombre] = useState('')
  const [valorTotal, setValorTotal] = useState<string>('0')

  const [nombreSugerencias, setNombreSugerencias] = useState<ClienteRecord[]>([])
  const [nombreLoading, setNombreLoading] = useState(false)
  const [nombreMenuOpen, setNombreMenuOpen] = useState(false)

  const [pendriveDataUrl, setPendriveDataUrl] = useState<string | null>(null)
  const [waQrSrc, setWaQrSrc] = useState<string | null>(null)
  const [origenPulse, setOrigenPulse] = useState(false)

  const [qrUploadPageUrl, setQrUploadPageUrl] = useState<string | null>(null)
  const [qrLinkSrc, setQrLinkSrc] = useState<string | null>(null)
  const [qrSesionError, setQrSesionError] = useState<string | null>(null)

  const nombreWrapRef = useRef<HTMLDivElement>(null)
  const origenSectionRef = useRef<HTMLDivElement>(null)
  const pendriveInputRef = useRef<HTMLInputElement>(null)
  const pollRef = useRef<number | null>(null)
  const lastEmptyScrollAt = useRef(0)

  const [result, setResult] = useState<{ id: number; numeroVenta?: string | null } | null>(null)

  const dniDigits = useMemo(() => digitsOnly(clienteDni), [clienteDni])

  useEffect(() => {
    if (step !== 'done') return
    const t = window.setTimeout(() => navigate('/totem/autogestion', { replace: true }), 60_000)
    return () => window.clearTimeout(t)
  }, [step, navigate])

  useEffect(() => {
    if (origenArchivo === 'WhatsApp') setArchivoUrl(WA_CHAT_URL)
    else if (origenArchivo === 'Email') {
      const subj = encodeURIComponent('Archivo para impresión (tótem autogestión)')
      setArchivoUrl(`mailto:${TOTEM_PRINT_EMAIL}?subject=${subj}`)
    } else if (origenArchivo === 'Drive') setArchivoUrl('')
    else if (origenArchivo === 'Pendrive') setArchivoUrl('')
    else if (origenArchivo === 'CelularQR') setArchivoUrl('')
  }, [origenArchivo])

  useEffect(() => {
    if (origenArchivo !== 'Pendrive') {
      setPendriveDataUrl(null)
      if (pendriveInputRef.current) pendriveInputRef.current.value = ''
    }
  }, [origenArchivo])

  useEffect(() => {
    if (origenArchivo !== 'CelularQR') {
      if (pollRef.current != null) {
        window.clearInterval(pollRef.current)
        pollRef.current = null
      }
      setQrUploadPageUrl(null)
      setQrLinkSrc(null)
      setQrSesionError(null)
      return
    }

    let cancelled = false
    setQrSesionError(null)
    setQrUploadPageUrl(null)
    setQrLinkSrc(null)

    void (async () => {
      const r = await apiService.crearSesionQrUploadTotem()
      if (cancelled) return
      if (!r.success || !r.data?.session_id) {
        setQrSesionError(r.error || 'No se pudo crear la sesión. ¿Está aplicada la migración del tótem QR?')
        return
      }
      const id = r.data.session_id
      const url = `${window.location.origin}/totem/subir-archivo/${id}`
      setQrUploadPageUrl(url)

      pollRef.current = window.setInterval(() => {
        void (async () => {
          const s = await apiService.obtenerSesionQrUploadTotem(id)
          if (!s.success || !s.data) return
          const d = s.data
          if (d.ok === false) return
          if (d.estado === 'completada' && d.archivo_url) {
            setArchivoUrl(String(d.archivo_url))
            if (d.archivo_nombre) setArchivoNombre(String(d.archivo_nombre))
            if (pollRef.current != null) {
              window.clearInterval(pollRef.current)
              pollRef.current = null
            }
          }
        })()
      }, 2200)
    })()

    return () => {
      cancelled = true
      if (pollRef.current != null) {
        window.clearInterval(pollRef.current)
        pollRef.current = null
      }
    }
  }, [origenArchivo])

  useEffect(() => {
    if (!qrUploadPageUrl) {
      setQrLinkSrc(null)
      return
    }
    let cancelled = false
    void import('qrcode').then((QR) => {
      QR.default
        .toDataURL(qrUploadPageUrl, {
          margin: 1,
          width: 240,
          color: { dark: '#0c1222', light: '#ffffff' }
        })
        .then((src) => {
          if (!cancelled) setQrLinkSrc(src)
        })
        .catch(() => {
          if (!cancelled) setQrLinkSrc(null)
        })
    })
    return () => {
      cancelled = true
    }
  }, [qrUploadPageUrl])

  useEffect(() => {
    if (origenArchivo !== 'WhatsApp') {
      setWaQrSrc(null)
      return
    }
    let cancelled = false
    void import('qrcode').then((QR) => {
      QR.default
        .toDataURL(WA_CHAT_URL, {
          margin: 1,
          width: 220,
          color: { dark: '#0c1222', light: '#fff7ed' }
        })
        .then((url) => {
          if (!cancelled) setWaQrSrc(url)
        })
        .catch(() => {
          if (!cancelled) setWaQrSrc(null)
        })
    })
    return () => {
      cancelled = true
    }
  }, [origenArchivo])

  useEffect(() => {
    let cancelled = false
    const q = clienteNombre.trim()
    if (q.length < 3) {
      setNombreSugerencias([])
      setNombreLoading(false)
      setNombreMenuOpen(false)
      return
    }

    setNombreLoading(true)
    const t = window.setTimeout(() => {
      void (async () => {
        const res = await apiService.buscarClientes(q)
        if (cancelled) return
        setNombreLoading(false)
        if (!res.success || !res.data) {
          setNombreSugerencias([])
          setNombreMenuOpen(false)
          return
        }
        setNombreSugerencias(res.data)
        setNombreMenuOpen(res.data.length > 0)

        if (res.data.length === 0) {
          const now = Date.now()
          if (now - lastEmptyScrollAt.current > 5000) {
            lastEmptyScrollAt.current = now
            requestAnimationFrame(() => {
              origenSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
              setOrigenPulse(true)
              window.setTimeout(() => setOrigenPulse(false), 1600)
            })
          }
        }
      })()
    }, 380)

    return () => {
      cancelled = true
      window.clearTimeout(t)
    }
  }, [clienteNombre])

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      const el = nombreWrapRef.current
      if (!el?.contains(e.target as Node)) setNombreMenuOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const pickCliente = useCallback((c: ClienteRecord) => {
    const nom = [c.nombre, c.apellido].filter(Boolean).join(' ').trim()
    setClienteNombre(nom || c.nombre)
    setClienteDni(digitsOnly(c.dni_cuit || ''))
    setClienteTelefono(String(c.telefono ?? '').trim())
    setNombreSugerencias([])
    setNombreMenuOpen(false)
  }, [])

  const canSend = () => {
    if (!clienteNombre.trim()) return 'Ingresá tu nombre.'
    if (!dniDigits || dniDigits.length < 7) return 'Ingresá un DNI/CUIT válido.'
    if (!clienteTelefono.trim()) return 'Ingresá un teléfono.'
    if (!Number.isFinite(cantidadHojas) || cantidadHojas < 1) return 'Cantidad de hojas inválida.'
    if (!tipoImpresion.trim()) return 'Elegí tipo de impresión.'
    if (!origenArchivo) return 'Elegí origen del archivo.'
    if (!archivoNombre.trim()) return 'Ingresá el nombre del archivo.'

    if (origenArchivo === 'Drive') {
      const u = archivoUrl.trim()
      if (!u.startsWith('http://') && !u.startsWith('https://')) return 'Pegá un link válido de Drive (https…).'
    }
    if (origenArchivo === 'Pendrive') {
      if (!pendriveDataUrl?.trim()) return 'Seleccioná un archivo desde tu PC.'
    }
    if (origenArchivo === 'CelularQR') {
      const u = archivoUrl.trim()
      if (!u.startsWith('http://') && !u.startsWith('https://')) {
        return 'Escaneá el QR con el celular y subí el archivo para continuar.'
      }
    }
    if (origenArchivo === 'WhatsApp' || origenArchivo === 'Email') {
      if (!archivoUrl.trim()) return 'Falta información de contacto / enlace.'
    }
    return null
  }

  const handlePendriveFile = (file: File | null) => {
    setError(null)
    if (!file) {
      setPendriveDataUrl(null)
      return
    }
    if (file.size > MAX_PENDRIVE_BYTES) {
      setError(`El archivo supera ${MAX_PENDRIVE_BYTES / (1024 * 1024)} MB. Usá Drive o WhatsApp.`)
      if (pendriveInputRef.current) pendriveInputRef.current.value = ''
      setPendriveDataUrl(null)
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const r = reader.result
      if (typeof r === 'string') {
        setPendriveDataUrl(r)
        setArchivoNombre((prev) => prev.trim() || file.name)
      }
    }
    reader.onerror = () => setError('No se pudo leer el archivo.')
    reader.readAsDataURL(file)
  }

  const handleSend = async () => {
    setError(null)
    const v = canSend()
    if (v) {
      setError(v)
      return
    }
    const urlFinal =
      origenArchivo === 'Pendrive' ? (pendriveDataUrl ?? '').trim() : archivoUrl.trim()

    setStep('sending')
    try {
      const r = await apiService.crearSolicitudImpresionTotem({
        cliente_nombre: clienteNombre.trim(),
        cliente_dni: dniDigits,
        cliente_telefono: clienteTelefono.trim(),
        cantidad_hojas: Math.floor(cantidadHojas),
        tipo_impresion: tipoImpresion.trim(),
        origen_archivo: origenArchivo === 'CelularQR' ? 'Celular (QR)' : origenArchivo,
        archivo_url: urlFinal,
        archivo_nombre: archivoNombre.trim(),
        valor_total: Number.isFinite(Number(valorTotal)) ? Number(valorTotal) : null
      })
      if (!r.success || !r.data) {
        setStep('form')
        setError(r.error || 'No se pudo crear la solicitud.')
        return
      }
      setResult({ id: r.data.id, numeroVenta: r.data.numero_venta ?? null })
      setStep('done')
    } catch (e) {
      setStep('form')
      setError(e instanceof Error ? e.message : 'Error inesperado')
    }
  }

  const showDriveLink = origenArchivo === 'Drive'
  const showEmailBlock = origenArchivo === 'Email'
  const showWaBlock = origenArchivo === 'WhatsApp'
  const showPendriveBlock = origenArchivo === 'Pendrive'
  const showCelularQrBlock = origenArchivo === 'CelularQR'

  return (
    <TotemAutogestionKioskShell>
      <div className="totem-print-page">
        <header className="totem-print-header">
          <button type="button" className="totem-print-back" onClick={() => navigate('/totem/autogestion')}>
            ← Inicio
          </button>
          <div>
            <h1>Impresión (cola)</h1>
            <p>Dejá la solicitud. Por defecto: escaneá el QR con el celular para subir el archivo. Se paga en caja/mostrador.</p>
          </div>
        </header>

        <main className="totem-print-main">
          {step === 'form' && (
            <section className="totem-print-card">
              <div className="totem-print-grid">
                <label className="totem-print-span2">
                  Nombre
                  <div className="totem-print-nombreWrap" ref={nombreWrapRef}>
                    <input
                      value={clienteNombre}
                      onChange={(e) => setClienteNombre(e.target.value)}
                      onFocus={() => {
                        if (nombreSugerencias.length > 0) setNombreMenuOpen(true)
                      }}
                      autoComplete="off"
                      placeholder="Nombre y apellido (3+ letras: buscamos en clientes)"
                    />
                    {nombreLoading && clienteNombre.trim().length >= 3 && (
                      <div className="totem-print-nombreHint">Buscando en el sistema…</div>
                    )}
                    {nombreMenuOpen && nombreSugerencias.length > 0 && (
                      <ul className="totem-print-suggest" role="listbox">
                        {nombreSugerencias.map((c) => {
                          const line = [c.nombre, c.apellido].filter(Boolean).join(' ').trim()
                          const extra = [c.dni_cuit, c.telefono].filter(Boolean).join(' · ')
                          return (
                            <li key={c.id}>
                              <button type="button" className="totem-print-suggestBtn" onClick={() => pickCliente(c)}>
                                <span className="totem-print-suggestTitle">{line || c.nombre}</span>
                                {extra ? <span className="totem-print-suggestMeta">{extra}</span> : null}
                              </button>
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </div>
                </label>
                <label>
                  DNI/CUIT
                  <input inputMode="numeric" value={clienteDni} onChange={(e) => setClienteDni(e.target.value)} placeholder="Solo números" />
                </label>
                <label>
                  Teléfono
                  <input inputMode="tel" value={clienteTelefono} onChange={(e) => setClienteTelefono(e.target.value)} placeholder="Ej: 264..." />
                </label>
                <label>
                  Cantidad de hojas
                  <input
                    inputMode="numeric"
                    value={String(cantidadHojas)}
                    onChange={(e) => setCantidadHojas(Math.max(1, Math.min(999, Number(e.target.value || '1'))))}
                  />
                </label>
                <label>
                  Tipo de impresión
                  <select value={tipoImpresion} onChange={(e) => setTipoImpresion(e.target.value)}>
                    <option>A4 - Color</option>
                    <option>A4 - Blanco y negro</option>
                    <option>A3 - Color</option>
                    <option>A3 - Blanco y negro</option>
                  </select>
                </label>
                <div
                  className={`totem-print-span2 totem-print-origenBlock ${origenPulse ? 'totem-print-origenBlock--pulse' : ''}`}
                  ref={origenSectionRef}
                >
                  <label>
                    Origen del archivo
                    <select
                      value={origenArchivo}
                      onChange={(e) => setOrigenArchivo(e.target.value as OrigenArchivo)}
                      aria-label="Origen del archivo"
                    >
                      <option value="CelularQR">Celular (código QR)</option>
                      <option value="WhatsApp">WhatsApp</option>
                      <option value="Drive">Drive</option>
                      <option value="Email">Email</option>
                      <option value="Pendrive">Pendrive (archivo en esta PC)</option>
                    </select>
                  </label>
                  {showWaBlock && (
                    <div className="totem-print-origenPanel totem-print-origenPanel--wa">
                      <p className="totem-print-origenLead">Escaneá el código y envianos el archivo por WhatsApp.</p>
                      <div className="totem-print-waRow">
                        {waQrSrc ? (
                          <img className="totem-print-qr" src={waQrSrc} alt="Código QR WhatsApp Plot Center" width={220} height={220} />
                        ) : (
                          <div className="totem-print-qrFallback">Generando QR…</div>
                        )}
                        <div className="totem-print-waAside">
                          <p className="totem-print-waNum">
                            <strong>+54 9 2646 21-2163</strong>
                          </p>
                          <a className="totem-print-waLink" href={WA_CHAT_URL} target="_blank" rel="noopener noreferrer">
                            Abrir WhatsApp
                          </a>
                          <p className="totem-print-waHint">El enlace de la solicitud se guarda automáticamente para mostrador.</p>
                        </div>
                      </div>
                    </div>
                  )}
                  {showDriveLink && (
                    <label className="totem-print-origenPanel">
                      <span className="totem-print-origenLabel">Link de Google Drive</span>
                      <input
                        value={archivoUrl}
                        onChange={(e) => setArchivoUrl(e.target.value)}
                        placeholder="https://drive.google.com/…"
                      />
                    </label>
                  )}
                  {showEmailBlock && (
                    <div className="totem-print-origenPanel totem-print-origenPanel--email">
                      <p className="totem-print-origenLead">Enviá el archivo a:</p>
                      <p className="totem-print-emailAddr">
                        <a href={archivoUrl} className="totem-print-emailLink">
                          {TOTEM_PRINT_EMAIL}
                        </a>
                      </p>
                      <p className="totem-print-waHint">Usá el mismo correo que figura arriba en el asunto automático.</p>
                    </div>
                  )}
                  {showPendriveBlock && (
                    <div className="totem-print-origenPanel">
                      <label className="totem-print-fileLabel">
                        Archivo desde esta PC
                        <input
                          ref={pendriveInputRef}
                          type="file"
                          accept=".pdf,application/pdf,image/jpeg,image/png,image/webp"
                          className="totem-print-fileInput"
                          onChange={(e) => handlePendriveFile(e.target.files?.[0] ?? null)}
                        />
                      </label>
                      {pendriveDataUrl && <p className="totem-print-fileOk">Archivo cargado. Podés corregir el nombre abajo si hace falta.</p>}
                    </div>
                  )}
                  {showCelularQrBlock && (
                    <div className="totem-print-origenPanel totem-print-origenPanel--qr">
                      <p className="totem-print-origenLead">
                        Abrí la cámara del celular, escaneá el código y subí el PDF o la imagen en la página que se abre.
                      </p>
                      {qrSesionError ? (
                        <p className="totem-print-qrError">{qrSesionError}</p>
                      ) : (
                        <div className="totem-print-waRow">
                          {qrLinkSrc ? (
                            <img className="totem-print-qr" src={qrLinkSrc} alt="Código QR para subir archivo desde el celular" width={240} height={240} />
                          ) : (
                            <div className="totem-print-qrFallback">Generando código…</div>
                          )}
                          <div className="totem-print-waAside">
                            {archivoUrl.startsWith('http') ? (
                              <p className="totem-print-fileOk">Archivo recibido desde el celular.</p>
                            ) : (
                              <p className="totem-print-waHint">Esperando subida… La pantalla se actualiza sola.</p>
                            )}
                            {qrUploadPageUrl && (
                              <a className="totem-print-waLink totem-print-waLink--ghost" href={qrUploadPageUrl} target="_blank" rel="noopener noreferrer">
                                Abrir enlace en este equipo
                              </a>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <label className="totem-print-span2">
                  Nombre del archivo
                  <input value={archivoNombre} onChange={(e) => setArchivoNombre(e.target.value)} placeholder="Ej: cartel_frente.pdf" />
                </label>
                <label>
                  Valor estimado (opcional)
                  <input inputMode="decimal" value={valorTotal} onChange={(e) => setValorTotal(e.target.value)} placeholder="0" />
                </label>
              </div>

              {error && <div className="totem-print-error">{error}</div>}

              <div className="totem-print-actions">
                <button type="button" className="totem-print-primary" onClick={() => void handleSend()}>
                  Enviar solicitud
                </button>
              </div>
            </section>
          )}

          {step === 'sending' && (
            <section className="totem-print-card">
              <h2>Enviando…</h2>
              <p>Registrando solicitud de impresión.</p>
            </section>
          )}

          {step === 'done' && result && (
            <section className="totem-print-card totem-print-card--done">
              <h2>Listo</h2>
              <p className="totem-print-success">
                Solicitud creada: <strong>#{result.id}</strong>
              </p>
              <p className="totem-print-hint">Acercate a caja/mostrador para pagar y continuar.</p>
              <div className="totem-print-actions">
                <button type="button" className="totem-print-primary" onClick={() => navigate('/totem/autogestion')}>
                  Volver al inicio
                </button>
              </div>
            </section>
          )}
        </main>
      </div>
    </TotemAutogestionKioskShell>
  )
}
