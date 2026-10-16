import CajaSectionConcilCanal from './CajaSectionConcilCanal'

export default function CajaSectionConcilBanco({ usuarioId }: { usuarioId?: number }) {
  return <CajaSectionConcilCanal canal="banco" usuarioId={usuarioId} />
}
