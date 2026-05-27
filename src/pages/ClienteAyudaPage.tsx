import { useNavigate } from 'react-router-dom'
import { useClienteAuth } from '../hooks/useClienteAuth'
import ClientePageLayout from '../components/cliente/ClientePageLayout'
import ClientePageHeader from '../components/cliente/ClientePageHeader'
import './ClienteAyudaPage.css'

const HERRAMIENTAS = [
  {
    icon: '🔍',
    title: 'Buscar mi OP',
    desc: 'Seguí el estado de tu orden de trabajo por número.',
    path: '/cliente/buscar-op',
    external: false
  },
  {
    icon: '✍️',
    title: 'Firma y calificación al retirar',
    desc: 'Cuando te avisemos que está listo, firmá y contanos cómo estuvo el trabajo (desde el link que te den en mostrador).',
    path: '/cliente/dashboard',
    hint: 'También aparece en “Listos para retirar” en tu inicio.',
    external: false
  },
  {
    icon: '📢',
    title: 'Reclamos',
    desc: 'Reportá un problema con tu pedido u OP. Podés adjuntar foto.',
    path: '/cliente/reclamos',
    external: false
  },
  {
    icon: '🤖',
    title: 'Chat PlotAI',
    desc: 'Consultá dudas sobre tus trabajos con el asistente.',
    path: '/cliente/chat',
    external: false
  },
  {
    icon: '💬',
    title: 'Mensajes por pedido',
    desc: 'Escribile al equipo sobre un pedido web.',
    path: '/cliente/mensajes',
    external: false
  },
  {
    icon: '⭐',
    title: 'Encuesta de satisfacción',
    desc: 'Valorá la atención en Plot Center (anónima, rápida).',
    path: '/satisfaccion-cliente',
    external: true
  },
  {
    icon: '📋',
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
          {HERRAMIENTAS.map((h) => (
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
              <span className="cliente-ayuda-card-icon">{h.icon}</span>
              <h3>{h.title}</h3>
              <p>{h.desc}</p>
              {h.hint ? <p className="cliente-ayuda-card-hint">{h.hint}</p> : null}
            </button>
          ))}
        </div>
      </div>
    </ClientePageLayout>
  )
}
