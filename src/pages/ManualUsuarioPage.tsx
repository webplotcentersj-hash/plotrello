import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { marked } from 'marked'
import { sanitizeHtml } from '../utils/sanitizeHtml'
import './ManualUsuarioPage.css'

type TocItem = {
  id: string
  title: string
  level: number
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
}

function extractToc(markdown: string): TocItem[] {
  const items: TocItem[] = []
  for (const line of markdown.split('\n')) {
    const match = line.match(/^(#{2,3})\s+(.+)/)
    if (!match) continue
    const title = match[2].replace(/\*\*/g, '').trim()
    if (!title || title === 'Tabla de Contenidos') continue
    items.push({ id: slugify(title), title, level: match[1].length })
  }
  return items
}

function renderMarkdown(markdown: string): string {
  const renderer = new marked.Renderer()
  renderer.heading = ({ text, depth }) => {
    const plain = String(text).replace(/<[^>]+>/g, '')
    const id = slugify(plain)
    return `<h${depth} id="${id}" class="manual-heading manual-heading--${depth}">${text}</h${depth}>`
  }
  renderer.link = ({ href, title, text }) => {
    const safeHref = String(href || '#')
    const isExternal = /^https?:\/\//i.test(safeHref)
    const attrs = isExternal ? ' target="_blank" rel="noopener noreferrer"' : ''
    const titleAttr = title ? ` title="${title}"` : ''
    return `<a href="${safeHref}"${titleAttr}${attrs}>${text}</a>`
  }
  renderer.table = (token) => {
    const header = token.header
      .map((cell) => `<th>${cell.text}</th>`)
      .join('')
    const body = token.rows
      .map((row) => `<tr>${row.map((cell) => `<td>${cell.text}</td>`).join('')}</tr>`)
      .join('')
    return `<div class="manual-table-wrap"><table><thead><tr>${header}</tr></thead><tbody>${body}</tbody></table></div>`
  }

  marked.setOptions({ gfm: true, breaks: false })
  const html = marked.parse(markdown, { async: false, renderer }) as string
  return sanitizeHtml(html)
}

const ManualUsuarioPage = () => {
  const navigate = useNavigate()
  const [markdown, setMarkdown] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [activeId, setActiveId] = useState('')
  const [navOpen, setNavOpen] = useState(false)

  useEffect(() => {
    const href =
      'https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,600;0,9..40,700;0,9..40,800&display=swap'
    if (!document.querySelector(`link[href="${href}"]`)) {
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = href
      document.head.appendChild(link)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const resp = await fetch('/MANUAL_USUARIO.md')
        if (!resp.ok) throw new Error(`No se pudo cargar el manual (${resp.status})`)
        const text = await resp.text()
        if (!cancelled) setMarkdown(text)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Error cargando manual')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const toc = useMemo(() => extractToc(markdown), [markdown])

  const filteredToc = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return toc
    return toc.filter((item) => item.title.toLowerCase().includes(q))
  }, [toc, query])

  const html = useMemo(() => (markdown ? renderMarkdown(markdown) : ''), [markdown])

  useEffect(() => {
    if (!toc.length) return
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)
        if (visible[0]?.target?.id) setActiveId(visible[0].target.id)
      },
      { rootMargin: '-20% 0px -65% 0px', threshold: [0, 0.25, 0.5, 1] }
    )

    toc.forEach((item) => {
      const el = document.getElementById(item.id)
      if (el) observer.observe(el)
    })
    return () => observer.disconnect()
  }, [toc, html])

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setNavOpen(false)
  }

  const downloadMd = () => {
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'MANUAL_PLOTLAB.md'
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <div className="manual-page">
        <div className="manual-loading">
          <span className="manual-spinner" aria-hidden />
          <p>Cargando manual…</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="manual-page">
        <div className="manual-error">
          <h1>No se pudo cargar el manual</h1>
          <p>{error}</p>
          <button type="button" className="manual-btn" onClick={() => navigate('/')}>
            Volver al tablero
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="manual-page">
      <header className="manual-topbar no-print">
        <div className="manual-topbar-left">
          <button type="button" className="manual-btn manual-btn--ghost" onClick={() => setNavOpen((v) => !v)}>
            ☰ Índice
          </button>
          <div>
            <strong className="manual-brand">PlotLab</strong>
            <span className="manual-brand-sub">Manual de usuario</span>
          </div>
        </div>
        <div className="manual-topbar-actions">
          <input
            type="search"
            className="manual-search"
            placeholder="Buscar en el índice…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button type="button" className="manual-btn manual-btn--ghost" onClick={downloadMd}>
            Descargar .md
          </button>
          <button type="button" className="manual-btn manual-btn--ghost" onClick={() => window.print()}>
            Imprimir
          </button>
          <button type="button" className="manual-btn" onClick={() => navigate('/')}>
            Volver
          </button>
        </div>
      </header>

      <div className="manual-layout">
        <aside className={`manual-sidebar no-print${navOpen ? ' manual-sidebar--open' : ''}`}>
          <p className="manual-sidebar-label">Contenidos</p>
          <nav className="manual-toc">
            {filteredToc.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`manual-toc-item manual-toc-item--l${item.level}${activeId === item.id ? ' manual-toc-item--active' : ''}`}
                onClick={() => scrollTo(item.id)}
              >
                {item.title}
              </button>
            ))}
            {filteredToc.length === 0 && <p className="manual-toc-empty">Sin resultados</p>}
          </nav>
        </aside>

        {navOpen && (
          <button
            type="button"
            className="manual-sidebar-backdrop no-print"
            aria-label="Cerrar índice"
            onClick={() => setNavOpen(false)}
          />
        )}

        <main className="manual-main">
          <section className="manual-cover">
            <p className="manual-cover-kicker">Plot Center · PlotLab</p>
            <h1>Manual de usuario</h1>
            <p className="manual-cover-lead">
              Guía actualizada para el equipo: tablero, sectores, PlotAI, diseño, ventas y herramientas web.
            </p>
            <div className="manual-cover-pills">
              <span>Junio 2026</span>
              <span>Kanban + IA</span>
              <span>Multi-sector</span>
            </div>
          </section>

          <article className="manual-article manual-prose" dangerouslySetInnerHTML={{ __html: html }} />
        </main>
      </div>
    </div>
  )
}

export default ManualUsuarioPage
