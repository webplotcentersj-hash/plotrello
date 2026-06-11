import { useEffect, useMemo, useState } from 'react'
import type { WorkPoolProduct, WorkPoolSector } from '../../types/workPool'
import { WORK_POOL_SECTOR_LABELS } from '../../types/workPool'
import { apiService } from '../../services/api'
import type { UsuarioRecord } from '../../types/api'
import {
  defaultSectorForProduct,
  rolForWorkPoolSector,
  sectorsForProduct,
  WORK_POOL_PRODUCT_CONFIG
} from './workPoolConfig'
import { crearWorkPoolJob, listPricingRules } from './workPoolRepository'
import './WorkPoolModule.css'

export type WorkPoolPublicarFormProps = {
  product: WorkPoolProduct
  idUsuarioCreador: number
  /** Prellenado al derivar desde OP */
  numeroOp?: string
  descripcionInicial?: string
  sectorInicial?: WorkPoolSector
  onSuccess?: () => void
  onError?: (msg: string) => void
  compact?: boolean
}

function formatArs(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)
}

type ModoPublicacion = 'bolsa' | 'asignado'

export default function WorkPoolPublicarForm({
  product,
  idUsuarioCreador,
  numeroOp = '',
  descripcionInicial = '',
  sectorInicial,
  onSuccess,
  onError,
  compact = false
}: WorkPoolPublicarFormProps) {
  const sectors = sectorsForProduct(product)
  const cfg = WORK_POOL_PRODUCT_CONFIG[product]

  const [sector, setSector] = useState<WorkPoolSector>(
    sectorInicial && sectors.includes(sectorInicial)
      ? sectorInicial
      : defaultSectorForProduct(product)
  )
  const [modo, setModo] = useState<ModoPublicacion>('bolsa')
  const [createOp, setCreateOp] = useState(numeroOp)
  const [createDesc, setCreateDesc] = useState(descripcionInicial)
  const [createTarifa, setCreateTarifa] = useState('')
  const [createMonto, setCreateMonto] = useState('')
  const [empleadoId, setEmpleadoId] = useState<number | ''>('')
  const [tarifas, setTarifas] = useState<Array<{ codigo: string; nombre: string; monto_base: number }>>([])
  const [empleados, setEmpleados] = useState<UsuarioRecord[]>([])
  const [creating, setCreating] = useState(false)
  const [localError, setLocalError] = useState('')

  useEffect(() => {
    setCreateOp(numeroOp)
  }, [numeroOp])

  useEffect(() => {
    if (descripcionInicial) setCreateDesc(descripcionInicial)
  }, [descripcionInicial])

  useEffect(() => {
    void listPricingRules(sector).then((res) => {
      if (res.success) setTarifas(res.data ?? [])
    })
  }, [sector])

  useEffect(() => {
    void apiService.getUsuarios().then((res) => {
      if (!res.success || !res.data) return
      const rol = rolForWorkPoolSector(sector)
      setEmpleados(res.data.filter((u) => u.rol === rol))
    })
  }, [sector])

  const montoFromTarifa = useMemo(() => {
    const t = tarifas.find((x) => x.codigo === createTarifa)
    return t?.monto_base ?? 0
  }, [tarifas, createTarifa])

  const handleSubmit = async () => {
    if (!createOp.trim()) {
      const msg = 'Indicá el número de OP'
      setLocalError(msg)
      onError?.(msg)
      return
    }
    if (modo === 'asignado' && !empleadoId) {
      const msg = 'Elegí el empleado a asignar'
      setLocalError(msg)
      onError?.(msg)
      return
    }

    setCreating(true)
    setLocalError('')
    const res = await crearWorkPoolJob({
      sector,
      numero_op: createOp.trim(),
      descripcion: createDesc.trim() || undefined,
      codigo_tarifa: createTarifa || undefined,
      monto: createMonto ? Number(createMonto) : undefined,
      id_usuario_creador: idUsuarioCreador,
      id_usuario_asignado: modo === 'asignado' ? Number(empleadoId) : undefined,
      modo
    })
    setCreating(false)

    if (!res.success) {
      const msg = res.error || 'No se pudo crear el trabajo'
      setLocalError(msg)
      onError?.(msg)
      return
    }

    setCreateOp(numeroOp)
    setCreateDesc('')
    setCreateTarifa('')
    setCreateMonto('')
    setEmpleadoId('')
    setModo('bolsa')
    onSuccess?.()
  }

  return (
    <div className={`work-pool-publicar${compact ? ' work-pool-publicar--compact' : ''}`}>
      {!compact && (
        <>
          <h3>
            {cfg.icon} Publicar en {cfg.label}
          </h3>
          <p className="work-pool-publicar__hint">
            Derivá desde la OP a la bolsa libre o asigná directamente a un empleado del sector.
          </p>
        </>
      )}

      {sectors.length > 1 && (
        <div className="work-pool-module__tabs work-pool-publicar__sectors">
          {sectors.map((s) => (
            <button
              key={s}
              type="button"
              className={`work-pool-module__tab${sector === s ? ' is-active' : ''}`}
              onClick={() => setSector(s)}
            >
              {WORK_POOL_SECTOR_LABELS[s]}
            </button>
          ))}
        </div>
      )}

      <div className="work-pool-publicar__modo" role="radiogroup" aria-label="Modo de publicación">
        <button
          type="button"
          className={`work-pool-publicar__modo-btn${modo === 'bolsa' ? ' is-active' : ''}`}
          onClick={() => setModo('bolsa')}
        >
          <strong>Bolsa libre</strong>
          <span>Cualquier operario del sector puede tomarlo</span>
        </button>
        <button
          type="button"
          className={`work-pool-publicar__modo-btn${modo === 'asignado' ? ' is-active' : ''}`}
          onClick={() => setModo('asignado')}
        >
          <strong>Asignar empleado</strong>
          <span>Va directo a un integrante del equipo</span>
        </button>
      </div>

      <div className="work-pool-module__form-row">
        <label>
          Nº OP <span className="work-pool-publicar__req">*</span>
          <input
            value={createOp}
            onChange={(e) => setCreateOp(e.target.value)}
            placeholder="Ej. 100660"
            readOnly={Boolean(numeroOp) && compact}
          />
        </label>
        <label>
          Tarifario
          <select value={createTarifa} onChange={(e) => setCreateTarifa(e.target.value)}>
            <option value="">— Elegir —</option>
            {tarifas.map((t) => (
              <option key={t.codigo} value={t.codigo}>
                {t.nombre} ({formatArs(t.monto_base)})
              </option>
            ))}
          </select>
        </label>
        <label>
          Monto manual (opcional)
          <input
            type="number"
            min="0"
            value={createMonto}
            onChange={(e) => setCreateMonto(e.target.value)}
            placeholder={createTarifa ? String(montoFromTarifa) : '0'}
          />
        </label>
      </div>

      {modo === 'asignado' && (
        <div className="work-pool-module__form-row">
          <label style={{ gridColumn: '1 / -1' }}>
            Empleado ({WORK_POOL_SECTOR_LABELS[sector]})
            <select value={empleadoId} onChange={(e) => setEmpleadoId(e.target.value ? Number(e.target.value) : '')}>
              <option value="">— Elegir empleado —</option>
              {empleados.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nombre}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      <div className="work-pool-module__form-row">
        <label style={{ gridColumn: '1 / -1' }}>
          Descripción / brief
          <textarea
            value={createDesc}
            onChange={(e) => setCreateDesc(e.target.value)}
            placeholder="Qué debe hacer el operario…"
          />
        </label>
      </div>

      {localError && <div className="work-pool-module__alert work-pool-module__alert--error">{localError}</div>}

      <button
        type="button"
        className="work-pool-module__btn work-pool-module__btn--primary"
        disabled={creating}
        onClick={() => void handleSubmit()}
      >
        {creating
          ? 'Publicando…'
          : modo === 'bolsa'
            ? `Publicar en bolsa ${cfg.shortLabel}`
            : 'Asignar a empleado'}
      </button>
    </div>
  )
}
