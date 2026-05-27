import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useClienteAuth } from '../hooks/useClienteAuth'
import apiService from '../services/api'
import { uploadAttachmentAndGetUrl } from '../utils/storage'
import ClientePageHeader from '../components/cliente/ClientePageHeader'
import ClientePageLayout from '../components/cliente/ClientePageLayout'
import ClientePageLoading from '../components/cliente/ClientePageLoading'
import './ClienteReclamosPage.css'

const SECTORES = [
  { id: null as number | null, nombre: 'No especificado' },
  { id: 1, nombre: 'Diseño Gráfico' },
  { id: 2, nombre: 'Taller de Imprenta' },
  { id: 3, nombre: 'Taller Gráfico' },
  { id: 4, nombre: 'Instalaciones' },
  { id: 5, nombre: 'Metalúrgica' },
  { id: 6, nombre: 'Mostrador' },
  { id: 7, nombre: 'Caja' }
]

const ESTADO_LABELS: Record<string, string> = {
  nuevo: 'Nuevo',
  abierto: 'Abierto',
  en_curso: 'En curso',
  en_revision: 'En revisión',
  resuelto: 'Resuelto',
  cerrado: 'Cerrado'
}

type ReclamoItem = {
  id: number
  descripcion: string
  estado: string
  numero_op: string | null
  foto_producto_url: string | null
  created_at: string
}

