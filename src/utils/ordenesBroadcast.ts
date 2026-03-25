/** Sincronizar listas de órdenes entre pestañas / tras crear fichas (misma máquina). */
const CHANNEL = 'plot-ordenes-sync-v1'

export function broadcastOrdenesChanged(): void {
  try {
    const ch = new BroadcastChannel(CHANNEL)
    ch.postMessage({ type: 'changed' })
    ch.close()
  } catch {
    /* sin BroadcastChannel */
  }
}

export function subscribeOrdenesBroadcast(handler: () => void): () => void {
  try {
    const ch = new BroadcastChannel(CHANNEL)
    ch.onmessage = () => handler()
    return () => {
      ch.close()
    }
  } catch {
    return () => {}
  }
}
