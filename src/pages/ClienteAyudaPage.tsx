import type { LucideIcon } from 'lucide-react'
import {
  Bot,
  ClipboardList,
  ExternalLink,
  FileText,
  MessageCircle,
  PenLine,
  Search,
  Star
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useClienteAuth } from '../hooks/useClienteAuth'
import ClientePageLayout from '../components/cliente/ClientePageLayout'
import ClientePageHeader from '../components/cliente/ClientePageHeader'
import './ClienteAyudaPage.css'

const HERRAMIENTAS: {
  Icon: LucideIcon
  title: string
  desc: string
  path: string
  hint?: string
  external?: boolean
}[] = [
  {
    Icon: Search,
    title: 'Buscar mi OP',
    desc: 'Seguí el estado de tu orden de trabajo por número.',
    path: '/cliente/buscar-op'
  },
  {
    Icon: PenLine,
    title: 'Firma y calificación al retirar',
    desc: 'Cuando te avisemos que está listo, firmá y contanos cómo estuvo el trabajo.',
    path: '/cliente/dashboard',
    hint: 'También en “Listos para retirar” en tu inicio.'
  },
  {
    Icon: FileText,
    title: 'Reclamos',
    desc: 'Reportá un problema con tu pedido u OP. Podés adjuntar foto.',
    path: '/cliente/reclamos'
  },
  {
    Icon: Bot,
    title: 'Chat PlotAI',
    desc: 'Consultá dudas sobre tus trabajos con el asistente.',
    path: '/cliente/chat'
  },
  {
    Icon: MessageCircle,
    title: 'Mensajes por pedido',
    desc: 'Escribile al equipo sobre un pedido web.',
    path: '/cliente/mensajes'
  },
  {
    Icon: Star,
    title: 'Encuesta de satisfacción',
    desc: 'Valorá la atención en Plot Center (anónima, rápida).',
    path: '/satisfaccion-cliente',
    external: true
  },
  {
    Icon: ClipboardList,
    title: 'Reclamo sin cuenta',
    desc: 'Formulario público si no podés ingresar.',
    path: '/reclamos',
    external: true
  }
]

export default function ClienteAyudaPage() {
  const navigate = useNavigate()
  const { cliente } = useClienteAuth()

  return (
    <ClientePageLayout className="cliente-ayuda-page">
      <ClientePageHeader
        eyebrow="Atención al cliente"
        title="Centro de ayuda"
        subtitle={`Herramientas de seguimiento${cliente?.nombre ? ` · ${cliente.nombre}` : ''}`}
      />

      <div className="cliente-ayuda-main">
        <p className="cliente-ayuda-lead">
          Acá reunimos todo lo que podés usar para consultar trabajos, comunicarte con Plot Center y dejar tu opinión
          después de retirar.
        </p>
        <div className="cliente-ayuda-grid">
          {HERRAMIENTAS.map((h) => {
            const Icon = h.Icon
            return (
              <button
                key={h.path + h.title}
                type="button"
                className="cliente-page-card cliente-ayuda-card"
                onClick={() => {
                  if (h.external) {
                    window.open(h.path, '_blank', 'noopener,noreferrer')
                  } else {
                    navigate(h.path)
                  }
                }}
              >
                <span className="cliente-icon-wrap cliente-ayuda-card-icon" aria-hidden>
                  <Icon size={22} strokeWidth={2} />
                </span>
                <h3>
                  {h.title}
                  {h.external ? <ExternalLink className="cliente-ayuda-external" size={14} aria-hidden /> : null}
                </h3>
                <p>{h.desc}</p>
                {h.hint ? <p className="cliente-ayuda-card-hint">{h.hint}</p> : null}
              </button>
            )
          })}
        </div>
      </div>
    </ClientePageLayout>
  )
}
