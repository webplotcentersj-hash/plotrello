import { useCallback, useEffect, useMemo, useState } from 'react'
import { plotLabFetch } from '../utils/plotLabApiOrigin'
import { getStaffAuthToken } from '../services/staffSession'
import {
  buildFaceGallery,
  countPendingFacialIndex,
  gallerySigFromEmpleados
} from '../tablet-reloj/services/faceLocalMatch'
import type { EmpleadoRelojTablet } from '../tablet-reloj/services/relojTabletApi'
import './RelojFacialTab.css'

type EmpleadoFotoRow = {
  id_usuario: number
  nombre: string
  apellido: string
  login: string
  nombre_completo: string
  sector: string
  foto_url: string | null
  tiene_foto_legajo: boolean
}

type IndiceMeta = {
  indexed_count?: number
  failed_count?: number
  total_fotos?: number
  built_at?: string | null
  signature?: string
}

type IndiceResumenRow = {
  id_usuario: number
  nombre: string
  foto_url: string
  foto_key: string
  indexed_at?: string
}

type RelojFacialTabProps = {
  onVerAuditoria?: () => void
  onIrAHorarios?: () => void
}

export default function RelojFacialTab({ onVerAuditoria, onIrAHorarios }: RelojFacialTabProps) {
  const [empleados, setEmpleados] = useState<EmpleadoFotoRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [meta, setMeta] = useState<IndiceMeta | null>(null)
  const [indexedRows, setIndexedRows] = useState<IndiceResumenRow[]>([])
  const [indexing, setIndexing] = useState(false)
  const [indexProgress, setIndexProgress] = useState('')
  const [indexMsg, setIndexMsg] = useState('')

  const authHeaders = useCallback((): HeadersInit => {
    const token = getStaffAuthToken()
    return token ? { Authorization: `Bearer ${token}` } : {}
  }, [])

  const cargar = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [empResp, idxResp] = await Promise.all([
        plotLabFetch('/api/rrhh/reloj-tablet-empleados', { headers: authHeaders() }),
        plotLabFetch('/api/rrhh/facial-indice', { headers: authHeaders() })
      ])
      const empJson = (await empResp.json()) as {
        success?: boolean
        empleados?: EmpleadoFotoRow[]
        error?: string
      }
      const idxJson = (await idxResp.json()) as {
        success?: boolean
        meta?: IndiceMeta | null
        descriptores?: IndiceResumenRow[]
        error?: string
      }
      if (!empResp.ok || !empJson.success) {
        throw new Error(empJson.error || 'No se pudo cargar empleados')
      }
      setEmpleados(empJson.empleados ?? [])
      if (idxResp.ok && idxJson.success) {
        setMeta(idxJson.meta ?? null)
        setIndexedRows(idxJson.descriptores ?? [])
      } else {
        setMeta(null)
        setIndexedRows([])
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error de conexión')
      setEmpleados([])
      setMeta(null)
      setIndexedRows([])
    } finally {
      setLoading(false)
    }
  }, [authHeaders])

  useEffect(() => {
    void cargar()
  }, [cargar])

  const { conFoto, sinFoto, pct, pendientes } = useMemo(() => {
    const con = empleados.filter((e) => e.tiene_foto_legajo || Boolean(e.foto_url?.trim()))
    const sin = empleados.filter((e) => !(e.tiene_foto_legajo || Boolean(e.foto_url?.trim())))
    const total = empleados.length
    return {
      conFoto: con,
      sinFoto: sin,
      pct: total ? Math.round((con.length / total) * 100) : 0,
      pendientes: countPendingFacialIndex(con, indexedRows)
    }
  }, [empleados, indexedRows])

  const indexarRostros = useCallback(async () => {
    setIndexing(true)
    setIndexMsg('')
    setError('')
    try {
      const asTablet: EmpleadoRelojTablet[] = conFoto.map((e) => ({
        id_usuario: e.id_usuario,
        nombre: e.nombre || '',
        apellido: e.apellido || '',
        sector: e.sector || '',
        foto_url: e.foto_url,
        login: e.login || '',
        nombre_completo: e.nombre_completo,
        tiene_foto_legajo: e.tiene_foto_legajo
      }))

      setIndexProgress('Cargando modelos face-api…')
      const stats = await buildFaceGallery(asTablet, (done, total) =>
        setIndexProgress(`Indexando ${done}/${total}…`)
      )

      setIndexProgress('Guardando índice en el servidor…')
      const putResp = await plotLabFetch('/api/rrhh/facial-indice', {
        method: 'PUT',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          descriptores: stats.records,
          failed_count: stats.failed,
          total_fotos: stats.total,
          signature: gallerySigFromEmpleados(asTablet)
        })
      })
      const putJson = (await putResp.json()) as { success?: boolean; indexed?: number; error?: string }
      if (!putResp.ok || !putJson.success) {
        throw new Error(putJson.error || 'No se pudo guardar el índice')
      }

      setIndexMsg(
        stats.failed
          ? `Índice actualizado: ${stats.indexed} rostros (${stats.failed} fotos sin rostro legible).`
          : `Índice actualizado: ${stats.indexed} rostros listos para el kiosco.`
      )
      setIndexProgress('')
      await cargar()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al indexar')
      setIndexProgress('')
    } finally {
      setIndexing(false)
    }
  }, [authHeaders, cargar, conFoto])

  const builtLabel = meta?.built_at
    ? new Date(meta.built_at).toLocaleString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    : 'Nunca'

  return (
    <div className="reloj-facial-tab">
      <div className="reloj-facial-hero">
        <div>
          <h3>Reloj con reconocimiento facial</h3>
          <p>
            El kiosco usa un índice de rostros guardado en el servidor (no reindexa en cada actualización).
            Cuando cargues fotos nuevas de legajo, actualizá el índice acá. La base de
            entrada/tardanza es <strong>Horarios reloj</strong> (tolerancia 15 min).
          </p>
        </div>
        <div className="reloj-facial-hero-actions">
          <a
            className="reloj-facial-btn-primary"
            href="/tablet-reloj?modo=facial"
            target="_blank"
            rel="noreferrer"
          >
            Abrir kiosco facial →
          </a>
          {onIrAHorarios ? (
            <button type="button" className="reloj-facial-btn-ghost" onClick={onIrAHorarios}>
              Ver Horarios reloj
            </button>
          ) : null}
          {onVerAuditoria ? (
            <button type="button" className="reloj-facial-btn-ghost" onClick={onVerAuditoria}>
              Ver auditoría
            </button>
          ) : (
            <a className="reloj-facial-btn-ghost" href="/tablet-reloj" target="_blank" rel="noreferrer">
              Abrir tablet QR
            </a>
          )}
        </div>
      </div>

      <div className="reloj-facial-stats">
        <div className="reloj-facial-stat">
          <span className="reloj-facial-stat-value">{loading ? '…' : empleados.length}</span>
          <span className="reloj-facial-stat-label">Empleados reloj</span>
        </div>
        <div className="reloj-facial-stat reloj-facial-stat--ok">
          <span className="reloj-facial-stat-value">{loading ? '…' : conFoto.length}</span>
          <span className="reloj-facial-stat-label">Con foto de legajo</span>
        </div>
        <div className="reloj-facial-stat reloj-facial-stat--warn">
          <span className="reloj-facial-stat-value">{loading ? '…' : sinFoto.length}</span>
          <span className="reloj-facial-stat-label">Sin foto (no facial)</span>
        </div>
        <div className="reloj-facial-stat">
          <span className="reloj-facial-stat-value">{loading ? '…' : meta?.indexed_count ?? 0}</span>
          <span className="reloj-facial-stat-label">Rostros indexados</span>
        </div>
        <div className={`reloj-facial-stat${pendientes > 0 ? ' reloj-facial-stat--warn' : ''}`}>
          <span className="reloj-facial-stat-value">{loading ? '…' : pendientes}</span>
          <span className="reloj-facial-stat-label">Pendientes de indexar</span>
        </div>
        <div className="reloj-facial-stat">
          <span className="reloj-facial-stat-value">{loading ? '…' : `${pct}%`}</span>
          <span className="reloj-facial-stat-label">Cobertura foto</span>
        </div>
      </div>

      <div className="reloj-facial-index-panel">
        <div>
          <strong>Índice facial del kiosco</strong>
          <p>
            Última indexación: <strong>{builtLabel}</strong>
            {meta?.indexed_count != null ? ` · ${meta.indexed_count} rostros` : ''}
            {meta?.failed_count ? ` · ${meta.failed_count} fallidos` : ''}
          </p>
          {pendientes > 0 ? (
            <p className="reloj-facial-index-pend">
              Hay <strong>{pendientes}</strong> foto(s) nueva(s) o cambiada(s). Indexá para que el kiosco las
              reconozca.
            </p>
          ) : (
            <p className="reloj-facial-index-ok">El índice está al día con las fotos de legajo actuales.</p>
          )}
          {indexProgress ? <p className="reloj-facial-index-progress">{indexProgress}</p> : null}
          {indexMsg ? <p className="reloj-facial-index-msg">{indexMsg}</p> : null}
        </div>
        <div className="reloj-facial-index-actions">
          <button
            type="button"
            className="reloj-facial-btn-primary"
            disabled={loading || indexing || conFoto.length === 0}
            onClick={() => void indexarRostros()}
          >
            {indexing ? 'Indexando…' : pendientes > 0 ? `Indexar rostros (${pendientes} nuevos)` : 'Reindexar rostros'}
          </button>
          <button
            type="button"
            className="reloj-facial-btn-ghost"
            onClick={() => void cargar()}
            disabled={loading || indexing}
          >
            {loading ? 'Actualizando…' : 'Actualizar cobertura'}
          </button>
        </div>
      </div>

      {error ? <div className="reloj-facial-error">{error}</div> : null}

      {!loading && sinFoto.length > 0 ? (
        <div className="reloj-facial-sin-foto">
          <h4>Empleados sin foto de legajo</h4>
          <p>Cargá la foto en el legajo del colaborador para habilitar el reconocimiento facial.</p>
          <ul>
            {sinFoto.slice(0, 40).map((e) => (
              <li key={e.id_usuario}>
                <strong>{e.nombre_completo}</strong>
                {e.sector ? <span> · {e.sector}</span> : null}
              </li>
            ))}
          </ul>
          {sinFoto.length > 40 ? (
            <p className="reloj-facial-more">…y {sinFoto.length - 40} más</p>
          ) : null}
        </div>
      ) : null}

      {!loading && sinFoto.length === 0 && empleados.length > 0 ? (
        <div className="reloj-facial-ok">
          Todos los empleados del reloj tienen foto de legajo.
        </div>
      ) : null}

      <div className="reloj-facial-howto">
        <h4>Cómo usarlo</h4>
        <ol>
          <li>
            Configurá el horario fijo en <strong>Horarios reloj</strong> (base de puntualidad/tardanza).
          </li>
          <li>
            Cuando haya fotos nuevas, tocá <strong>Indexar rostros</strong> (solo entonces se procesan las
            fotos; el kiosco no lo hace solo).
          </li>
          <li>Abrí el kiosco facial en una tablet fija (pantalla completa, HTTPS).</li>
          <li>Si no reconoce, el empleado puede usar QR o Manual como respaldo.</li>
        </ol>
      </div>
    </div>
  )
}
