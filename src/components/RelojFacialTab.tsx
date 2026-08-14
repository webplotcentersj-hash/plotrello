import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { plotLabFetch } from '../utils/plotLabApiOrigin'
import { getStaffAuthToken } from '../services/staffSession'
import apiService from '../services/api'
import {
  buildFaceGallery,
  countPendingFacialIndex,
  employeeFotoUrls,
  gallerySigFromEmpleados
} from '../tablet-reloj/services/faceLocalMatch'
import type { EmpleadoRelojTablet } from '../tablet-reloj/services/relojTabletApi'
import './RelojFacialTab.css'

const MAX_EXTRA = 2

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

type FotoExtraRow = {
  id: number
  id_usuario: number
  foto_url: string
  foto_key: string
  created_at?: string
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
  const [extras, setExtras] = useState<FotoExtraRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [meta, setMeta] = useState<IndiceMeta | null>(null)
  const [indexedRows, setIndexedRows] = useState<IndiceResumenRow[]>([])
  const [indexing, setIndexing] = useState(false)
  const [indexProgress, setIndexProgress] = useState('')
  const [indexMsg, setIndexMsg] = useState('')
  const [filtroExtra, setFiltroExtra] = useState('')
  const [uploadingId, setUploadingId] = useState<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const uploadTargetRef = useRef<number | null>(null)

  const authHeaders = useCallback((): HeadersInit => {
    const token = getStaffAuthToken()
    return token ? { Authorization: `Bearer ${token}` } : {}
  }, [])

  const extrasByUser = useMemo(() => {
    const map = new Map<number, FotoExtraRow[]>()
    for (const row of extras) {
      const list = map.get(row.id_usuario) || []
      list.push(row)
      map.set(row.id_usuario, list)
    }
    return map
  }, [extras])

  const cargar = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [empResp, idxResp, extraResp] = await Promise.all([
        plotLabFetch('/api/rrhh/reloj-tablet-empleados', { headers: authHeaders() }),
        plotLabFetch('/api/rrhh/facial-indice', { headers: authHeaders() }),
        plotLabFetch('/api/rrhh/facial-fotos-extra', { headers: authHeaders() })
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
      const extraJson = (await extraResp.json()) as {
        success?: boolean
        fotos?: FotoExtraRow[]
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
      if (extraResp.ok && extraJson.success) {
        setExtras(extraJson.fotos ?? [])
      } else {
        setExtras([])
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error de conexión')
      setEmpleados([])
      setMeta(null)
      setIndexedRows([])
      setExtras([])
    } finally {
      setLoading(false)
    }
  }, [authHeaders])

  useEffect(() => {
    void cargar()
  }, [cargar])

  const empleadosConFotos = useMemo(() => {
    return empleados.map((e) => ({
      ...e,
      fotos_extra: (extrasByUser.get(e.id_usuario) || []).map((x) => x.foto_url)
    }))
  }, [empleados, extrasByUser])

  const { conFoto, sinFoto, pct, pendientes } = useMemo(() => {
    const con = empleadosConFotos.filter(
      (e) => e.tiene_foto_legajo || employeeFotoUrls(e).length > 0
    )
    const sin = empleadosConFotos.filter(
      (e) => !(e.tiene_foto_legajo || Boolean(e.foto_url?.trim()))
    )
    const total = empleados.length
    return {
      conFoto: con,
      sinFoto: sin,
      pct: total ? Math.round(((total - sin.length) / total) * 100) : 0,
      pendientes: countPendingFacialIndex(con, indexedRows)
    }
  }, [empleados.length, empleadosConFotos, indexedRows])

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
        tiene_foto_legajo: e.tiene_foto_legajo,
        fotos_extra: e.fotos_extra
      }))

      setIndexProgress('Cargando modelos face-api…')
      const stats = await buildFaceGallery(asTablet, (done, total) =>
        setIndexProgress(`Indexando ${done}/${total} foto(s)…`)
      )

      setIndexProgress('Guardando índice en el servidor…')
      const putResp = await plotLabFetch('/api/rrhh/facial-indice', {
        method: 'PUT',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          descriptores: stats.records,
          failed_count: stats.failed,
          total_fotos: stats.records.length,
          signature: gallerySigFromEmpleados(asTablet)
        })
      })
      const putJson = (await putResp.json()) as {
        success?: boolean
        indexed?: number
        descriptores?: number
        error?: string
      }
      if (!putResp.ok || !putJson.success) {
        throw new Error(putJson.error || 'No se pudo guardar el índice')
      }

      const nDesc = putJson.descriptores ?? stats.records.length
      const nPers = putJson.indexed ?? stats.indexed
      setIndexMsg(
        stats.failed
          ? `Índice: ${nPers} personas · ${nDesc} fotos (${stats.failed} sin rostro legible).`
          : `Índice: ${nPers} personas · ${nDesc} fotos listas para el kiosco.`
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

  const abrirUploadExtra = (idUsuario: number) => {
    uploadTargetRef.current = idUsuario
    fileInputRef.current?.click()
  }

  const onFileExtra = async (fileList: FileList | null) => {
    const idUsuario = uploadTargetRef.current
    const file = fileList?.[0]
    uploadTargetRef.current = null
    if (fileInputRef.current) fileInputRef.current.value = ''
    if (!idUsuario || !file) return

    const actuales = extrasByUser.get(idUsuario)?.length ?? 0
    if (actuales >= MAX_EXTRA) {
      setError(`Máximo ${MAX_EXTRA} fotos extra por persona (además del legajo).`)
      return
    }

    setUploadingId(idUsuario)
    setError('')
    try {
      const up = await apiService.uploadFotoEmpleado(file, idUsuario)
      if (!up.success || !up.data) throw new Error(up.error || 'No se pudo subir la foto')

      const resp = await plotLabFetch('/api/rrhh/facial-fotos-extra', {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_usuario: idUsuario, foto_url: up.data })
      })
      const json = (await resp.json()) as { success?: boolean; error?: string }
      if (!resp.ok || !json.success) throw new Error(json.error || 'No se pudo guardar la foto extra')
      setIndexMsg('Foto extra agregada. Tocá “Indexar rostros” para que el kiosco la use.')
      await cargar()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al subir foto extra')
    } finally {
      setUploadingId(null)
    }
  }

  const borrarExtra = async (id: number) => {
    if (!window.confirm('¿Quitar esta foto extra del enrolamiento?')) return
    setError('')
    try {
      const resp = await plotLabFetch('/api/rrhh/facial-fotos-extra', {
        method: 'DELETE',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      })
      const json = (await resp.json()) as { success?: boolean; error?: string }
      if (!resp.ok || !json.success) throw new Error(json.error || 'No se pudo borrar')
      setIndexMsg('Foto extra quitada. Reindexá para actualizar el kiosco.')
      await cargar()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al borrar')
    }
  }

  const listaEnrolamiento = useMemo(() => {
    const q = filtroExtra.trim().toLowerCase()
    const rows = conFoto.slice().sort((a, b) => a.nombre_completo.localeCompare(b.nombre_completo, 'es'))
    if (!q) return rows.slice(0, 40)
    return rows
      .filter(
        (e) =>
          e.nombre_completo.toLowerCase().includes(q) ||
          e.login.toLowerCase().includes(q) ||
          e.sector.toLowerCase().includes(q)
      )
      .slice(0, 40)
  }, [conFoto, filtroExtra])

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
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        hidden
        onChange={(e) => void onFileExtra(e.target.files)}
      />

      <div className="reloj-facial-hero">
        <div>
          <h3>Reloj con reconocimiento facial</h3>
          <p>
            Podés cargar hasta <strong>{MAX_EXTRA} fotos extra</strong> por persona (ángulos distintos),
            además de la de legajo. Después tocá <strong>Indexar rostros</strong>. Si el sistema duda
            entre dos parecidos, pide QR. Entrada/tardanza: <strong>Horarios reloj</strong>.
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
          <span className="reloj-facial-stat-label">Personas indexadas</span>
        </div>
        <div className="reloj-facial-stat">
          <span className="reloj-facial-stat-value">{loading ? '…' : meta?.total_fotos ?? indexedRows.length}</span>
          <span className="reloj-facial-stat-label">Fotos en índice</span>
        </div>
        <div className={`reloj-facial-stat${pendientes > 0 ? ' reloj-facial-stat--warn' : ''}`}>
          <span className="reloj-facial-stat-value">{loading ? '…' : pendientes}</span>
          <span className="reloj-facial-stat-label">Pendientes de indexar</span>
        </div>
        <div className="reloj-facial-stat">
          <span className="reloj-facial-stat-value">{loading ? '…' : `${pct}%`}</span>
          <span className="reloj-facial-stat-label">Cobertura foto</span>
        </div>
        <div className="reloj-facial-stat">
          <span className="reloj-facial-stat-value">{loading ? '…' : extras.length}</span>
          <span className="reloj-facial-stat-label">Fotos extra</span>
        </div>
      </div>

      <div className="reloj-facial-index-panel">
        <div>
          <strong>Índice facial del kiosco</strong>
          <p>
            Última indexación: <strong>{builtLabel}</strong>
            {meta?.indexed_count != null ? ` · ${meta.indexed_count} personas` : ''}
            {meta?.total_fotos != null ? ` · ${meta.total_fotos} fotos` : ''}
            {meta?.failed_count ? ` · ${meta.failed_count} fallidos` : ''}
          </p>
          {pendientes > 0 ? (
            <p className="reloj-facial-index-pend">
              Hay <strong>{pendientes}</strong> foto(s) nueva(s) o cambiada(s). Indexá para que el kiosco las
              reconozca.
            </p>
          ) : (
            <p className="reloj-facial-index-ok">El índice está al día con legajo + fotos extra.</p>
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

      <div className="reloj-facial-enrol">
        <div className="reloj-facial-enrol__head">
          <div>
            <h4>Enrolamiento — fotos extra</h4>
            <p>
              Ideal: 1 de frente (legajo) + 1 levemente de lado + 1 con otra luz. Máx. {MAX_EXTRA} extras.
            </p>
          </div>
          <input
            type="search"
            className="reloj-facial-enrol__search"
            placeholder="Buscar empleado…"
            value={filtroExtra}
            onChange={(e) => setFiltroExtra(e.target.value)}
          />
        </div>
        <ul className="reloj-facial-enrol__list">
          {listaEnrolamiento.map((e) => {
            const extrasEmp = extrasByUser.get(e.id_usuario) || []
            const totalFotos = 1 + extrasEmp.length
            return (
              <li key={e.id_usuario} className="reloj-facial-enrol__row">
                <div className="reloj-facial-enrol__person">
                  {e.foto_url ? (
                    <img src={e.foto_url} alt="" className="reloj-facial-enrol__thumb" />
                  ) : (
                    <span className="reloj-facial-enrol__thumb reloj-facial-enrol__thumb--empty" />
                  )}
                  <div>
                    <strong>{e.nombre_completo}</strong>
                    <span>
                      {e.sector ? `${e.sector} · ` : ''}
                      {totalFotos} foto{totalFotos === 1 ? '' : 's'}
                    </span>
                  </div>
                </div>
                <div className="reloj-facial-enrol__extras">
                  {extrasEmp.map((f) => (
                    <div key={f.id} className="reloj-facial-enrol__extra">
                      <img src={f.foto_url} alt="" />
                      <button
                        type="button"
                        className="reloj-facial-enrol__x"
                        title="Quitar"
                        onClick={() => void borrarExtra(f.id)}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  {extrasEmp.length < MAX_EXTRA ? (
                    <button
                      type="button"
                      className="reloj-facial-btn-ghost reloj-facial-enrol__add"
                      disabled={uploadingId === e.id_usuario || indexing}
                      onClick={() => abrirUploadExtra(e.id_usuario)}
                    >
                      {uploadingId === e.id_usuario ? 'Subiendo…' : '+ Foto'}
                    </button>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ul>
        {conFoto.length > 40 && !filtroExtra.trim() ? (
          <p className="reloj-facial-more">Mostrando 40. Usá el buscador para el resto.</p>
        ) : null}
      </div>

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
        <div className="reloj-facial-ok">Todos los empleados del reloj tienen foto de legajo.</div>
      ) : null}

      <div className="reloj-facial-howto">
        <h4>Cómo usarlo</h4>
        <ol>
          <li>Configurá el horario fijo en <strong>Horarios reloj</strong>.</li>
          <li>
            Sumá fotos extra a quienes se confunden (Ivero/Lolmos, etc.) y tocá{' '}
            <strong>Indexar rostros</strong>.
          </li>
          <li>Abrí el kiosco facial en una tablet fija (pantalla completa, HTTPS).</li>
          <li>Si no reconoce, el empleado usa QR o Manual.</li>
        </ol>
      </div>
    </div>
  )
}
