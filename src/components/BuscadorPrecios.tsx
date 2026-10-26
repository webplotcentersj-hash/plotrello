import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import apiService from '../services/api'
import type { ArticuloEmpresaRecord } from '../types/api'
import {
  DEFAULT_AJUSTES_PRECIOS_VENTAS,
  LISTAS_PRECIO_VENTAS,
  normalizarConfigAjustesPrecios,
  resolvePrecioLista,
  type ConfigAjustesPreciosVentas,
  type TipoListaPrecioVentas
} from '../constants/ventasListasPrecio'
import { etiquetaUnidadCorta } from '../utils/unidadPrecio'
import './BuscadorPrecios.css'

function sinAcentos(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function pesos(n: number): string {
  return `$${n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function BuscadorPrecios() {
  const [abierto, setAbierto] = useState(false)
  const [consulta, setConsulta] = useState('')
  const [rubro, setRubro] = useState('todos')
  const [lista, setLista] = useState<TipoListaPrecioVentas>('lista_1')
  const [articulos, setArticulos] = useState<ArticuloEmpresaRecord[]>([])
  const [ajustes, setAjustes] = useState<ConfigAjustesPreciosVentas>(DEFAULT_AJUSTES_PRECIOS_VENTAS)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!abierto || articulos.length > 0) return
    let cancelado = false
    setCargando(true)
    setError(null)
    void (async () => {
      try {
        const [catalogo, config] = await Promise.all([
          apiService.getArticulosEmpresa(undefined, false),
          apiService.getConfiguracionPreciosVentas()
        ])
        if (cancelado) return
        if (!catalogo.success || !catalogo.data) {
          setError(catalogo.error || 'No se pudo cargar la lista de precios')
          return
        }
        setArticulos(catalogo.data.filter((a) => a.activo && !a.codigo?.startsWith('ART-')))
        if (config.success && config.data) setAjustes(normalizarConfigAjustesPrecios(config.data))
      } catch (ex) {
        if (!cancelado) setError(ex instanceof Error ? ex.message : 'No se pudo cargar la lista de precios')
      } finally {
        if (!cancelado) setCargando(false)
      }
    })()
    return () => {
      cancelado = true
    }
  }, [abierto, articulos.length])

  useEffect(() => {
    const abrir = () => setAbierto(true)
    window.addEventListener('plotlab-abrir-precios', abrir)
    return () => window.removeEventListener('plotlab-abrir-precios', abrir)
  }, [])

  useEffect(() => {
    if (!abierto) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setAbierto(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [abierto])

  const rubros = useMemo(() => {
    const set = new Set<string>()
    for (const articulo of articulos) {
      const nombre = articulo.categoria?.trim()
      if (nombre) set.add(nombre)
    }
    return [...set].sort((a, b) => a.localeCompare(b, 'es'))
  }, [articulos])

  const resultados = useMemo(() => {
    const q = sinAcentos(consulta.trim())
    const tokens = q.split(/\s+/).filter(Boolean)
    const filtrados = articulos.filter((articulo) => {
      if (rubro !== 'todos' && (articulo.categoria?.trim() || '') !== rubro) return false
      if (tokens.length === 0) return true
      const texto = sinAcentos(
        [articulo.codigo, articulo.nombre, articulo.descripcion, articulo.categoria].filter(Boolean).join(' ')
      )
      return tokens.every((token) => texto.includes(token))
    })
    return filtrados
      .map((articulo) => ({ articulo, precio: resolvePrecioLista(articulo, lista, ajustes) }))
      .sort((a, b) => {
        const pa = a.precio == null ? 1 : 0
        const pb = b.precio == null ? 1 : 0
        if (pa !== pb) return pa - pb
        return a.articulo.nombre.localeCompare(b.articulo.nombre, 'es')
      })
  }, [ajustes, articulos, consulta, lista, rubro])

  const meta = LISTAS_PRECIO_VENTAS[lista]

  return (
    <>
      <div className="buscador-precios-slot">
        <label className="buscador-precios-slot__label" htmlFor="buscador-precios">
          Precios
        </label>
        <input
          id="buscador-precios"
          type="search"
          className="buscador-precios-slot__input"
          placeholder="LP · Buscar precio por código, nombre o rubro…"
          value={consulta}
          onChange={(event) => {
            setConsulta(event.target.value)
            setAbierto(true)
          }}
          onFocus={() => setAbierto(true)}
          autoComplete="off"
        />
      </div>

      {abierto &&
        createPortal(
          <div className="buscador-precios-capa" role="presentation" onMouseDown={() => setAbierto(false)}>
            <section
              className="buscador-precios"
              role="dialog"
              aria-modal="true"
              aria-label="Lista de precios"
              onMouseDown={(event) => event.stopPropagation()}
            >
              <header className="buscador-precios__head">
                <div>
                  <p className="buscador-precios__eyebrow">Lista de precios</p>
                  <h2>{meta.label}</h2>
                  <p className="buscador-precios__sub">{meta.subtitle}</p>
                </div>
                <button type="button" className="buscador-precios__cerrar" onClick={() => setAbierto(false)}>
                  Cerrar
                </button>
              </header>

              <div className="buscador-precios__controles">
                <input
                  type="search"
                  className="buscador-precios__buscar"
                  placeholder="Código, nombre o rubro"
                  value={consulta}
                  onChange={(event) => setConsulta(event.target.value)}
                  autoFocus
                />
                <div className="buscador-precios__listas" role="tablist">
                  {(Object.keys(LISTAS_PRECIO_VENTAS) as TipoListaPrecioVentas[]).map((id) => (
                    <button
                      key={id}
                      type="button"
                      role="tab"
                      aria-selected={lista === id}
                      className={lista === id ? 'is-on' : ''}
                      onClick={() => setLista(id)}
                    >
                      {LISTAS_PRECIO_VENTAS[id].label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="buscador-precios__rubros">
                <button type="button" className={rubro === 'todos' ? 'is-on' : ''} onClick={() => setRubro('todos')}>
                  Todos
                </button>
                {rubros.map((nombre) => (
                  <button
                    key={nombre}
                    type="button"
                    className={rubro === nombre ? 'is-on' : ''}
                    onClick={() => setRubro(nombre)}
                  >
                    {nombre}
                  </button>
                ))}
              </div>

              <p className="buscador-precios__cuenta">
                {cargando ? 'Cargando precios…' : `${resultados.length} artículo${resultados.length === 1 ? '' : 's'}`}
              </p>

              {error && <p className="buscador-precios__error">{error}</p>}

              <div className="buscador-precios__grilla">
                {resultados.map(({ articulo, precio }) => (
                  <article key={articulo.id} className="precio-card">
                    <div className="precio-card__top">
                      <span className="precio-card__codigo">{articulo.codigo}</span>
                      <span className="precio-card__unidad">{etiquetaUnidadCorta(articulo.unidad_medida)}</span>
                    </div>
                    <h3>{articulo.nombre}</h3>
                    {articulo.categoria && <p className="precio-card__rubro">{articulo.categoria}</p>}
                    <p className="precio-card__precio">{precio == null || precio === 0 ? 'Sin precio' : pesos(precio)}</p>
                  </article>
                ))}
              </div>
            </section>
          </div>,
          document.body
        )}
    </>
  )
}
