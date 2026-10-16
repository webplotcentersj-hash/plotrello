import CajaSectionConcilCanal from './CajaSectionConcilCanal'

export default function CajaSectionConcilMP({ usuarioId }: { usuarioId?: number }) {
  return <CajaSectionConcilCanal canal="mp" usuarioId={usuarioId} />
}
