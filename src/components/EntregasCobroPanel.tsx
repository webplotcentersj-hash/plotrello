import { useMemo } from 'react'
import type { Task, TaskStatus } from '../types/board'
import { formatMontoPagoParcial, resolveCobroOpEstado } from '../utils/opCobroEstado'
import './EntregasCobroPanel.css'

/** Columnas de entrega: lo que ya está terminado y esperando retiro. */
const ESTADOS_ENTREGA: TaskStatus[] = ['finalizado-taller', 'almacen-entrega']

/** Días esperando retiro a partir de los cuales la OP se marca como demorada. */
const DIAS_ESPERA_ALERTA = 7

const UN_DIA_MS = 86_400_000

type Props = {
  tasks: Task[]
}

const EntregasCobroPanel = ({ tasks }: Props) => {
  const resumen = useMemo(() => {
    const ahora = Date.now()
    let total = 0
    let sinCobrar = 0
    let conSenia = 0
    let pagadas = 0
    let seniasCobradas = 0
    let demoradas = 0

    for (const task of tasks) {
      if (!ESTADOS_ENTREGA.includes(task.status)) continue
      total += 1

      const estado = resolveCobroOpEstado(task)
      if (estado === 'pagado') {
        pagadas += 1
      } else if (estado === 'parcial') {
        conSenia += 1
        seniasCobradas += Number(task.montoPagoParcial ?? 0)
      } else if (estado === 'cuenta_corriente') {
        // CC: no cuenta como cobrada en mano, pero tampoco como “sin cobrar” genérico
        sinCobrar += 1
      } else {
        sinCobrar += 1
      }

      const movida = task.uiMovedAt ?? (task.updatedAt ? Date.parse(task.updatedAt) : Number.NaN)
      if (Number.isFinite(movida) && ahora - movida > DIAS_ESPERA_ALERTA * UN_DIA_MS) {
        demoradas += 1
      }
    }

    return { total, sinCobrar, conSenia, pagadas, seniasCobradas, demoradas }
  }, [tasks])

  const porcentajeSinCobrar =
    resumen.total > 0 ? Math.round((resumen.sinCobrar / resumen.total) * 100) : 0

  return (
    <section className="entregas-cobro" aria-label="Cobro de entregas">
      <header className="entregas-cobro__head">
        <p className="entregas-cobro__eyebrow">COBRO EN ENTREGAS</p>
        <h3>Sobre lo listo para entregar</h3>
      </header>

      {resumen.total === 0 ? (
        <p className="entregas-cobro__vacio">No hay OP esperando entrega.</p>
      ) : (
        <>
          <div className="entregas-cobro__destacado">
            <strong>{resumen.sinCobrar}</strong>
            <span>
              sin cobrar
              <em>{porcentajeSinCobrar}% de {resumen.total}</em>
            </span>
          </div>

          <ul className="entregas-cobro__lista">
            <li className="entregas-cobro__fila entregas-cobro__fila--senia">
              <span className="entregas-cobro__num">{resumen.conSenia}</span>
              <span className="entregas-cobro__texto">
                con seña
                {resumen.seniasCobradas > 0 && (
                  <em>${formatMontoPagoParcial(resumen.seniasCobradas)} ya cobrados</em>
                )}
              </span>
            </li>
            <li className="entregas-cobro__fila entregas-cobro__fila--pagada">
              <span className="entregas-cobro__num">{resumen.pagadas}</span>
              <span className="entregas-cobro__texto">pagadas</span>
            </li>
          </ul>

          {resumen.demoradas > 0 && (
            <p className="entregas-cobro__demora">
              ⏱ <strong>{resumen.demoradas}</strong> esperando retiro hace más de{' '}
              {DIAS_ESPERA_ALERTA} días
            </p>
          )}
        </>
      )}
    </section>
  )
}

export default EntregasCobroPanel
