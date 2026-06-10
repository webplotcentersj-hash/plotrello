import { usePwaUpdateOptional } from '../contexts/PwaUpdateContext'
import PwaUpdateModal from './PwaUpdateModal'

export default function PwaUpdateModalHost() {
  const pwa = usePwaUpdateOptional()
  if (!pwa?.modalMode) return null
  return <PwaUpdateModal mode={pwa.modalMode} onClose={pwa.closeUpdateModal} />
}
