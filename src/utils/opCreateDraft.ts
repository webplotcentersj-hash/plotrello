import type { PedidoClienteRecord } from '../types/api'
import type { CobroOpEstado } from './opCobroEstado'

const STORAGE_PREFIX = 'plotlab-op-create-draft-v1'

export type OpCreateDraftAttachment = {
  id: string
  name: string
  remoteUrl: string
  type?: string
}

export type OpCreateDraftData = {
  opNumber: string
  cliente: string
  dniCuit: string
  telefonoCliente: string
  emailCliente: string
  direccionCliente: string
  ubicacionUrl: string
  driveUrl: string
  fechaEntrega: string
  horaEstimada: string
  cobroOp: CobroOpEstado
  montoPagoParcialInput: string
  selectedSectores: string[]
  operario: string
  complejidad: string
  prioridad: string
  descripcion: string
  briefPublico: string
  objetivoProyecto: string
  publicoObjetivo: string
  estiloDiseno: string
  referencias: string
  deadlineBrief: string
  materials: Array<{ name: string; quantity: number }>
  photoUrl: string
  metrosCuadrados: string
  lineasMetrosM2: Array<{ tipo: string; metrosCuadrados: number }>
  tags: string[]
  tagColors: Record<string, string>
  briefTokenSeleccionado: string | null
  briefMockupUrl: string | null
  pedidoWebSeleccionado: PedidoClienteRecord | null
  attachments: OpCreateDraftAttachment[]
}

export type OpCreateDraftRecord = {
  savedAt: number
  data: OpCreateDraftData
}

const COBRO_OK: CobroOpEstado[] = ['ninguno', 'pagado', 'parcial', 'cuenta_corriente', 'sin_pago']

function storageKey(userKey: string) {
  return `${STORAGE_PREFIX}:${userKey || 'anon'}`
}

export function emptyOpCreateDraft(): OpCreateDraftData {
  return {
    opNumber: '',
    cliente: '',
    dniCuit: '',
    telefonoCliente: '',
    emailCliente: '',
    direccionCliente: '',
    ubicacionUrl: '',
    driveUrl: '',
    fechaEntrega: '',
    horaEstimada: '',
    cobroOp: 'ninguno',
    montoPagoParcialInput: '',
    selectedSectores: [],
    operario: '',
    complejidad: 'Media',
    prioridad: 'Normal',
    descripcion: '',
    briefPublico: '',
    objetivoProyecto: '',
    publicoObjetivo: '',
    estiloDiseno: '',
    referencias: '',
    deadlineBrief: '',
    materials: [],
    photoUrl: '',
    metrosCuadrados: '',
    lineasMetrosM2: [],
    tags: [],
    tagColors: {},
    briefTokenSeleccionado: null,
    briefMockupUrl: null,
    pedidoWebSeleccionado: null,
    attachments: []
  }
}

export function isOpCreateDraftMeaningful(data: OpCreateDraftData): boolean {
  return Boolean(
    data.opNumber.trim() ||
      data.cliente.trim() ||
      data.dniCuit.trim() ||
      data.telefonoCliente.trim() ||
      data.emailCliente.trim() ||
      data.direccionCliente.trim() ||
      data.descripcion.trim() ||
      data.fechaEntrega ||
      data.horaEstimada ||
      data.selectedSectores.length > 0 ||
      data.materials.length > 0 ||
      data.tags.length > 0 ||
      data.attachments.length > 0 ||
      data.lineasMetrosM2.length > 0 ||
      data.metrosCuadrados.trim() ||
      data.briefPublico.trim() ||
      data.objetivoProyecto.trim() ||
      data.briefTokenSeleccionado ||
      data.pedidoWebSeleccionado ||
      data.ubicacionUrl.trim() ||
      data.driveUrl.trim() ||
      data.cobroOp !== 'ninguno'
  )
}

export function loadOpCreateDraft(userKey: string): OpCreateDraftRecord | null {
  try {
    const raw = localStorage.getItem(storageKey(userKey))
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<OpCreateDraftRecord>
    if (!parsed?.data || typeof parsed.savedAt !== 'number') return null
    const base = emptyOpCreateDraft()
    const cobro = COBRO_OK.includes(parsed.data.cobroOp as CobroOpEstado)
      ? (parsed.data.cobroOp as CobroOpEstado)
      : 'ninguno'
    return {
      savedAt: parsed.savedAt,
      data: {
        ...base,
        ...parsed.data,
        cobroOp: cobro,
        selectedSectores: Array.isArray(parsed.data.selectedSectores) ? parsed.data.selectedSectores : [],
        materials: Array.isArray(parsed.data.materials) ? parsed.data.materials : [],
        tags: Array.isArray(parsed.data.tags) ? parsed.data.tags : [],
        lineasMetrosM2: Array.isArray(parsed.data.lineasMetrosM2) ? parsed.data.lineasMetrosM2 : [],
        attachments: Array.isArray(parsed.data.attachments) ? parsed.data.attachments : [],
        tagColors: parsed.data.tagColors && typeof parsed.data.tagColors === 'object' ? parsed.data.tagColors : {}
      }
    }
  } catch {
    return null
  }
}

export function saveOpCreateDraft(userKey: string, data: OpCreateDraftData): number {
  const savedAt = Date.now()
  localStorage.setItem(storageKey(userKey), JSON.stringify({ savedAt, data } satisfies OpCreateDraftRecord))
  return savedAt
}

export function clearOpCreateDraft(userKey: string) {
  try {
    localStorage.removeItem(storageKey(userKey))
  } catch {
    /* ignore */
  }
}

export function formatOpCreateDraftSavedAt(ts: number | null): string {
  if (!ts) return ''
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
}
