import { useMemo } from 'react'
import type { Task, TaskStatus } from '../types/board'
import { buildWhatsappLink } from '../utils/whatsappLink'
import './EntregasSinRetiroPanel.css'

/** Columnas de entrega: terminado y esperando retiro. */
const ESTADOS_ENTREGA: TaskStatus[] = ['finalizado-taller', 'almacen-entrega']

/** Días en entrega a partir de los cuales se advierte descarte por espacio. */
export const DIAS_SIN_RETIRO_DESECHO = 30

const UN_DIA_MS = 86_400_000

type Props = {
  tasks: Task[]
  onSelectTask?: (taskId: string) => void
}

function diasEnEntrega(task: Task, ahora: number): number | null {
  const movida = task.uiMovedAt ?? (task.updatedAt ? Date.parse(task.updatedAt) : Number.NaN)
  if (!Number.isFinite(movida)) return null
  return Math.floor((ahora - movida) / UN_DIA_MS)
}

function mensajeDesechoWhatsApp(task: Task): string {
  const op = task.opNumber?.trim() || 'tu trabajo'
  const cliente =
    task.clienteNombreCompleto?.trim() || task.title?.trim() || ''
  const saludo = cliente ? `Hola ${cliente}` : 'Hola'
  return (
    `${saludo}, te escribimos de Plot Center. ` +
    `Tu trabajo (OP ${op}) lleva más de ${DIAS_SIN_RETIRO_DESECHO} días listo para retirar. ` +
    `Por falta de espacio en depósito, si no lo retirás a la brevedad será desechado. ` +
    `Por favor acercate a buscarlo o respondé este mensaje para coordinar. ¡Gracias!`
  )
}

function whatsappHref(task: Task): string | undefined {
  const message = mensajeDesechoWhatsApp(task)
  const fromUrl = task.whatsappUrl?.trim()
  if (fromUrl) {
    try {
      const u = new URL(fromUrl)
      u.searchParams.set('text', message)
      return u.toString()
    } catch {
      /* fall through */
    }
  }
  return buildWhatsappLink(task.clientPhone, message)
}

const EntregasSinRetiroPanel = ({ tasks, onSelectTask }: Props) => {
  const vencidas = useMemo(() => {
    const ahora = Date.now()
    const list: Array<{ task: Task; dias: number; wa: string | undefined }> = []
    for (const task of tasks) {
      if (!ESTADOS_ENTREGA.includes(task.status)) continue
      const dias = diasEnEntrega(task, ahora)
      if (dias == null || dias < DIAS_SIN_RETIRO_DESECHO) continue
      list.push({ task, dias, wa: whatsappHref(task) })
    }
    list.sort((a, b) => b.dias - a.dias)
    return list
  }, [tasks])

  return (
    <section className="entregas-sin-retiro" aria-label="Trabajos con más de 30 días sin retirar">
      <header className="entregas-sin-retiro__head">
        <p className="entregas-sin-retiro__eyebrow">SIN RETIRO +{DIAS_SIN_RETIRO_DESECHO} DÍAS</p>
        <h3>Riesgo de desecho por espacio</h3>
        <p className="entregas-sin-retiro__lead">
          Avisá por WhatsApp: el trabajo pasó los {DIAS_SIN_RETIRO_DESECHO} días y será desechado.
        </p>
      </header>

      {vencidas.length === 0 ? (
        <p className="entregas-sin-retiro__vacio">Ninguna OP lleva más de {DIAS_SIN_RETIRO_DESECHO} días sin retirar.</p>
      ) : (
        <>
          <div className="entregas-sin-retiro__destacado">
            <strong>{vencidas.length}</strong>
            <span>
              para avisar
              <em>más antiguas arriba</em>
            </span>
          </div>

          <ul className="entregas-sin-retiro__lista">
            {vencidas.map(({ task, dias, wa }) => (
              <li key={task.id} className="entregas-sin-retiro__card">
                <button
                  type="button"
                  className="entregas-sin-retiro__meta"
                  onClick={() => onSelectTask?.(task.id)}
                >
                  <span className="entregas-sin-retiro__op">
                    OP {task.opNumber?.trim() || '—'}
                  </span>
                  <span className="entregas-sin-retiro__cliente">
                    {task.clienteNombreCompleto?.trim() || task.title?.trim() || 'Sin cliente'}
                  </span>
                  <span className="entregas-sin-retiro__dias">{dias} días sin retirar</span>
                </button>
                {wa ? (
                  <a
                    className="entregas-sin-retiro__wa"
                    href={wa}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="WhatsApp: aviso de desecho por +30 días"
                  >
                    WhatsApp
                  </a>
                ) : (
                  <span className="entregas-sin-retiro__wa entregas-sin-retiro__wa--disabled" title="Sin teléfono">
                    Sin WhatsApp
                  </span>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}

export default EntregasSinRetiroPanel
