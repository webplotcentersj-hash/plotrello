import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ErpPageHeader from '../components/erp/ErpPageHeader'
import { TIPO_LABEL, detectarAnomalias, type Anomalia, type TipoAnomalia } from '../features/gestion/anomalias'
import { listChequesPendientes } from '../services/erpCompromisosApi'
import { facturasCompraEntre, gastosEntre, proveedoresConCuit, sumarDias } from '../services/erpGestionApi'
import { getArgentinaDateString } from '../utils/dateUtils'
import { fmtMoney } from '../utils/erpUi'
import './ErpSectionPage.css'
import './ErpContableAvanzado.css'
import './ErpGestion.css'

const K_DESCARTADAS = 'erp_anomalias_descartadas'
const TONO = { alta: 'danger', media: 'warn', baja: 'info' } as const

export default function ErpAnomaliasPage() {
  const navigate = useNavigate()
  const hoy = getArgentinaDateString()
  const [anomalias, setAnomalias] = useState<Anomalia[] | null>(null)
  const [errores, setErrores] = useState<string[]>([])
  const [tipo, setTipo] = useState<TipoAnomalia | ''>('')
  const [verDescartadas, setVerDescartadas] = useState(false)
  const [descartadas, setDescartadas] = useState<Set<string>>(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem(K_DESCARTADAS) || '[]'))
    } catch {
      return new Set()
    }
  })

  useEffect(() => {
    void (async () => {
      const desde = sumarDias(hoy, -183)
      const [g, c, p, ch] = await Promise.all([gastosEntre(desde, hoy), facturasCompraEntre(desde, hoy), proveedoresConCuit(), listChequesPendientes()])
      const errs: string[] = []
      if (!g.success) errs.push(`Gastos: ${g.error}`)
      if (!c.success) errs.push(`Compras: ${c.error}`)
      if (!p.success) errs.push(`Proveedores: ${p.error}`)
      setErrores(errs)
      setAnomalias(
        detectarAnomalias({
          hoy,
          gastos: g.success ? g.data : [],
          compras: c.success ? c.data : [],
          proveedores: p.success ? p.data : [],
          cheques: ch.success ? ch.data : []
        })
      )
    })()
  }, [hoy])

  const activas = useMemo(() => (anomalias ?? []).filter((a) => verDescartadas || !descartadas.has(a.id)), [anomalias, descartadas, verDescartadas])
  const visibles = activas.filter((a) => !tipo || a.tipo === tipo)
  const conteo = (t: TipoAnomalia) => activas.filter((a) => a.tipo === t).length
  const enJuego = activas.filter((a) => !descartadas.has(a.id) && a.tipo !== 'cuit').reduce((s, a) => s + (a.monto ?? 0), 0)

  const descartar = (id: string) => {
    const n = new Set(descartadas)
    if (n.has(id)) n.delete(id)
    else n.add(id)
    setDescartadas(n)
    localStorage.setItem(K_DESCARTADAS, JSON.stringify([...n]))
  }

  return (
    <div className="erp-section gx">
      <ErpPageHeader icon="🔎" titulo="Errores y anomalías" subtitulo="Revisión automática de los últimos 6 meses: duplicados, montos raros, CUIT y cheques en riesgo." volverA="/erp" volverTexto="ERP" />

      {errores.length > 0 && (
        <div className="gx-banner gx-banner--warn">
          <span className="gx-banner__icono">⚠️</span>
          <div>{errores.join(' · ')}</div>
        </div>
      )}

      {anomalias === null ? (
        <div className="erp-panel">
          <p className="erp-muted">Revisando gastos, compras y cheques…</p>
        </div>
      ) : (
        <>
          <div className="gx-tiles">
            <div className={`gx-tile gx-tile--${activas.some((a) => a.severidad === 'alta' && !descartadas.has(a.id)) ? 'danger' : activas.length ? 'warn' : 'ok'}`}>
              <span className="gx-tile__label">Para revisar</span>
              <span className="gx-tile__valor">{activas.filter((a) => !descartadas.has(a.id)).length}</span>
              <span className="gx-tile__sub">{activas.filter((a) => a.severidad === 'alta' && !descartadas.has(a.id)).length} importantes</span>
            </div>
            <div className="gx-tile gx-tile--info">
              <span className="gx-tile__label">Plata en juego</span>
              <span className="gx-tile__valor">{fmtMoney(enJuego)}</span>
              <span className="gx-tile__sub">si fueran errores reales</span>
            </div>
          </div>

          <div className="gx-controles">
            <div className="gx-chips">
              <button type="button" className={`gx-chip ${tipo === '' ? 'is-on' : ''}`} onClick={() => setTipo('')}>
                Todas ({activas.length})
              </button>
              {(Object.keys(TIPO_LABEL) as TipoAnomalia[]).map((t) => (
                <button key={t} type="button" className={`gx-chip ${tipo === t ? 'is-on' : ''}`} onClick={() => setTipo(t)} disabled={!conteo(t)}>
                  {TIPO_LABEL[t]} ({conteo(t)})
                </button>
              ))}
            </div>
            <label style={{ display: 'inline-flex', gap: 6, alignItems: 'center', fontSize: '0.82rem', color: '#cbd5e1' }}>
              <input type="checkbox" checked={verDescartadas} onChange={(e) => setVerDescartadas(e.target.checked)} />
              Mostrar descartadas ({descartadas.size})
            </label>
          </div>

          {visibles.length === 0 ? (
            <div className="gx-banner gx-banner--ok">
              <span className="gx-banner__icono">✅</span>
              <div>
                <strong>No se encontró nada raro.</strong> Se revisaron gastos, facturas de compra, CUIT de proveedores y cheques en cartera.
              </div>
            </div>
          ) : (
            visibles.map((a) => {
              const desc = descartadas.has(a.id)
              return (
                <div key={a.id} className={`gx-banner gx-banner--${desc ? 'ok' : TONO[a.severidad]}`} style={{ opacity: desc ? 0.55 : 1, alignItems: 'center' }}>
                  <span className={`gx-pill gx-pill--${TONO[a.severidad]}`}>{a.severidad === 'alta' ? 'Importante' : a.severidad === 'media' ? 'Revisar' : 'Info'}</span>
                  <div style={{ flex: 1 }}>
                    <strong>{a.titulo}</strong>
                    <div className="gx-mini" style={{ color: '#cbd5e1' }}>
                      {a.detalle}
                    </div>
                  </div>
                  {a.monto !== null && <strong style={{ whiteSpace: 'nowrap', color: '#f8fafc' }}>{fmtMoney(a.monto)}</strong>}
                  <div className="erp-section-actions">
                    {a.ir && (
                      <button type="button" className="erpx-btn-sm" onClick={() => navigate(a.ir!)}>
                        Revisar →
                      </button>
                    )}
                    <button type="button" className="erpx-btn-sm" onClick={() => descartar(a.id)} title="Marcar como revisado / no es un error">
                      {desc ? 'Restaurar' : 'Está bien'}
                    </button>
                  </div>
                </div>
              )
            })
          )}
          <p className="gx-mini">“Está bien” oculta el aviso en este navegador. Esta pantalla no modifica ningún dato.</p>
        </>
      )}
    </div>
  )
}
