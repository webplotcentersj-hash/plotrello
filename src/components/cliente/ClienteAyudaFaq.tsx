import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { CLIENTE_FAQ_CATEGORIAS, flattenClienteFaqForSearch } from '../../data/clienteAyudaFaq'
import './ClienteAyudaFaq.css'

export default function ClienteAyudaFaq() {
  const [query, setQuery] = useState('')
  const [categoriaActiva, setCategoriaActiva] = useState<string | 'todas'>('todas')

  const q = query.trim().toLowerCase()

  const categoriasFiltradas = useMemo(() => {
    return CLIENTE_FAQ_CATEGORIAS.map((cat) => {
      if (categoriaActiva !== 'todas' && cat.id !== categoriaActiva) {
        return { ...cat, items: [] }
      }
      const items = cat.items.filter((item) => {
        if (!q) return true
        return (
          item.pregunta.toLowerCase().includes(q) ||
          item.respuesta.toLowerCase().includes(q) ||
          cat.titulo.toLowerCase().includes(q)
        )
      })
      return { ...cat, items }
    }).filter((cat) => cat.items.length > 0)
  }, [q, categoriaActiva])

  const totalResultados = categoriasFiltradas.reduce((n, c) => n + c.items.length, 0)
  const totalPreguntas = flattenClienteFaqForSearch().length

  return (
    <section className="cliente-ayuda-faq" aria-labelledby="cliente-ayuda-faq-title">
      <div className="cliente-ayuda-faq__intro">
        <h2 id="cliente-ayuda-faq-title" className="cliente-ayuda-faq__title">
          Preguntas frecuentes
        </h2>
        <p className="cliente-ayuda-faq__lead">
          Guía completa del portal: {totalPreguntas} respuestas sobre pedidos, OP, mockup, mensajes, reclamos y más.
        </p>
      </div>

      <div className="cliente-ayuda-faq__toolbar">
        <label className="cliente-ayuda-faq__search">
          <Search size={18} aria-hidden />
          <input
            type="search"
            placeholder="Buscar en la FAQ…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Buscar en preguntas frecuentes"
          />
        </label>
        <div className="cliente-ayuda-faq__filters" role="tablist" aria-label="Filtrar por tema">
          <button
            type="button"
            role="tab"
            aria-selected={categoriaActiva === 'todas'}
            className={categoriaActiva === 'todas' ? 'active' : ''}
            onClick={() => setCategoriaActiva('todas')}
          >
            Todas
          </button>
          {CLIENTE_FAQ_CATEGORIAS.map((cat) => (
            <button
              key={cat.id}
              type="button"
              role="tab"
              aria-selected={categoriaActiva === cat.id}
              className={categoriaActiva === cat.id ? 'active' : ''}
              onClick={() => setCategoriaActiva(cat.id)}
            >
              {cat.titulo}
            </button>
          ))}
        </div>
      </div>

      {totalResultados === 0 ? (
        <p className="cliente-ayuda-faq__empty">No hay resultados para “{query}”. Probá otra palabra o elegí Todas.</p>
      ) : (
        <div className="cliente-ayuda-faq__categories">
          {categoriasFiltradas.map((cat) => (
            <div key={cat.id} className="cliente-ayuda-faq__category">
              <h3 className="cliente-ayuda-faq__category-title">{cat.titulo}</h3>
              {cat.descripcion ? <p className="cliente-ayuda-faq__category-desc">{cat.descripcion}</p> : null}
              <div className="cliente-ayuda-faq__list">
                {cat.items.map((item) => (
                  <details key={item.id} className="cliente-ayuda-faq__item" name={`faq-${cat.id}`}>
                    <summary>{item.pregunta}</summary>
                    <div className="cliente-ayuda-faq__answer">
                      <p>{item.respuesta}</p>
                    </div>
                  </details>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
