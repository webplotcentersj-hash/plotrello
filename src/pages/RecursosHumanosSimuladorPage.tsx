import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../services/supabaseClient'
import { rrhhLibroSueldosItemsListar, rrhhLibroSueldosObtener } from '../services/rrhhExtendidoService'
import { formatArs2, labelPeriodoMes, parseImporteInput, type RrhhLibroSueldos, type RrhhLibroSueldosItem } from '../utils/rrhhLibroSueldos'
import { simular, totales, type Alta, type Escenario } from '../utils/rrhhSimulador'
import './rrhhExtendido.css'
import './RecursosHumanosSimuladorPage.css'

const ESCENARIO_INICIAL: Escenario = { aumentoPct: 0, categoria: '', sumaRemunerativa: 0, sumaNoRemunerativa: 0, altas: [] }

function Monto({ value, onChange, placeholder }: { value: number; onChange: (n: number) => void; placeholder?: string }) {
  const [txt, setTxt] = useState<string | null>(null)
  return (
    <input
      type="text"
      inputMode="decimal"
      className="sim-input"
      placeholder={placeholder ?? '0'}
      value={txt ?? (value ? value.toLocaleString('es-AR') : '')}
      onFocus={() => setTxt(value ? String(value).replace('.', ',') : '')}
      onChange={(e) => setTxt(e.target.value)}
      onBlur={() => {
        onChange(Math.max(0, parseImporteInput(txt ?? '') ?? 0))
        setTxt(null)
      }}
    />
  )
}

function Delta({ antes, despues }: { antes: number; despues: number }) {
  const d = despues - antes
  if (Math.abs(d) < 0.5) return <span className="sim-delta">sin cambio</span>
  const pct = antes > 0 ? (d / antes) * 100 : null
  return (
    <span className="sim-delta is-up">
      +{formatArs2(d)}
      {pct !== null ? ` (+${pct.toFixed(1)}%)` : ''}
    </span>
  )
}

