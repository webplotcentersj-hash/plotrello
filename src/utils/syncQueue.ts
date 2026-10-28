/**
 * Cola de sync offline (IndexedDB).
 * Jobs: reloj_marcar | tablero_mover | venta_rapida | marcar_entrega
 */

export type SyncJobKind = 'reloj_marcar' | 'tablero_mover' | 'venta_rapida' | 'marcar_entrega'

export type RelojMarcarPayload = {
  idUsuario: number
  marcadoAt: string
  dispositivoId?: string
  detalle?: string
  omitirFoto?: boolean
  tipoHint?: 'entrada' | 'salida'
  nombreHint?: string
}

export type TableroMoverPayload = {
  ordenId: number
  nuevoEstado: string
  usuarioId: number
  taskId: string
  /** Estado en servidor al encolar (para detectar conflicto al sync). */
  estadoOrigen?: string
}

export type VentaRapidaItemPayload = {
  id_articulo_stock?: number | null
  codigo_articulo?: string | null
  descripcion: string
  cantidad: number
  precio_unitario: number
  descuento?: number | null
  observaciones?: string | null
}

/** Snapshot listo para `crearVentaConItems` (sin AFIP / MP). */
export type VentaRapidaPayload = {
  venta: {
    cliente_nombre: string
    cliente_telefono?: string
    cliente_email?: string
    cliente_dni_cuit?: string
    cliente_empresa?: string
    cliente_direccion?: string
    valor_total: number
    metodo_pago?: string
    estado_pago?: string
    fecha_venta?: string
    id_vendedor: number
    nombre_vendedor: string
    id_cliente?: number
    observaciones?: string
    detalle_pago?: Record<string, unknown> | null
  }
  items: VentaRapidaItemPayload[]
  stockEmpresa?: Array<{ idArticuloEmpresa: number; cantidadVendida: number }>
  presupuestoId?: number
  actorId: number
  actorNombre: string
}

export type MarcarEntregaPayload = {
  ordenId: number
  firmaDataUrl: string
  entregadoA: string
  dniRetira?: string
  observaciones?: string
  usuarioId: number
  usuarioNombre: string
}

export type SyncJobPayload =
  | RelojMarcarPayload
  | TableroMoverPayload
  | VentaRapidaPayload
  | MarcarEntregaPayload

export type SyncJob = {
  id: string
  kind: SyncJobKind
  createdAt: string
  attempts: number
  lastError?: string
  payload: SyncJobPayload
}

const DB_NAME = 'plotlab_sync_v1'
const STORE = 'jobs'
const DB_VERSION = 1

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB no disponible'))
      return
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error || new Error('No se pudo abrir IndexedDB'))
  })
}

function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error || new Error('Error IndexedDB'))
  })
}