export default function ClienteReclamosPage() {
  const { cliente, loading: authLoading } = useClienteAuth()
  const navigate = useNavigate()
  const [reclamos, setReclamos] = useState<ReclamoItem[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({
    numero_op: '',
    descripcion: '',
    prioridad: 'media' as 'baja' | 'media' | 'alta' | 'urgente',
    sector_id: null as number | null
  })
  const [fotoFile, setFotoFile] = useState<File | null>(null)
  const [fotoPreview, setFotoPreview] = useState<string | null>(null)
  const [uploadingFoto, setUploadingFoto] = useState(false)
  const fotoInputRef = useRef<HTMLInputElement>(null)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [activeTab, setActiveTab] = useState<'list' | 'crear'>('list')

  const loadReclamos = async () => {
    if (!cliente?.email && !cliente?.telefono) return
    setLoading(true)
    try {
      const email = cliente?.email?.trim() || ''
      const telefono = (cliente?.telefono || '').replace(/\D/g, '')
      const res = await apiService.buscarReclamosPublico(email, telefono)
      if (res.success && res.data) {
        setReclamos(res.data)
      }
    } catch (err) {
      console.error('Error cargando reclamos:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (authLoading) return
    if (!cliente) {
      navigate('/cliente/login')
      return
    }
    loadReclamos()
  }, [cliente, authLoading, navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!cliente) return
    setError(null)

    const desc = form.descripcion.trim()
    if (!desc) {
      setError('La descripción del reclamo es obligatoria.')
      return
    }

    const email = cliente.email?.trim()
    const telefono = (cliente.telefono || '').replace(/\D/g, '')
    if (!email) {
      setError('Tu cuenta no tiene email. Contactá para actualizar tus datos.')
      return
    }
    if (!telefono || telefono.length < 8) {
      setError('Tu cuenta no tiene teléfono válido. Contactá para actualizar tus datos.')
      return
    }

    setSending(true)
    try {
      let fotoUrl: string | null = null
      if (fotoFile) {
        setUploadingFoto(true)
        try {
          fotoUrl = await uploadAttachmentAndGetUrl(fotoFile, 'reclamos')
        } catch (uploadErr) {
          setError(uploadErr instanceof Error ? uploadErr.message : 'Error al subir la foto')
          setSending(false)
          setUploadingFoto(false)
          return
        }
        setUploadingFoto(false)
      }

      const res = await apiService.crearReclamoAtencion({
        cliente_nombre: cliente.nombre || null,
        cliente_email: email,
        cliente_telefono: cliente.telefono || null,
        numero_op: form.numero_op.trim() || null,
        foto_producto_url: fotoUrl,
        descripcion: desc,
        prioridad: form.prioridad,
        sector_id: form.sector_id,
        estado: 'nuevo'
      })

      if (res.success && res.data) {
        setSuccess(true)
        setForm({ numero_op: '', descripcion: '', prioridad: 'media', sector_id: null })
        setFotoFile(null)
        setFotoPreview(null)
        loadReclamos()
        setActiveTab('list')
        setTimeout(() => setSuccess(false), 4000)
      } else {
        setError(res.error || 'No se pudo enviar el reclamo.')
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al enviar.')
    } finally {
      setSending(false)
    }
  }

  const formatFecha = (s: string) => {
    try {
      const d = new Date(s)
      return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })
    } catch {
      return s
    }
  }

  if (authLoading || loading) {
    return <ClientePageLoading />
  }

  return (
    <ClientePageLayout className="cliente-reclamos-page">
      <ClientePageHeader
        eyebrow="Atención"
        title="Reclamos"
        subtitle="Reportá un problema con tu pedido u OP"
      />

        <div className="reclamos-tabs cliente-page-pills">
          <button
            type="button"
            className={`cliente-page-pill tab ${activeTab === 'list' ? 'active' : ''}`}
            onClick={() => setActiveTab('list')}
          >
            Mis Reclamos
          </button>
          <button
            type="button"
            className={`cliente-page-pill tab ${activeTab === 'crear' ? 'active' : ''}`}
            onClick={() => setActiveTab('crear')}
          >
            Nuevo Reclamo
          </button>
        </div>

        {success && (
          <div className="cliente-page-alert cliente-page-alert--success">
            ✅ Reclamo enviado correctamente. Nos pondremos en contacto contigo.
          </div>
        )}

        {error && (
          <div className="error-message">{error}</div>
        )}

        {activeTab === 'list' && (
          <div className="reclamos-list-section">
            <h2>Mis Reclamos</h2>
            {reclamos.length === 0 ? (
              <div className="empty-state">
                <p>No tenés reclamos registrados.</p>
                <button className="btn-primary" onClick={() => setActiveTab('crear')}>
                  Crear Reclamo
                </button>
              </div>
            ) : (
              <div className="reclamos-list">
                {reclamos.map((r) => (
                  <div key={r.id} className="reclamo-card">
                    <div className="reclamo-header">
                      <span className="reclamo-id">#{r.id}</span>
                      <span className={`reclamo-estado estado-${r.estado}`}>
                        {ESTADO_LABELS[r.estado] || r.estado}
                      </span>
                    </div>
                    <p className="reclamo-desc">{r.descripcion}</p>
                    <div className="reclamo-meta">
                      {r.numero_op && <span>OP: {r.numero_op}</span>}
                      <span>{formatFecha(r.created_at)}</span>
                    </div>
                    {r.foto_producto_url && (
                      <img src={r.foto_producto_url} alt="Producto" className="reclamo-foto" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'crear' && (
          <div className="reclamos-form-section">
            <h2>Nuevo Reclamo</h2>
            <form onSubmit={handleSubmit} className="reclamos-form">
              <div className="form-group">
                <label>Número de OP (opcional)</label>
                <input
                  type="text"
                  value={form.numero_op}
                  onChange={(e) => setForm((f) => ({ ...f, numero_op: e.target.value }))}
                  placeholder="Ej: OP-12345"
                />
              </div>
              <div className="form-group">
                <label>Sector (opcional)</label>
                <select
                  value={form.sector_id ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, sector_id: e.target.value ? parseInt(e.target.value) : null }))}
                >
                  {SECTORES.map((s) => (
                    <option key={s.id ?? 'n'} value={s.id ?? ''}>{s.nombre}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Prioridad</label>
                <select
                  value={form.prioridad}
                  onChange={(e) => setForm((f) => ({ ...f, prioridad: e.target.value as any }))}
                >
                  <option value="baja">Baja</option>
                  <option value="media">Media</option>
                  <option value="alta">Alta</option>
                  <option value="urgente">Urgente</option>
                </select>
              </div>
              <div className="form-group">
                <label>Descripción del reclamo *</label>
                <textarea
                  value={form.descripcion}
                  onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))}
                  placeholder="Describí el problema o situación..."
                  rows={5}
                  required
                />
              </div>
              <div className="form-group">
                <label>Foto del producto (opcional)</label>
                <input
                  ref={fotoInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) {
                      setFotoFile(f)
                      const reader = new FileReader()
                      reader.onload = () => setFotoPreview(reader.result as string)
                      reader.readAsDataURL(f)
                    }
                  }}
                />
                {fotoPreview && (
                  <div className="foto-preview">
                    <img src={fotoPreview} alt="Preview" />
                    <button type="button" onClick={() => { setFotoFile(null); setFotoPreview(null) }}>
                      Quitar
                    </button>
                  </div>
                )}
              </div>
              <button type="submit" className="cliente-btn-primary" disabled={sending || uploadingFoto}>
                {sending ? 'Enviando...' : 'Enviar Reclamo'}
              </button>
            </form>
          </div>
        )}
    </ClientePageLayout>
  )
}
