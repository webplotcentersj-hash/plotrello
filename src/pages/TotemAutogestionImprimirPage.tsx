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
  resolveTotemPrintColorQuote,
  type PrintColorDetection,
  type PrintFormat,
  type PrintPagePreview,
  type TotemPrintColorModo,
  type TotemPrintFaz
} from '@/utils/totemPrintDocument'
import {
  TOTEM_PRINT_PAPEL_DEFAULT,
  gruposTotemPrintPapel,
  isTotemPrintPapelId,
  type TotemPrintPapelId
} from '@/utils/totemPrintPapel'
import {
  allPagesRange,
  buildJobsPayload,
  formatHojasResumen,
  jobLabelCorto,
  normalizeCopias,
  quoteForJob,
  summarizeJobsTipoImpresion,
  syncTotemPrintJobs,
  togglePageInList,
  totalHojasSeleccionadas,
  type TotemPrintJobSpec
} from '@/utils/totemPrintJobs'
import {
  cotizarImpresionTotem,
  formatTotemPrintArs,
  type TotemPrintQuote
} from '../services/totemPrintPricingService'
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
  const [tipoPapel, setTipoPapel] = useState<TotemPrintPapelId>(TOTEM_PRINT_PAPEL_DEFAULT)
  const [fazImpresion, setFazImpresion] = useState<TotemPrintFaz>('simple')
  const [modoColor, setModoColor] = useState<TotemPrintColorModo>('auto')
  const [printJobs, setPrintJobs] = useState<TotemPrintJobSpec[]>([])
  const [activeJobIndex, setActiveJobIndex] = useState(0)
  const [origenArchivo, setOrigenArchivo] = useState<OrigenArchivo>('CelularQR')
  const [archivoUrl, setArchivoUrl] = useState('')
  const [archivoNombre, setArchivoNombre] = useState('')
  const [descripcionImpresion, setDescripcionImpresion] = useState('')
  const [archivosCargados, setArchivosCargados] = useState<TotemArchivoItem[]>([])
  const [printQuote, setPrintQuote] = useState<TotemPrintQuote | null>(null)
  const [printQuoteLoading, setPrintQuoteLoading] = useState(false)
  const [printQuoteError, setPrintQuoteError] = useState<string | null>(null)

  const [nombreSugerencias, setNombreSugerencias] = useState<ClienteRecord[]>([])
  const [nombreLoading, setNombreLoading] = useState(false)
  const [nombreMenuOpen, setNombreMenuOpen] = useState(false)
  const [dniLoading, setDniLoading] = useState(false)
  const [clienteId, setClienteId] = useState<number | null>(null)

  const [pendriveArchivos, setPendriveArchivos] = useState<TotemArchivoItem[]>([])
  const [pendriveSubiendo, setPendriveSubiendo] = useState(false)
  const [driveLinkDraft, setDriveLinkDraft] = useState('')
  const [driveArchivos, setDriveArchivos] = useState<TotemArchivoItem[]>([])
  const [waQrSrc, setWaQrSrc] = useState<string | null>(null)
  const [origenPulse, setOrigenPulse] = useState(false)

  const [qrUploadPageUrl, setQrUploadPageUrl] = useState<string | null>(null)
  const [qrLinkSrc, setQrLinkSrc] = useState<string | null>(null)
  const [qrSesionError, setQrSesionError] = useState<string | null>(null)
  const [qrSesionCompleta, setQrSesionCompleta] = useState(false)
  const [qrSessionNonce, setQrSessionNonce] = useState(0)

  const nombreWrapRef = useRef<HTMLDivElement>(null)
  const origenSectionRef = useRef<HTMLDivElement>(null)
  const pendriveInputRef = useRef<HTMLInputElement>(null)
  const pollRef = useRef<number | null>(null)
  const lastEmptyScrollAt = useRef(0)
  const hojasEditadasManualRef = useRef(false)
  const qrArchivosAcumuladosRef = useRef<TotemArchivoItem[]>([])
  const lastAnalysisRef = useRef<{
    pageCount: number
    colorDetection: PrintColorDetection
    colorPages: number
    bwPages: number
    pageCountsBySource: number[]
    previews: PrintPagePreview[]
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
    if (origenArchivo === 'Drive') return driveArchivos
    return []
  }, [origenArchivo, pendriveArchivos, archivosCargados, driveArchivos])

  const previewSources = useMemo(
    () => archivosActivos.map((a) => ({ source: a.url, name: a.nombre })),
    [archivosActivos]
  )

  const jobDefaults = useMemo(
    () => ({
      formato: formatoImpresion,
      papel: tipoPapel,
      faz: fazImpresion,
      modoColor
    }),
    [formatoImpresion, tipoPapel, fazImpresion, modoColor]
  )
  const jobDefaultsRef = useRef(jobDefaults)
  jobDefaultsRef.current = jobDefaults

  useEffect(() => {
    setPrintJobs((prev) => syncTotemPrintJobs(archivosActivos, prev, jobDefaultsRef.current))
    setActiveJobIndex((i) => (archivosActivos.length === 0 ? 0 : Math.min(i, archivosActivos.length - 1)))
  }, [archivosActivos])

  const activeJob = printJobs[activeJobIndex] ?? null

  useEffect(() => {
    if (!activeJob) return
    setFormatoImpresion(activeJob.formato)
    setTipoPapel(activeJob.papel)
    setFazImpresion(activeJob.faz)
    setModoColor(activeJob.modoColor)
    // Solo al cambiar de archivo activo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeJob?.key])

  const patchActiveJob = useCallback(
    (patch: Partial<TotemPrintJobSpec>) => {
      setPrintJobs((prev) => {
        if (prev.length === 0) return prev
        const idx = Math.min(activeJobIndex, prev.length - 1)
        return prev.map((j, i) => (i === idx ? { ...j, ...patch } : j))
      })
    },
    [activeJobIndex]
  )

  const hojasTotalesSeleccionadas = useMemo(() => totalHojasSeleccionadas(printJobs), [printJobs])

  useEffect(() => {
    if (printJobs.length > 0) {
      setCantidadHojas(Math.max(1, hojasTotalesSeleccionadas || 1))
    }
  }, [printJobs, hojasTotalesSeleccionadas])

  const tieneArchivoSeleccionado = useMemo(() => {
    if (origenArchivo === 'Pendrive') return pendriveArchivos.length > 0
    if (origenArchivo === 'CelularQR') return archivosCargados.length > 0 || qrSesionCompleta
    if (origenArchivo === 'Drive') return driveArchivos.length > 0
    return archivoNombre.trim().length > 0 || archivosActivos.length > 0
  }, [
    origenArchivo,
    pendriveArchivos,
    archivosCargados,
    qrSesionCompleta,
    driveArchivos,
    archivoNombre,
    archivosActivos
  ])

  const tieneDatosCliente =
    clienteId != null ||
    clienteNombre.trim().length > 0 ||
    clienteDni.trim().length > 0 ||
    clienteTelefono.trim().length > 0

  const limpiarSeleccionArchivo = useCallback(() => {
    setError(null)
    if (pollRef.current != null) {
      window.clearInterval(pollRef.current)
      pollRef.current = null
    }
    setArchivosCargados([])
    setPendriveArchivos([])
    setDriveArchivos([])
    setDriveLinkDraft('')
    qrArchivosAcumuladosRef.current = []
    setArchivoNombre('')
    setQrSesionCompleta(false)
    setPrintJobs([])
    setActiveJobIndex(0)
    hojasEditadasManualRef.current = false
    setCantidadHojas(1)
    setModoColor('auto')
    setHojasAutoDetectadas(false)
    setColorAutoDetectado(false)
    lastAnalysisRef.current = null
    setPrintQuote(null)
    setPrintQuoteError(null)
    if (pendriveInputRef.current) pendriveInputRef.current.value = ''
    if (origenArchivo === 'Drive') {
      setArchivoUrl('')
    } else if (origenArchivo === 'CelularQR') {
      setQrSessionNonce((n) => n + 1)
    } else if (origenArchivo === 'Pendrive') {
      setArchivoUrl('')
    }
  }, [origenArchivo])

  const limpiarDatosCliente = useCallback(() => {
    setClienteId(null)
    setClienteNombre('')
    setClienteDni('')
    setClienteTelefono('')
    setNombreSugerencias([])
    setNombreMenuOpen(false)
  }, [])

  const applyArchivosFromManifest = useCallback((rawUrl: string, rawNombre?: string | null) => {
    const manifest = parseTotemArchivoManifest(rawUrl)
    if (manifest.files.length === 0) return
    setArchivoUrl(rawUrl)
    setArchivosCargados(manifest.files)
    setArchivoNombre(rawNombre?.trim() || summarizeTotemArchivoNombres(manifest.files))
  }, [])

  const colorQuote = useMemo(() => {
    if (printJobs.length > 0) {
      const tipo = summarizeJobsTipoImpresion(printJobs)
      let color_pages = 0
      let bw_pages = 0
      for (const job of printJobs) {
        const q = quoteForJob(job)
        color_pages += q.color_pages
        bw_pages += q.bw_pages
      }
      return { tipo_impresion: tipo, color_pages, bw_pages }
    }
    return resolveTotemPrintColorQuote({
      formato: formatoImpresion,
      modoColor,
      cantidadHojas,
      papel: tipoPapel,
      faz: fazImpresion,
      analysis: lastAnalysisRef.current
    })
  }, [
    printJobs,
    formatoImpresion,
    modoColor,
    cantidadHojas,
    tipoPapel,
    fazImpresion,
    colorAutoDetectado,
    hojasAutoDetectadas,
    hojasTotalesSeleccionadas
  ])

  const handlePrintAnalysis = useCallback(
    (data: {
      pageCount: number
      colorDetection: PrintColorDetection
      colorPages: number
      bwPages: number
      pageCountsBySource: number[]
      previews: PrintPagePreview[]
    }) => {
      lastAnalysisRef.current = data
      setPrintJobs((prev) =>
        prev.map((job, index) => {
          const filePages = data.pageCountsBySource[index] ?? job.pageCount
          const filePreviews = data.previews.filter((p) => p.sourceIndex === index)
          const colorPagesDetected = filePreviews.filter((p) => p.color === 'color').length
          const bwPagesDetected = filePreviews.filter((p) => p.color === 'bw').length
          const colorDetection: PrintColorDetection =
            colorPagesDetected > 0 && bwPagesDetected > 0
              ? 'mixed'
              : colorPagesDetected > 0
                ? 'color'
                : 'bw'
          const shouldInitPages = job.pageCount === 0 || job.hojasSeleccionadas.length === 0
          return {
            ...job,
            pageCount: Math.max(filePages, job.pageCount),
            colorDetection,
            colorPagesDetected,
            bwPagesDetected,
            hojasSeleccionadas: shouldInitPages
              ? allPagesRange(Math.max(filePages, 1))
              : job.hojasSeleccionadas.filter((p) => p <= Math.max(filePages, 1))
          }
        })
      )
      if (!hojasEditadasManualRef.current) {
        setCantidadHojas(Math.max(1, Math.min(999, data.pageCount)))
        setHojasAutoDetectadas(true)
      }
      setColorAutoDetectado(true)
    },
    []
  )

  useEffect(() => {
    hojasEditadasManualRef.current = false
    setHojasAutoDetectadas(false)
    setColorAutoDetectado(false)
    lastAnalysisRef.current = null
  }, [previewSources])

  useEffect(() => {
    if (!colorQuote.tipo_impresion.trim() || (printJobs.length > 0 ? hojasTotalesSeleccionadas < 1 : cantidadHojas < 1)) {
      setPrintQuote(null)
      setPrintQuoteError(printJobs.length > 0 && hojasTotalesSeleccionadas < 1 ? 'Seleccioná al menos una hoja para imprimir.' : null)
      return
    }

    let cancelled = false
    setPrintQuoteLoading(true)
    setPrintQuoteError(null)

    const t = window.setTimeout(() => {
      void (async () => {
        if (printJobs.length > 0) {
          const activeJobs = printJobs.filter((j) => j.hojasSeleccionadas.length > 0)
          const items: TotemPrintQuote['items'] = []
          let total = 0
          for (const job of activeJobs) {
            const q = quoteForJob(job)
            const r = await cotizarImpresionTotem({
              formato: job.formato,
              tipo_impresion: q.tipo_impresion,
              cantidad_hojas: q.cantidad_hojas,
              color_pages: q.color_pages,
              bw_pages: q.bw_pages,
              papel: job.papel,
              faz: job.faz
            })
            if (cancelled) return
            if (!r.ok || !r.quote) {
              setPrintQuote(null)
              setPrintQuoteError(r.error || `No se pudo cotizar «${job.nombre}».`)
              setPrintQuoteLoading(false)
              return
            }
            for (const line of r.quote.items) {
              items.push({
                ...line,
                descripcion: `${job.nombre}: ${line.descripcion}`
              })
            }
            total += r.quote.total
          }
          if (cancelled) return
          setPrintQuote({ total, items, lista: 'lista_1' })
          setPrintQuoteError(null)
          setPrintQuoteLoading(false)
          return
        }

        const r = await cotizarImpresionTotem({
          formato: formatoImpresion,
          tipo_impresion: colorQuote.tipo_impresion,
          cantidad_hojas: cantidadHojas,
          color_pages: colorQuote.color_pages,
          bw_pages: colorQuote.bw_pages,
          papel: tipoPapel,
          faz: fazImpresion
        })
        if (cancelled) return
        setPrintQuoteLoading(false)
        if (!r.ok || !r.quote) {
          setPrintQuote(null)
          setPrintQuoteError(r.error || 'No se pudo calcular el precio.')
          return
        }
        setPrintQuote(r.quote)
        setPrintQuoteError(null)
      })()
    }, 320)

    return () => {
      cancelled = true
      window.clearTimeout(t)
    }
  }, [
    printJobs,
    hojasTotalesSeleccionadas,
    formatoImpresion,
    tipoPapel,
    fazImpresion,
    modoColor,
    cantidadHojas,
    colorQuote,
    colorAutoDetectado,
    hojasAutoDetectadas
  ])

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
    if (origenArchivo !== 'Drive') {
      setDriveArchivos([])
      setDriveLinkDraft('')
    }
    if (origenArchivo !== 'CelularQR') {
      qrArchivosAcumuladosRef.current = []
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
    // No vaciar archivos ya recibidos: permite “agregar más” con un QR nuevo.
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

          if (d.estado === 'completada' && d.archivo_url) {
            const nuevos = parseTotemArchivoManifest(String(d.archivo_url)).files
            const prev = qrArchivosAcumuladosRef.current
            const merged = [...prev]
            for (const f of nuevos) {
              if (!merged.some((x) => x.url === f.url)) merged.push(f)
            }
            if (merged.length > TOTEM_PRINT_MAX_FILES) {
              setError(`Máximo ${TOTEM_PRINT_MAX_FILES} archivos. Se guardaron los primeros.`)
              merged.splice(TOTEM_PRINT_MAX_FILES)
            }
            qrArchivosAcumuladosRef.current = merged
            setArchivosCargados(merged)
            setArchivoUrl(buildTotemArchivoManifest(merged))
            setArchivoNombre(
              d.archivo_nombre?.trim() && prev.length === 0
                ? String(d.archivo_nombre)
                : summarizeTotemArchivoNombres(merged)
            )
            setQrSesionCompleta(true)
            if (pollRef.current != null) {
              window.clearInterval(pollRef.current)
              pollRef.current = null
            }
          } else if (d.archivos && d.archivos.length > 0 && d.archivo_url) {
            applyArchivosFromManifest(String(d.archivo_url), d.archivo_nombre)
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
  }, [origenArchivo, applyArchivosFromManifest, qrSessionNonce])

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

  const applyClienteDetectado = useCallback((c: ClienteRecord) => {
    const nom = [c.nombre, c.apellido].filter(Boolean).join(' ').trim()
    setClienteId(c.id)
    if (nom) setClienteNombre(nom)
    const dni = digitsOnly(c.dni_cuit || '')
    if (dni) setClienteDni(dni)
    const tel = String(c.telefono ?? '').trim()
    if (tel) setClienteTelefono(tel)
    setNombreSugerencias([])
    setNombreMenuOpen(false)
  }, [])

  const pickCliente = useCallback(
    (c: ClienteRecord) => {
      applyClienteDetectado(c)
    },
    [applyClienteDetectado]
  )

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

        const lista = res.data
        const unico = lista.length === 1 ? lista[0]! : null
        if (unico) {
          const linea = [unico.nombre, unico.apellido].filter(Boolean).join(' ').trim()
          const dniUnico = digitsOnly(unico.dni_cuit ?? '')
          const coincideDni = dniDigits.length >= 7 && dniUnico === dniDigits
          const coincideNombre = linea.toLowerCase() === q.toLowerCase()
          if (coincideDni || coincideNombre) {
            applyClienteDetectado(unico)
            return
          }
        }

        setNombreSugerencias(lista)
        setNombreMenuOpen(lista.length > 0)

        if (lista.length === 0) {
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
  }, [clienteNombre, dniDigits, applyClienteDetectado])

  useEffect(() => {
    if (dniDigits.length < 7) {
      setDniLoading(false)
      if (dniDigits.length === 0) setClienteId(null)
      return
    }

    let cancelled = false
    setDniLoading(true)
    const t = window.setTimeout(() => {
      void (async () => {
        const res = await apiService.buscarClientes(dniDigits)
        if (cancelled) return
        setDniLoading(false)
        if (!res.success || !res.data) {
          setClienteId(null)
          return
        }
        const match = res.data.find((c) => digitsOnly(c.dni_cuit ?? '') === dniDigits)
        if (match) {
          applyClienteDetectado(match)
          return
        }
        setClienteId(null)
      })()
    }, 420)

    return () => {
      cancelled = true
      window.clearTimeout(t)
    }
  }, [dniDigits, applyClienteDetectado])

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      const el = nombreWrapRef.current
      if (!el?.contains(e.target as Node)) setNombreMenuOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const canSend = () => {
    if (!clienteNombre.trim()) return 'Ingresá tu nombre.'
    if (!dniDigits || dniDigits.length < 7) return 'Ingresá un DNI/CUIT válido.'
    if (!clienteTelefono.trim()) return 'Ingresá un teléfono.'
    if (!Number.isFinite(cantidadHojas) || cantidadHojas < 1) return 'Cantidad de hojas inválida.'
    if (printJobs.length > 0 && hojasTotalesSeleccionadas < 1) {
      return 'Seleccioná al menos una hoja para imprimir en el monitor.'
    }
    if (printQuoteLoading) return 'Calculando precio de Lista 1…'
    if (!printQuote || printQuote.total < 1) {
      return printQuoteError || 'Esperá el cálculo del precio según Lista 1.'
    }
    if (!colorQuote.tipo_impresion.trim()) return 'Indicá el tipo de impresión (color o B/N).'
    if (!origenArchivo) return 'Elegí origen del archivo.'
    if (!archivoNombre.trim()) return 'Ingresá el nombre del archivo.'

    if (origenArchivo === 'Drive') {
      const u = archivoUrl.trim()
      if (driveArchivos.length === 0 && !u.startsWith('http')) {
        return 'Agregá al menos un link de Drive.'
      }
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
    } else if (origenArchivo === 'Drive') {
      urlFinal = buildTotemArchivoManifest(driveArchivos)
      nombreFinal = summarizeTotemArchivoNombres(driveArchivos)
    }

    if (!urlFinal) return null

    const notas = descripcionImpresion.trim()
    const tipoBase = colorQuote.tipo_impresion.trim()
    const tipoConNotas = notas ? `${tipoBase} | Notas: ${notas}` : tipoBase
    const jobsPayload = printJobs.length > 0 ? buildJobsPayload(printJobs) : undefined
    const primaryJob = jobsPayload?.[0]

    return {
      cliente_nombre: clienteNombre.trim(),
      cliente_dni: dniDigits,
      cliente_telefono: clienteTelefono.trim(),
      cantidad_hojas: Math.max(1, Math.floor(hojasTotalesSeleccionadas || cantidadHojas)),
      tipo_impresion: tipoConNotas,
      origen_archivo: origenArchivo === 'CelularQR' ? 'Celular (QR)' : origenArchivo,
      archivo_url: urlFinal,
      archivo_nombre: nombreFinal,
      valor_total: printQuote?.total ?? 0,
      formato_impresion: primaryJob?.formato || formatoImpresion,
      papel_impresion: primaryJob?.papel || tipoPapel,
      faz_impresion: primaryJob?.faz || fazImpresion,
      modo_color: primaryJob?.modo_color || modoColor,
      color_pages: colorQuote.color_pages,
      bw_pages: colorQuote.bw_pages,
      descripcion: notas || undefined,
      jobs: jobsPayload
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
      if (pendriveInputRef.current) pendriveInputRef.current.value = ''
      return
    }
    const incoming = Array.from(list)
    const cupo = TOTEM_PRINT_MAX_FILES - pendriveArchivos.length
    if (cupo <= 0) {
      setError(`Ya tenés el máximo de ${TOTEM_PRINT_MAX_FILES} archivos.`)
      if (pendriveInputRef.current) pendriveInputRef.current.value = ''
      return
    }
    if (incoming.length > cupo) {
      setError(`Solo podés agregar ${cupo} archivo(s) más (máx. ${TOTEM_PRINT_MAX_FILES}).`)
    }
    const files = incoming.slice(0, Math.max(0, cupo))
    const tooBig = files.find((f) => f.size > TOTEM_PRINT_MAX_FILE_BYTES)
    if (tooBig) {
      setError(`"${tooBig.name}" supera ${TOTEM_PRINT_MAX_FILE_MB} MB.`)
      if (pendriveInputRef.current) pendriveInputRef.current.value = ''
      return
    }

    setPendriveSubiendo(true)
    void (async () => {
      const uploaded: TotemArchivoItem[] = [...pendriveArchivos]
      for (const file of files) {
        const r = await apiService.subirArchivoTotemImpresion(file)
        if (!r.success || !r.data?.url) {
          setError(r.error || `No se pudo subir "${file.name}".`)
          setPendriveArchivos(uploaded)
          setArchivoNombre(summarizeTotemArchivoNombres(uploaded))
          setPendriveSubiendo(false)
          if (pendriveInputRef.current) pendriveInputRef.current.value = ''
          return
        }
        uploaded.push({ url: r.data.url, nombre: file.name, bytes: file.size })
      }
      setPendriveArchivos(uploaded)
      setArchivoNombre(summarizeTotemArchivoNombres(uploaded))
      setPendriveSubiendo(false)
      if (pendriveInputRef.current) pendriveInputRef.current.value = ''
    })()
  }

  const quitarPendriveArchivo = (idx: number) => {
    setPendriveArchivos((prev) => {
      const next = prev.filter((_, i) => i !== idx)
      setArchivoNombre(summarizeTotemArchivoNombres(next))
      return next
    })
    setError(null)
  }

  const agregarDriveLink = () => {
    const u = driveLinkDraft.trim()
    if (!u.startsWith('http://') && !u.startsWith('https://')) {
      setError('Pegá un link válido de Drive (https…).')
      return
    }
    if (driveArchivos.length >= TOTEM_PRINT_MAX_FILES) {
      setError(`Máximo ${TOTEM_PRINT_MAX_FILES} links.`)
      return
    }
    if (driveArchivos.some((f) => f.url === u)) {
      setError('Ese link ya está en la lista.')
      return
    }
    setError(null)
    const next = [...driveArchivos, { url: u, nombre: `Drive ${driveArchivos.length + 1}` }]
    setDriveArchivos(next)
    setArchivoUrl(buildTotemArchivoManifest(next))
    setArchivoNombre(summarizeTotemArchivoNombres(next))
    setDriveLinkDraft('')
  }

  const quitarDriveArchivo = (idx: number) => {
    setDriveArchivos((prev) => {
      const next = prev.filter((_, i) => i !== idx)
      setArchivoUrl(buildTotemArchivoManifest(next))
      setArchivoNombre(summarizeTotemArchivoNombres(next))
      return next
    })
    setError(null)
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
                      onChange={(e) => {
                        setClienteNombre(e.target.value)
                        setClienteId(null)
                      }}
                      onFocus={() => {
                        if (nombreSugerencias.length > 0) setNombreMenuOpen(true)
                      }}
                      autoComplete="off"
                      placeholder="Nombre y apellido (buscamos en clientes)"
                      className={clienteId != null ? 'totem-print-input--matched' : undefined}
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
                {clienteId != null && (
                  <div className="totem-print-span2 totem-print-clienteOk" role="status">
                    <span className="totem-print-clienteOk__icon" aria-hidden>
                      ✓
                    </span>
                    <span>
                      <strong>Cliente registrado</strong> — completamos nombre, DNI y teléfono automáticamente.
                    </span>
                  </div>
                )}
                {tieneDatosCliente && (
                  <div className="totem-print-span2 totem-print-clearRow">
                    <button type="button" className="totem-print-clearBtn" onClick={limpiarDatosCliente}>
                      Borrar datos del cliente
                    </button>
                  </div>
                )}
                <label>
                  DNI/CUIT
                  <input
                    inputMode="numeric"
                    value={clienteDni}
                    onChange={(e) => setClienteDni(e.target.value)}
                    placeholder="Solo números (detectamos cliente)"
                    className={clienteId != null ? 'totem-print-input--matched' : undefined}
                  />
                  {dniLoading && dniDigits.length >= 7 && (
                    <span className="totem-print-hojasHint">Buscando cliente por DNI…</span>
                  )}
                </label>
                <label>
                  Teléfono
                  <input
                    inputMode="tel"
                    value={clienteTelefono}
                    onChange={(e) => {
                      setClienteTelefono(e.target.value)
                      setClienteId(null)
                    }}
                    placeholder="Ej: 264..."
                    className={clienteId != null ? 'totem-print-input--matched' : undefined}
                  />
                </label>
                <label>
                  Cantidad de hojas
                  <input
                    inputMode="numeric"
                    value={String(printJobs.length > 0 ? hojasTotalesSeleccionadas : cantidadHojas)}
                    readOnly={printJobs.length > 0}
                    onChange={(e) => {
                      if (printJobs.length > 0) return
                      hojasEditadasManualRef.current = true
                      setHojasAutoDetectadas(false)
                      setCantidadHojas(Math.max(1, Math.min(999, Number(e.target.value || '1'))))
                    }}
                  />
                  {printJobs.length > 0 ? (
                    <span className="totem-print-hojasHint">
                      Se calcula con las hojas marcadas × copias
                      {activeJob
                        ? ` · ${activeJob.nombre}: ${formatHojasResumen(
                            activeJob.hojasSeleccionadas,
                            activeJob.pageCount,
                            activeJob.copias
                          )}`
                        : ''}
                    </span>
                  ) : (
                    hojasAutoDetectadas && (
                      <span className="totem-print-hojasHint">Detectado automáticamente del archivo</span>
                    )
                  )}
                </label>
                {printJobs.length > 0 && (
                  <label>
                    Copias
                    <select
                      value={String(normalizeCopias(activeJob?.copias ?? 1))}
                      onChange={(e) => {
                        const v = normalizeCopias(e.target.value)
                        patchActiveJob({ copias: v })
                        hojasEditadasManualRef.current = true
                      }}
                      aria-label="Multiplicar hojas (copias)"
                      disabled={!activeJob}
                    >
                      {Array.from({ length: 20 }, (_, i) => i + 1).map((n) => (
                        <option key={n} value={n}>
                          ×{n}
                          {n === 1 ? ' (una vez)' : ''}
                        </option>
                      ))}
                    </select>
                    <span className="totem-print-hojasHint">
                      Multiplica las hojas elegidas del archivo activo (ej. 3 hojas ×2 = 6).
                    </span>
                  </label>
                )}
                {printJobs.length > 1 && (
                  <div className="totem-print-span2 totem-print-jobTabs">
                    <span className="totem-print-jobTabs-label">Opciones por archivo</span>
                    <div className="totem-print-jobTabs-row">
                      {printJobs.map((job, i) => (
                        <button
                          key={job.key}
                          type="button"
                          className={`totem-print-jobTab${i === activeJobIndex ? ' is-active' : ''}`}
                          onClick={() => setActiveJobIndex(i)}
                        >
                          {job.nombre || `Archivo ${i + 1}`}
                        </button>
                      ))}
                    </div>
                    {activeJob && (
                      <span className="totem-print-hojasHint">{jobLabelCorto(activeJob)}</span>
                    )}
                  </div>
                )}
                <label>
                  Formato
                  <select
                    value={formatoImpresion}
                    onChange={(e) => {
                      const v = e.target.value as PrintFormat
                      setFormatoImpresion(v)
                      patchActiveJob({ formato: v })
                    }}
                  >
                    <option value="A4">A4</option>
                    <option value="A3">A3</option>
                    <option value="A3E">A3 extendido (32×45 cm)</option>
                  </select>
                </label>
                <label className="totem-print-span2">
                  Caras
                  <select
                    value={fazImpresion}
                    onChange={(e) => {
                      const v = e.target.value === 'doble' ? 'doble' : 'simple'
                      setFazImpresion(v)
                      patchActiveJob({ faz: v })
                    }}
                    aria-label="Simple faz o doble faz"
                  >
                    <option value="simple">Simple faz</option>
                    <option value="doble">Doble faz</option>
                  </select>
                  {fazImpresion === 'doble' && (
                    <span className="totem-print-hojasHint">
                      Doble faz: se cobran 2 caras por hoja (Lista 1).
                    </span>
                  )}
                </label>
                <label className="totem-print-span2">
                  Tipo de papel
                  <select
                    value={tipoPapel}
                    onChange={(e) => {
                      const v = e.target.value
                      if (isTotemPrintPapelId(v)) {
                        setTipoPapel(v)
                        patchActiveJob({ papel: v })
                      }
                    }}
                    aria-label="Tipo de papel"
                  >
                    {gruposTotemPrintPapel().map(({ group, options }) => (
                      <optgroup key={group} label={group}>
                        {options.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.label}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  {(tipoPapel === 'obra_240' || tipoPapel.startsWith('adh_') || tipoPapel.startsWith('esp_')) && (
                    <span className="totem-print-hojasHint">
                      {tipoPapel === 'obra_240'
                        ? 'Precio Lista 1: Obra 120–180 g (no hay ítem 240 g).'
                        : tipoPapel.startsWith('adh_')
                          ? 'Precio Lista 1: Papel adhesivo del formato elegido.'
                          : 'Precio Lista 1: Papel especial del formato (texturado / metalizado / perlado).'}
                    </span>
                  )}
                </label>
                <label className="totem-print-span2">
                  Color / blanco y negro
                  <select
                    value={modoColor}
                    onChange={(e) => {
                      const v = e.target.value as TotemPrintColorModo
                      setModoColor(v)
                      patchActiveJob({ modoColor: v })
                    }}
                    aria-label="Modo de color"
                  >
                    <option value="auto">Automático (del archivo)</option>
                    <option value="color">Todo a color</option>
                    <option value="bn">Todo blanco y negro</option>
                  </select>
                  {modoColor === 'auto' && colorAutoDetectado && (
                    <span className="totem-print-hojasHint">Detectado: {colorQuote.tipo_impresion}</span>
                  )}
                  {modoColor === 'color' && (
                    <span className="totem-print-hojasHint">
                      Se cobrarán las {printJobs.length > 0 ? hojasTotalesSeleccionadas : cantidadHojas} hoja(s) como
                      color (Lista 1).
                    </span>
                  )}
                  {modoColor === 'bn' && (
                    <span className="totem-print-hojasHint">
                      Se cobrarán las {printJobs.length > 0 ? hojasTotalesSeleccionadas : cantidadHojas} hoja(s) como
                      blanco y negro (Lista 1).
                    </span>
                  )}
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
                    <div className="totem-print-origenPanel">
                      <span className="totem-print-origenLabel">Links de Google Drive (hasta {TOTEM_PRINT_MAX_FILES})</span>
                      <div className="totem-print-driveAdd">
                        <input
                          value={driveLinkDraft}
                          onChange={(e) => setDriveLinkDraft(e.target.value)}
                          placeholder="https://drive.google.com/…"
                          aria-label="Link de Google Drive"
                        />
                        <button
                          type="button"
                          className="totem-print-addFileBtn"
                          onClick={agregarDriveLink}
                          disabled={driveArchivos.length >= TOTEM_PRINT_MAX_FILES}
                        >
                          Agregar link
                        </button>
                      </div>
                      {driveArchivos.length > 0 && (
                        <ul className="totem-print-fileList">
                          {driveArchivos.map((f, i) => (
                            <li key={`${f.url}-${i}`}>
                              <span className="totem-print-fileList__name" title={f.url}>
                                {f.nombre}
                              </span>
                              <button
                                type="button"
                                className="totem-print-fileList__remove"
                                onClick={() => quitarDriveArchivo(i)}
                                aria-label={`Quitar ${f.nombre}`}
                              >
                                Quitar
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                      {driveArchivos.length > 0 && (
                        <button type="button" className="totem-print-clearBtn" onClick={limpiarSeleccionArchivo}>
                          Quitar todos los links
                        </button>
                      )}
                    </div>
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
                        {pendriveArchivos.length === 0
                          ? `Elegir archivos (hasta ${TOTEM_PRINT_MAX_FILES}, máx. ${TOTEM_PRINT_MAX_FILE_MB} MB c/u)`
                          : `Agregar más archivos (${pendriveArchivos.length}/${TOTEM_PRINT_MAX_FILES})`}
                        <input
                          ref={pendriveInputRef}
                          type="file"
                          multiple
                          accept=".pdf,application/pdf,image/jpeg,image/png,image/webp,image/heic,.heic"
                          className="totem-print-fileInput"
                          disabled={pendriveSubiendo || pendriveArchivos.length >= TOTEM_PRINT_MAX_FILES}
                          onChange={(e) => handlePendriveFiles(e.target.files)}
                        />
                      </label>
                      {pendriveSubiendo && <p className="totem-print-waHint">Subiendo archivos…</p>}
                      {pendriveArchivos.length > 0 && !pendriveSubiendo && (
                        <ul className="totem-print-fileList">
                          {pendriveArchivos.map((f, i) => (
                            <li key={`${f.url}-${i}`}>
                              <span className="totem-print-fileList__name">{f.nombre}</span>
                              <button
                                type="button"
                                className="totem-print-fileList__remove"
                                onClick={() => quitarPendriveArchivo(i)}
                                aria-label={`Quitar ${f.nombre}`}
                              >
                                Quitar
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                      {pendriveArchivos.length > 0 && !pendriveSubiendo && (
                        <div className="totem-print-fileActions">
                          <button
                            type="button"
                            className="totem-print-addFileBtn"
                            disabled={pendriveArchivos.length >= TOTEM_PRINT_MAX_FILES}
                            onClick={() => pendriveInputRef.current?.click()}
                          >
                            + Agregar más archivos
                          </button>
                          <button type="button" className="totem-print-clearBtn" onClick={limpiarSeleccionArchivo}>
                            Quitar todos
                          </button>
                        </div>
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
                              <>
                                <ul className="totem-print-fileList">
                                  {archivosCargados.map((f, i) => (
                                    <li key={`${f.url}-${i}`}>
                                      <span className="totem-print-fileList__name">{f.nombre || `Archivo ${i + 1}`}</span>
                                    </li>
                                  ))}
                                </ul>
                                <p className="totem-print-fileOk">
                                  {archivosCargados.length} archivo(s) recibido(s) desde el celular.
                                </p>
                              </>
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
                            {qrSesionCompleta && archivosCargados.length > 0 && archivosCargados.length < TOTEM_PRINT_MAX_FILES && (
                              <button
                                type="button"
                                className="totem-print-addFileBtn totem-print-addFileBtn--block"
                                onClick={() => {
                                  setError(null)
                                  setQrSesionCompleta(false)
                                  setQrSessionNonce((n) => n + 1)
                                }}
                              >
                                + Agregar más con otro QR ({archivosCargados.length}/{TOTEM_PRINT_MAX_FILES})
                              </button>
                            )}
                            {(archivosCargados.length > 0 || qrSesionCompleta) && (
                              <button
                                type="button"
                                className="totem-print-clearBtn totem-print-clearBtn--block"
                                onClick={limpiarSeleccionArchivo}
                              >
                                Quitar archivos y generar nuevo QR
                              </button>
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
                <label className="totem-print-span2">
                  Descripción / indicaciones
                  <textarea
                    className="totem-print-desc"
                    value={descripcionImpresion}
                    onChange={(e) => setDescripcionImpresion(e.target.value.slice(0, 500))}
                    rows={3}
                    placeholder="Ej: hoja 1 a color, hojas 2 a 5 en blanco y negro. Imprimir solo el frente…"
                    maxLength={500}
                  />
                  <span className="totem-print-hojasHint">
                    Opcional. Lo ve mostrador (ej. qué hojas van a color o B/N). {descripcionImpresion.length}/500
                  </span>
                </label>
                {tieneArchivoSeleccionado &&
                  origenArchivo !== 'Pendrive' &&
                  origenArchivo !== 'CelularQR' &&
                  origenArchivo !== 'Drive' && (
                  <div className="totem-print-span2 totem-print-clearRow">
                    <button type="button" className="totem-print-clearBtn" onClick={limpiarSeleccionArchivo}>
                      Quitar selección de archivo
                    </button>
                    <span className="totem-print-hojasHint">Volvé a subir el archivo si te equivocaste.</span>
                  </div>
                )}
                <label className="totem-print-span2 totem-print-readonlyField">
                  Valor a cobrar (Lista 1)
                  <div className="totem-print-priceTotal" aria-live="polite">
                    {printQuoteLoading
                      ? 'Calculando…'
                      : printQuote
                        ? formatTotemPrintArs(printQuote.total)
                        : '—'}
                  </div>
                  {printQuote?.items.map((item, idx) => (
                    <div key={`${item.codigo || item.descripcion}-${idx}`} className="totem-print-priceLine">
                      {item.cantidad} × {item.descripcion}: {formatTotemPrintArs(item.subtotal)}
                    </div>
                  ))}
                  {printQuoteError && !printQuoteLoading && (
                    <span className="totem-print-qrError">{printQuoteError}</span>
                  )}
                </label>
              </div>

              <aside className="totem-print-previewAside">
                <TotemPrintPreviewMonitor
                  sources={previewSources}
                  formatoImpresion={formatoImpresion}
                  modoColor={modoColor}
                  tipoPapel={tipoPapel}
                  fazImpresion={fazImpresion}
                  activeSourceIndex={activeJobIndex}
                  onActiveSourceChange={setActiveJobIndex}
                  selectedPages={activeJob?.hojasSeleccionadas}
                  pageCountForActive={activeJob?.pageCount}
                  copias={activeJob?.copias ?? 1}
                  onTogglePage={(sourceIndex, pageInSource) => {
                    setPrintJobs((prev) =>
                      prev.map((j, i) =>
                        i === sourceIndex
                          ? {
                              ...j,
                              hojasSeleccionadas: togglePageInList(j.hojasSeleccionadas, pageInSource)
                            }
                          : j
                      )
                    )
                    hojasEditadasManualRef.current = true
                  }}
                  onSelectAllPages={(sourceIndex) => {
                    setPrintJobs((prev) =>
                      prev.map((j, i) =>
                        i === sourceIndex
                          ? { ...j, hojasSeleccionadas: allPagesRange(Math.max(1, j.pageCount)) }
                          : j
                      )
                    )
                    hojasEditadasManualRef.current = true
                  }}
                  onClearPages={(sourceIndex) => {
                    setPrintJobs((prev) =>
                      prev.map((j, i) => (i === sourceIndex ? { ...j, hojasSeleccionadas: [] } : j))
                    )
                    hojasEditadasManualRef.current = true
                  }}
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