export default function RecursosHumanosSimuladorPage() {
  const navigate = useNavigate()
  const { usuario, canManageRecursosHumanos, loading: authLoading } = useAuth()
  const canAccess = !!usuario && (canManageRecursosHumanos || usuario.rol === 'gerencia')

  const [periodos, setPeriodos] = useState<string[]>([])
  const [periodo, setPeriodo] = useState<string>('')
  const [libro, setLibro] = useState<RrhhLibroSueldos | null>(null)
  const [items, setItems] = useState<RrhhLibroSueldosItem[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [esc, setEsc] = useState<Escenario>(ESCENARIO_INICIAL)
  const [verDetalle, setVerDetalle] = useState(false)

  useEffect(() => {
    if (!authLoading && !canAccess) navigate('/rrhh')
  }, [authLoading, canAccess, navigate])

  // Períodos con libro guardado; arranca en el más reciente que tenga empleados.
  useEffect(() => {
    if (!supabase || !canAccess) return
    void (async () => {
      const { data, error: e } = await supabase!.from('rrhh_libro_sueldos').select('periodo').order('periodo', { ascending: false }).limit(24)
      if (e) {
        setError(e.message)
        setCargando(false)
        return
      }
      const lista = ((data ?? []) as { periodo: string }[]).map((r) => r.periodo)
      setPeriodos(lista)
      if (!lista.length) setCargando(false)
      for (const p of lista) {
        const lib = await rrhhLibroSueldosObtener(p)
        if (!lib.success || !lib.data) continue
        const its = await rrhhLibroSueldosItemsListar(lib.data.id)
        if (its.success && its.data?.some((i) => i.incluido)) {
          setPeriodo(p)
          return
        }
      }
      if (lista[0]) setPeriodo(lista[0])
    })()
  }, [canAccess])

  useEffect(() => {
    if (!periodo) return
    void (async () => {
      setCargando(true)
      setError(null)
      const lib = await rrhhLibroSueldosObtener(periodo)
      if (!lib.success || !lib.data) {
        setError(lib.error || 'No hay libro para ese período')
        setCargando(false)
        return
      }
      const its = await rrhhLibroSueldosItemsListar(lib.data.id)
      setLibro(lib.data)
      setItems(its.success ? its.data ?? [] : [])
      setCargando(false)
    })()
  }, [periodo])

  const categorias = useMemo(() => [...new Set(items.filter((i) => i.incluido).map((i) => i.categoria || '').filter(Boolean))].sort(), [items])
  const filas = useMemo(() => (libro ? simular({ libro, items, escenario: esc }) : []), [libro, items, esc])
  const tot = useMemo(() => totales(filas), [filas])
  const set = <K extends keyof Escenario>(k: K, v: Escenario[K]) => setEsc((e) => ({ ...e, [k]: v }))
  const setAlta = (id: string, p: Partial<Alta>) => set('altas', esc.altas.map((a) => (a.id === id ? { ...a, ...p } : a)))
  const hayCambios = esc.aumentoPct || esc.sumaRemunerativa || esc.sumaNoRemunerativa || esc.altas.some((a) => a.cantidad > 0 && a.sueldo > 0)

  const tarjeta = (titulo: string, antes: number, despues: number, sub: string) => (
    <article className="sim-kpi">
      <span className="sim-kpi__label">{titulo}</span>
      <strong className="sim-kpi__valor">{formatArs2(despues)}</strong>
      <span className="sim-kpi__antes">hoy {formatArs2(antes)}</span>
      <Delta antes={antes} despues={despues} />
      <span className="sim-kpi__sub">{sub}</span>
    </article>
  )

  return (
    <div className="rrhh-ext-page sim-page">
      <header className="sim-head">
        <div>
          <h1>Simulador de sueldos</h1>
          <p>Probá un aumento, una suma fija o nuevos ingresos y mirá cuánto cambia la masa salarial y el costo, antes de aplicarlo. No modifica nada.</p>
        </div>
        <div className="sim-head__acciones">
          <label>
            Base
            <select value={periodo} onChange={(e) => setPeriodo(e.target.value)} disabled={!periodos.length}>
              {periodos.map((p) => (
                <option key={p} value={p}>
                  Libro {labelPeriodoMes(p)}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="rrhh-ext-btn ghost" onClick={() => setEsc(ESCENARIO_INICIAL)} disabled={!hayCambios}>
            Limpiar
          </button>
          <button type="button" className="rrhh-ext-btn ghost" onClick={() => navigate('/rrhh/libro-sueldos')}>
            Libro de sueldos
          </button>
        </div>
      </header>

      {error && <p className="rrhh-ext-error">{error}</p>}

      {cargando ? (
        <p className="sim-muted">Cargando nómina…</p>
      ) : !libro || !items.some((i) => i.incluido) ? (
        <p className="sim-muted">No hay un Libro de sueldos guardado con empleados para usar de base. Guardá primero un libro desde Libro de sueldos.</p>
      ) : (
        <>
          <section className="sim-panel sim-controles">
            <div className="sim-campo">
              <span>Aumento sobre básico + antigüedad</span>
              <div className="sim-pct">
                <input
                  type="number"
                  className="sim-input"
                  min={0}
                  max={300}
                  step={0.5}
                  value={esc.aumentoPct || ''}
                  placeholder="0"
                  onChange={(e) => set('aumentoPct', Math.max(0, Number(e.target.value) || 0))}
                />
                <span>%</span>
              </div>
              <div className="sim-rapidos">
                {[3, 5, 10, 20].map((p) => (
                  <button key={p} type="button" className={`sim-chip ${esc.aumentoPct === p ? 'is-on' : ''}`} onClick={() => set('aumentoPct', p)}>
                    {p}%
                  </button>
                ))}
              </div>
            </div>
            <label className="sim-campo">
              <span>Aplicar a</span>
              <select value={esc.categoria} onChange={(e) => set('categoria', e.target.value)}>
                <option value="">Todos</option>
                {categorias.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label className="sim-campo">
              <span>Suma fija remunerativa c/u</span>
              <Monto value={esc.sumaRemunerativa} onChange={(n) => set('sumaRemunerativa', n)} />
            </label>
            <label className="sim-campo">
              <span>Suma fija no remunerativa c/u</span>
              <Monto value={esc.sumaNoRemunerativa} onChange={(n) => set('sumaNoRemunerativa', n)} />
            </label>
          </section>

          <section className="sim-panel">
            <div className="sim-panel__cab">
              <strong>Nuevos ingresos</strong>
              <button
                type="button"
                className="rrhh-ext-btn"
                onClick={() => set('altas', [...esc.altas, { id: `a${Date.now()}`, categoria: categorias[0] ?? '', sueldo: 0, cantidad: 1, enConvenio: true }])}
              >
                + Agregar ingreso
              </button>
            </div>
            {esc.altas.length === 0 ? (
              <p className="sim-muted">Sin ingresos simulados.</p>
            ) : (
              esc.altas.map((a) => (
                <div key={a.id} className="sim-alta">
                  <input className="sim-input" type="number" min={1} value={a.cantidad} onChange={(e) => setAlta(a.id, { cantidad: Math.max(0, Number(e.target.value) || 0) })} aria-label="Cantidad" style={{ width: 70 }} />
                  <span>persona(s) en</span>
                  <input className="sim-input" list="sim-categorias" value={a.categoria} onChange={(e) => setAlta(a.id, { categoria: e.target.value })} placeholder="Categoría / sector" />
                  <span>con básico de</span>
                  <Monto value={a.sueldo} onChange={(n) => setAlta(a.id, { sueldo: n })} placeholder="Sueldo básico" />
                  <label>
                    <input type="checkbox" checked={a.enConvenio} onChange={(e) => setAlta(a.id, { enConvenio: e.target.checked })} /> En convenio
                  </label>
                  <button type="button" className="rrhh-ext-btn ghost" onClick={() => set('altas', esc.altas.filter((x) => x.id !== a.id))}>
                    Quitar
                  </button>
                </div>
              ))
            )}
            <datalist id="sim-categorias">
              {categorias.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </section>

          <section className="sim-kpis">
            {tarjeta('Masa salarial bruta', tot.actual.bruto, tot.simulado.bruto, 'remunerativo declarado por mes')}
            {tarjeta('Neto a pagar', tot.actual.neto, tot.simulado.neto, 'lo que cobran por mes')}
            {tarjeta('Contribuciones', tot.actual.contribuciones, tot.simulado.contribuciones, 'cargas del empleador por mes')}
            {tarjeta('Costo laboral mensual', tot.actual.costo, tot.simulado.costo, 'bruto + no remunerativo + contribuciones')}
            {tarjeta('Costo laboral anual', tot.anualActual, tot.anualSimulado, '12 meses + aguinaldo, estimado')}
          </section>

          <section className="sim-panel">
            <div className="sim-panel__cab">
              <strong>Por empleado</strong>
              <button type="button" className="rrhh-ext-btn ghost" onClick={() => setVerDetalle((v) => !v)}>
                {verDetalle ? 'Ocultar' : `Ver ${filas.length} filas`}
              </button>
            </div>
            {verDetalle && (
              <div className="sim-tabla-wrap">
                <table className="sim-tabla">
                  <thead>
                    <tr>
                      <th>Empleado</th>
                      <th>Categoría</th>
                      <th className="num">Bruto hoy</th>
                      <th className="num">Bruto simulado</th>
                      <th className="num">Neto simulado</th>
                      <th className="num">Costo hoy</th>
                      <th className="num">Costo simulado</th>
                      <th className="num">Diferencia de costo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filas.map((f) => (
                      <tr key={f.clave} className={f.esAlta ? 'is-alta' : undefined}>
                        <td>{f.nombre}</td>
                        <td>{f.categoria || '—'}</td>
                        <td className="num">{f.actual ? formatArs2(f.actual.bruto) : '—'}</td>
                        <td className="num">{formatArs2(f.simulado.bruto)}</td>
                        <td className="num">{formatArs2(f.simulado.neto)}</td>
                        <td className="num">{f.actual ? formatArs2(f.actual.costo) : '—'}</td>
                        <td className="num">{formatArs2(f.simulado.costo)}</td>
                        <td className="num">
                          <strong>+{formatArs2(f.simulado.costo - (f.actual?.costo ?? 0))}</strong>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <p className="sim-muted sim-nota">
            Base: libro de {labelPeriodoMes(periodo)}, sólo lo declarado (básico, antigüedad y conceptos fijos cargados a mano). No incluye horas extra,
            inasistencias ni aguinaldo del mes. Las cargas se calculan igual que en el recibo (topes, convenio, jornada parcial). El costo anual estima el
            aguinaldo como un sueldo remunerativo más con sus contribuciones.
          </p>
        </>
      )}
    </div>
  )
}