export async function syncQueueEnqueue(
  kind: 'reloj_marcar',
  payload: RelojMarcarPayload
): Promise<SyncJob>
export async function syncQueueEnqueue(
  kind: 'tablero_mover',
  payload: TableroMoverPayload
): Promise<SyncJob>
export async function syncQueueEnqueue(
  kind: 'venta_rapida',
  payload: VentaRapidaPayload
): Promise<SyncJob>
export async function syncQueueEnqueue(
  kind: 'marcar_entrega',
  payload: MarcarEntregaPayload
): Promise<SyncJob>
export async function syncQueueEnqueue(
  kind: SyncJobKind,
  payload: SyncJobPayload
): Promise<SyncJob> {
  const job: SyncJob = {
    id: `${kind}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    kind,
    createdAt: new Date().toISOString(),
    attempts: 0,
    payload
  }
  const db = await openDb()
  try {
    await reqToPromise(db.transaction(STORE, 'readwrite').objectStore(STORE).add(job))
  } finally {
    db.close()
  }
  notifySyncQueueChanged()
  return job
}

export async function syncQueueList(): Promise<SyncJob[]> {
  const db = await openDb()
  try {
    const rows = await reqToPromise(db.transaction(STORE, 'readonly').objectStore(STORE).getAll())
    return (rows as SyncJob[]).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  } finally {
    db.close()
  }
}

export async function syncQueueCount(): Promise<number> {
  const db = await openDb()
  try {
    return await reqToPromise(db.transaction(STORE, 'readonly').objectStore(STORE).count())
  } finally {
    db.close()
  }
}

export async function syncQueueRemove(id: string): Promise<void> {
  const db = await openDb()
  try {
    await reqToPromise(db.transaction(STORE, 'readwrite').objectStore(STORE).delete(id))
  } finally {
    db.close()
  }
  notifySyncQueueChanged()
}

export async function syncQueueBumpAttempt(id: string, error: string): Promise<void> {
  const db = await openDb()
  try {
    const tx = db.transaction(STORE, 'readwrite')
    const store = tx.objectStore(STORE)
    const job = (await reqToPromise(store.get(id))) as SyncJob | undefined
    if (!job) return
    job.attempts += 1
    job.lastError = error.slice(0, 400)
    await reqToPromise(store.put(job))
  } finally {
    db.close()
  }
  notifySyncQueueChanged()
}

type FlushHandler = (job: SyncJob) => Promise<void>

const handlers = new Map<SyncJobKind, FlushHandler>()

export function registerSyncHandler(kind: SyncJobKind, handler: FlushHandler): void {
  handlers.set(kind, handler)
}

let flushing = false

/** Procesa la cola en orden. Devuelve cuántos jobs se enviaron OK. */
export async function syncQueueFlush(): Promise<{ ok: number; failed: number; remaining: number }> {
  if (flushing) return { ok: 0, failed: 0, remaining: await syncQueueCount() }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { ok: 0, failed: 0, remaining: await syncQueueCount() }
  }
  flushing = true
  let ok = 0
  let failed = 0
  try {
    const jobs = await syncQueueList()
    for (const job of jobs) {
      const handler = handlers.get(job.kind)
      if (!handler) {
        failed += 1
        await syncQueueBumpAttempt(job.id, 'Sin handler registrado')
        continue
      }
      try {
        await handler(job)
        await syncQueueRemove(job.id)
        ok += 1
      } catch (e) {
        failed += 1
        await syncQueueBumpAttempt(job.id, e instanceof Error ? e.message : String(e))
        if (!navigator.onLine) break
      }
    }
  } finally {
    flushing = false
  }
  const remaining = await syncQueueCount()
  notifySyncQueueChanged()
  return { ok, failed, remaining }
}

const LISTENERS = new Set<() => void>()

export function subscribeSyncQueue(listener: () => void): () => void {
  LISTENERS.add(listener)
  return () => LISTENERS.delete(listener)
}

function notifySyncQueueChanged(): void {
  for (const l of LISTENERS) {
    try {
      l()
    } catch {
      /* ignore */
    }
  }
}

export function isLikelyNetworkError(err: unknown): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true
  const msg = err instanceof Error ? err.message : String(err || '')
  return /failed to fetch|networkerror|load failed|err_network|err_internet|offline|timeout|abort/i.test(
    msg
  )
}

export function isRelojMarcarPayload(p: SyncJobPayload): p is RelojMarcarPayload {
  return typeof (p as RelojMarcarPayload).idUsuario === 'number' && 'marcadoAt' in p
}

export function isTableroMoverPayload(p: SyncJobPayload): p is TableroMoverPayload {
  return (
    typeof (p as TableroMoverPayload).ordenId === 'number' &&
    'nuevoEstado' in p &&
    !('firmaDataUrl' in p)
  )
}

export function isVentaRapidaPayload(p: SyncJobPayload): p is VentaRapidaPayload {
  const v = p as VentaRapidaPayload
  return Boolean(v && typeof v === 'object' && v.venta && Array.isArray(v.items))
}

export function isMarcarEntregaPayload(p: SyncJobPayload): p is MarcarEntregaPayload {
  return (
    typeof (p as MarcarEntregaPayload).ordenId === 'number' &&
    typeof (p as MarcarEntregaPayload).firmaDataUrl === 'string' &&
    typeof (p as MarcarEntregaPayload).entregadoA === 'string'
  )
}
