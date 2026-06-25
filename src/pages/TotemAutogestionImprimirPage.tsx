import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import apiService from '../services/api'
import type { ClienteRecord } from '@/types/api'
import { TOTEM_PRINT_MAX_FILE_BYTES, TOTEM_PRINT_MAX_FILE_MB, TOTEM_PRINT_MAX_FILES } from '@/constants/totemPrint'
import {
  buildTotemArchivoManifest,
  parseTotemArchivoManifest,
  summarizeTotemArchivoNombres,
  type TotemArchivoItem
} from '@/utils/totemArchivoManifest'
import {
  buildTipoImpresionLabel,
  type PrintColorDetection,
  type PrintFormat
} from '@/utils/totemPrintDocument'
import TotemPrintPreviewMonitor from '../components/totem/TotemPrintPreviewMonitor'
import TotemMercadoPagoPayPanel from '../components/totem/TotemMercadoPagoPayPanel'
import type { TotemImpresionCheckoutDraft } from '../services/totemMpApi'
import './TotemAutogestionImprimirPage.css'

const digitsOnly = (s: string) => String(s ?? '').replace(/\D/g, '')

const TOTEM_PRINT_EMAIL = 'totem@plotcenter.com.ar'
const WA_CHAT_URL = 'https://wa.me/5492646212163'

type Step = 'form' | 'pay' | 'done'
type OrigenArchivo = 'WhatsApp' | 'Drive' | 'Email' | 'Pendrive' | 'CelularQR'

export default function TotemAutogestionImprimirPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>('form')
  const [error, setError] = useState<string | null>(null)

  const [clienteNombre, setClienteNombre] = useState('')
  const [clienteDni, setClienteDni] = useState('')
  const [clienteTelefono, setClienteTelefono] = useState('')
  const [cantidadHojas, setCantidadHojas] = useState(1)
  const [formatoImpresion, setFormatoImpresion] = useState<PrintFormat>('A4')
  const [tipoImpresion, setTipoImpresion] = useState('A4 - Color (detectado)')
  const [origenArchivo, setOrigenArchivo] = useState<OrigenArchivo>('CelularQR')
  const [archivoUrl, setArchivoUrl] = useState('')
  const [archivoNombre, setArchivoNombre] = useState('')
  const [archivosCargados, setArchivosCargados] = useState<TotemArchivoItem[]>([])
  const [valorTotal, setValorTotal] = useState<string>('')

  const [nombreSugerencias, setNombreSugerencias] = useState<ClienteRecord[]>([])
  const [nombreLoading, setNombreLoading] = useState(false)
  const [nombreMenuOpen, setNombreMenuOpen] = useState(false)

  const [pendriveArchivos, setPendriveArchivos] = useState<TotemArchivoItem[]>([])
  const [pendriveSubiendo, setPendriveSubiendo] = useState(false)
  const [waQrSrc, setWaQrSrc] = useState<string | null>(null)
  const [origenPulse, setOrigenPulse] = useState(false)

  const [qrUploadPageUrl, setQrUploadPageUrl] = useState<string | null>(null)
  const [qrLinkSrc, setQrLinkSrc] = useState<string | null>(null)
  const [qrSesionError, setQrSesionError] = useState<string | null>(null)
  const [qrSesionCompleta, setQrSesionCompleta] = useState(false)

  const nombreWrapRef = useRef<HTMLDivElement>(null)
  const origenSectionRef = useRef<HTMLDivElement>(null)
  const pendriveInputRef = useRef<HTMLInputElement>(null)
  const pollRef = useRef<number | null>(null)
  const lastEmptyScrollAt = useRef(0)
  const hojasEditadasManualRef = useRef(false)
  const lastAnalysisRef = useRef<{
    pageCount: number
    colorDetection: PrintColorDetection
    colorPages: number
    bwPages: number
  } | null>(null)

  const [hojasAutoDetectadas, setHojasAutoDetectadas] = useState(false)
  const [colorAutoDetectado, setColorAutoDetectado] = useState(false)

  const [result, setResult] = useState<{
    id: number
    numeroVenta?: string | null
    mpPaymentId?: string | null
    mpPreferenceId?: string | null
    valorTotal?: number | null
  } | null>(null)

  const [checkoutDraft, setCheckoutDraft] = useState<TotemImpresionCheckoutDraft | null>(null)

  const dniDigits = useMemo(() => digitsOnly(clienteDni), [clienteDni])

  const archivosActivos = useMemo(() => {
    if (origenArchivo === 'Pendrive') return pendriveArchivos
    if (origenArchivo === 'CelularQR' && archivosCargados.length > 0) return archivosCargados
    if (origenArchivo === 'Drive' && archivoUrl.trim()) {
      const u = archivoUrl.trim()
      if (u.startsWith('http')) return [{ url: u, nombre: archivoNombre || 'drive' }]
    }
    return []
  }, [origenArchivo, pendriveArchivos, archivosCargados, archivoUrl, archivoNombre])

  const previewSources = useMemo(
    () => archivosActivos.map((a) => ({ source: a.url, name: a.nombre })),
    [archivosActivos]
  )

  const applyArchivosFromManifest = useCallback((rawUrl: string, rawNombre?: string | null) => {
    const manifest = parseTotemArchivoManifest(rawUrl)
    if (manifest.files.length === 0) return
    setArchivoUrl(rawUrl)
    setArchivosCargados(manifest.files)
    setArchivoNombre(rawNombre?.trim() || summarizeTotemArchivoNombres(manifest.files))
  }, [])

  const handlePrintAnalysis = useCallback(
    (data: { pageCount: number; colorDetection: PrintColorDetection; colorPages: number; bwPages: number }) => {
      lastAnalysisRef.current = data
      if (!hojasEditadasManualRef.current) {
        setCantidadHojas(Math.max(1, Math.min(999, data.pageCount)))
        setHojasAutoDetectadas(true)
      }
      const tipo = buildTipoImpresionLabel(formatoImpresion, data.colorDetection, data.colorPages, data.bwPages)
      setTipoImpresion(tipo)
      setColorAutoDetectado(true)
    },
    [formatoImpresion]
  )

  useEffect(() => {
    const data = lastAnalysisRef.current
    if (!data || !colorAutoDetectado) return
    setTipoImpresion(buildTipoImpresionLabel(formatoImpresion, data.colorDetection, data.colorPages, data.bwPages))
  }, [formatoImpresion, colorAutoDetectado])

  useEffect(() => {
    hojasEditadasManualRef.current = false
    setHojasAutoDetectadas(false)
    setColorAutoDetectado(false)
    lastAnalysisRef.current = null
  }, [previewSources])

  useEffect(() => {
    if (!colorAutoDetectado) {
      setTipoImpresion(`${formatoImpresion} - Color (detectado)`)
    }
  }, [formatoImpresion, colorAutoDetectado])

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
    else if (origenArchivo === 'CelularQR') {
      setArchivoUrl('')
      setArchivosCargados([])
    }
  }, [origenArchivo])

  useEffect(() => {
    if (origenArchivo !== 'Pendrive') {
      setPendriveArchivos([])
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
    setArchivosCargados([])
    setArchivoUrl('')
    setQrSesionCompleta(false)

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

          if (d.archivos && d.archivos.length > 0 && d.archivo_url) {
            applyArchivosFromManifest(String(d.archivo_url), d.archivo_nombre)
          } else if (d.archivo_url) {
            applyArchivosFromManifest(String(d.archivo_url), d.archivo_nombre)
          }

          if (d.estado === 'completada' && d.archivo_url) {
            setQrSesionCompleta(true)
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
  }, [origenArchivo, applyArchivosFromManifest])

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
    const valorNum = Number(valorTotal)
    if (!Number.isFinite(valorNum) || valorNum < 1) {
      return 'Indicá el valor estimado (mínimo $1) para cobrar con Mercado Pago.'
    }
    if (!tipoImpresion.trim()) return 'Esperá el análisis del archivo o subí un documento.'
    if (!origenArchivo) return 'Elegí origen del archivo.'
    if (!archivoNombre.trim()) return 'Ingresá el nombre del archivo.'

    if (origenArchivo === 'Drive') {
      const u = archivoUrl.trim()
      if (!u.startsWith('http://') && !u.startsWith('https://')) return 'Pegá un link válido de Drive (https…).'
    }
    if (origenArchivo === 'Pendrive') {
      if (pendriveArchivos.length === 0) return 'Seleccioná uno o más archivos desde tu PC.'
      if (pendriveSubiendo) return 'Esperá a que terminen de subirse los archivos.'
    }
    if (origenArchivo === 'CelularQR') {
      if (!qrSesionCompleta || archivosCargados.length === 0) {
        return 'Escaneá el QR con el celular y subí el archivo para continuar.'
      }
    }
    if (origenArchivo === 'WhatsApp' || origenArchivo === 'Email') {
      return 'Para pagar con Mercado Pago en el tótem, subí el archivo por celular (QR) o desde esta PC.'
    }
    if (origenArchivo === 'Drive') {
      return 'Para pagar con Mercado Pago en el tótem, subí el archivo por celular (QR) o desde esta PC.'
    }
    return null
  }

  const buildCheckoutDraft = (): TotemImpresionCheckoutDraft | null => {
    let urlFinal = archivoUrl.trim()
    let nombreFinal = archivoNombre.trim()

    if (origenArchivo === 'Pendrive') {
      urlFinal = buildTotemArchivoManifest(pendriveArchivos)
      nombreFinal = summarizeTotemArchivoNombres(pendriveArchivos)
    } else if (origenArchivo === 'CelularQR') {
      urlFinal = buildTotemArchivoManifest(archivosCargados)
      nombreFinal = summarizeTotemArchivoNombres(archivosCargados)
    }

    if (!urlFinal) return null

    return {
      cliente_nombre: clienteNombre.trim(),
      cliente_dni: dniDigits,
      cliente_telefono: clienteTelefono.trim(),
      cantidad_hojas: Math.floor(cantidadHojas),
      tipo_impresion: tipoImpresion.trim(),
      origen_archivo: origenArchivo === 'CelularQR' ? 'Celular (QR)' : origenArchivo,
      archivo_url: urlFinal,
      archivo_nombre: nombreFinal,
      valor_total: Number(valorTotal)
    }
  }

  const handlePay = () => {
    setError(null)
    const v = canSend()
    if (v) {
      setError(v)
      return
    }
    const draft = buildCheckoutDraft()
    if (!draft) {
      setError('No se pudo preparar el archivo para el pago.')
      return
    }
    setCheckoutDraft(draft)
    setStep('pay')
  }

  const handlePendriveFiles = (list: FileList | null) => {
    setError(null)
    if (!list?.length) {
      setPendriveArchivos([])
      return
    }
    const files = Array.from(list)
    if (files.length > TOTEM_PRINT_MAX_FILES) {
      setError(`Máximo ${TOTEM_PRINT_MAX_FILES} archivos por solicitud.`)
      if (pendriveInputRef.current) pendriveInputRef.current.value = ''
      return
    }
    const tooBig = files.find((f) => f.size > TOTEM_PRINT_MAX_FILE_BYTES)
    if (tooBig) {
      setError(`"${tooBig.name}" supera ${TOTEM_PRINT_MAX_FILE_MB} MB.`)
      if (pendriveInputRef.current) pendriveInputRef.current.value = ''
      setPendriveArchivos([])
      return
    }

    setPendriveSubiendo(true)
    void (async () => {
      const uploaded: TotemArchivoItem[] = []
      for (const file of files) {
        const r = await apiService.subirArchivoTotemImpresion(file)
        if (!r.success || !r.data?.url) {
          setError(r.error || `No se pudo subir "${file.name}".`)
          setPendriveArchivos(uploaded)
          setPendriveSubiendo(false)
          return
        }
        uploaded.push({ url: r.data.url, nombre: file.name, bytes: file.size })
      }
      setPendriveArchivos(uploaded)
      setArchivoNombre(summarizeTotemArchivoNombres(uploaded))
      setPendriveSubiendo(false)
    })()
  }

  const showDriveLink = origenArchivo === 'Drive'
  const showEmailBlock = origenArchivo === 'Email'
  const showWaBlock = origenArchivo === 'WhatsApp'
  const showPendriveBlock = origenArchivo === 'Pendrive'
  const showCelularQrBlock = origenArchivo === 'CelularQR'

  return (
      <div className="totem-print-page">
        <header className="totem-print-header">
          <button type="button" className="totem-print-back" onClick={() => navigate('/totem/consulta-cliente')}>
            ← Inicio
          </button>
          <div>
            <h1>Impresión (cola)</h1>
            <p>Subí el archivo, pagá con Mercado Pago y enviamos el trabajo a la cola de impresión.</p>
          </div>
        </header>

        <main className="totem-print-main">
          {step === 'form' && (
            <section className="totem-print-card">
              <div className="totem-print-body">
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
                    onChange={(e) => {
                      hojasEditadasManualRef.current = true
                      setHojasAutoDetectadas(false)
                      setCantidadHojas(Math.max(1, Math.min(999, Number(e.target.value || '1'))))
                    }}
                  />
                  {hojasAutoDetectadas && (
                    <span className="totem-print-hojasHint">Detectado automáticamente del archivo</span>
                  )}
                </label>
                <label>
                  Formato
                  <select value={formatoImpresion} onChange={(e) => setFormatoImpresion(e.target.value as PrintFormat)}>
                    <option value="A4">A4</option>
                    <option value="A3">A3</option>
                  </select>
                </label>
                <label className="totem-print-span2 totem-print-readonlyField">
                  Color / blanco y negro
                  <div className="totem-print-detectedTipo">{tipoImpresion}</div>
                  <span className="totem-print-hojasHint">Se detecta automáticamente al subir el archivo</span>
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
                        Archivos desde esta PC (hasta {TOTEM_PRINT_MAX_FILES}, máx. {TOTEM_PRINT_MAX_FILE_MB} MB c/u)
                        <input
                          ref={pendriveInputRef}
                          type="file"
                          multiple
                          accept=".pdf,application/pdf,image/jpeg,image/png,image/webp,image/heic,.heic"
                          className="totem-print-fileInput"
                          onChange={(e) => handlePendriveFiles(e.target.files)}
                        />
                      </label>
                      {pendriveSubiendo && <p className="totem-print-waHint">Subiendo archivos…</p>}
                      {pendriveArchivos.length > 0 && !pendriveSubiendo && (
                        <p className="totem-print-fileOk">
                          {pendriveArchivos.length} archivo(s) listos: {pendriveArchivos.map((f) => f.nombre).join(', ')}
                        </p>
                      )}
                    </div>
                  )}
                  {showCelularQrBlock && (
                    <div className="totem-print-origenPanel totem-print-origenPanel--qr">
                      <p className="totem-print-origenLead">
                        Abrí la cámara del celular, escaneá el código y subí uno o más PDF o imágenes en la página que se abre.
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
                            {qrSesionCompleta && archivosCargados.length > 0 ? (
                              <p className="totem-print-fileOk">
                                {archivosCargados.length} archivo(s) recibido(s) desde el celular.
                              </p>
                            ) : archivosCargados.length > 0 ? (
                              <p className="totem-print-waHint">Recibiendo archivos… confirmá en el celular.</p>
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
                  Valor a cobrar
                  <input inputMode="decimal" value={valorTotal} onChange={(e) => setValorTotal(e.target.value)} placeholder="Ej: 1500" />
                  <span className="totem-print-hojasHint">Mínimo $1 — necesario para Mercado Pago</span>
                </label>
              </div>

              <aside className="totem-print-previewAside">
                <TotemPrintPreviewMonitor
                  sources={previewSources}
                  formatoImpresion={formatoImpresion}
                  onAnalysis={handlePrintAnalysis}
                />
              </aside>
              </div>

              {error && <div className="totem-print-error">{error}</div>}

              <div className="totem-print-actions">
                <button type="button" className="totem-print-primary" onClick={handlePay}>
                  Pagar y enviar
                </button>
              </div>
            </section>
          )}

          {step === 'pay' && checkoutDraft && (
            <section className="totem-print-card">
              <button
                type="button"
                className="totem-print-back totem-print-back--inline"
                onClick={() => {
                  setStep('form')
                  setCheckoutDraft(null)
                }}
              >
                ← Volver
              </button>
              <TotemMercadoPagoPayPanel
                draft={checkoutDraft}
                onPaid={({ solicitudId, mpPaymentId, mpPreferenceId }) => {
                  setResult({
                    id: solicitudId,
                    mpPaymentId,
                    mpPreferenceId,
                    valorTotal: checkoutDraft.valor_total ?? null
                  })
                  setStep('done')
                }}
              />
            </section>
          )}

          {step === 'done' && result && (
            <section className="totem-print-card totem-print-card--done">
              <h2>Pago confirmado</h2>
              <p className="totem-print-success">
                Solicitud enviada a impresión: <strong>#{result.id}</strong>
              </p>
              {result.mpPaymentId ? (
                <p className="totem-print-hint">
                  Mercado Pago — Pago: <strong>{result.mpPaymentId}</strong>
                </p>
              ) : null}
              <p className="totem-print-hint">Ya podés retirar cuando esté impreso.</p>
              <div className="totem-print-actions">
                <button type="button" className="totem-print-primary" onClick={() => navigate('/totem/autogestion')}>
                  Volver al inicio
                </button>
              </div>
            </section>
          )}
        </main>
      </div>
  )
}
