import type { CajaCierreEstado } from '../types'

export default function CajaBadge({ estado }: { estado: CajaCierreEstado | string }) {
  const ok = estado === 'OK'
  return <span className={`caja-cc-badge ${ok ? 'ok' : 'bad'}`}>{estado}</span>
}
