import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import apiService from '../services/api'
import type { UsuarioRecord } from '../types/api'
import './RecursosHumanosNotificacionesPage.css'

const TIPOS_NOTIFICACION = [
  { value: 'info', label: 'ℹ️ Informativa', color: '#3b82f6' },
  { value: 'success', label: '✅ Éxito', color: '#10b981' },
  { value: 'warning', label: '⚠️ Advertencia', color: '#f59e0b' },
  { value: 'error', label: '❌ Error', color: '#ef4444' },
  { value: 'mention', label: '💬 Mención', color: '#8b5cf6' }
]

const ROLES_DISPONIBLES = [
  { value: 'administracion', label: 'Administración' },
  { value: 'gerencia', label: 'Gerencia' },
  { value: 'recursos-humanos', label: 'Recursos Humanos' },
  { value: 'diseno', label: 'Diseño' },
  { value: 'imprenta', label: 'Imprenta' },
  { value: 'taller-grafico', label: 'Taller Gráfico' },
  { value: 'instalaciones', label: 'Instalaciones' },
  { value: 'metalurgica', label: 'Metalúrgica' },
  { value: 'caja', label: 'Caja' },
  { value: 'mostrador', label: 'Mostrador' },
  { value: 'compras', label: 'Compras' }
]

const SECTORES_DISPONIBLES = [
  'Diseño Gráfico',
  'Diseño en Proceso',
  'En Espera',
  'Imprenta (Área de Impresión)',
  'Taller de Imprenta',
  'Taller Gráfico',
  'Instalaciones',
  'Metalúrgica',
  'Entregas taller de Imprenta',
  'Entregas taller gráfico'
]

const RecursosHumanosNotificacionesPage = () => {
  const navigate = useNavigate()
  const { canManageRecursosHumanos, loading: authLoading, usuario } = useAuth()
  const [loading, setLoading] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [usuarios, setUsuarios] = useState<UsuarioRecord[]>([])
  const [estadisticas, setEstadisticas] = useState<any>(null)
  
  const [formData, setFormData] = useState({
    titulo: '',
    descripcion: '',
    tipo: 'info' as 'info' | 'success' | 'warning' | 'error' | 'mention',
    destino: 'todos' as 'todos' | 'rol' | 'sector' | 'usuarios',
    rolSeleccionado: '',
    sectorSeleccionado: '',
    usuariosSeleccionados: [] as number[]
  })

  const [mensaje, setMensaje] = useState<{ tipo: 'success' | 'error'; texto: string } | null>(null)
  const [comunicadosEnviados, setComunicadosEnviados] = useState<
    Array<{ titulo: string; descripcion: string; tipo: string; ultima: string; copias: number }>
  >([])
  const [eliminandoClave, setEliminandoClave] = useState<string | null>(null)

  useEffect(() => {
    if (authLoading) return
    if (!canManageRecursosHumanos) {
      navigate('/rrhh/dashboard')
      return
    }
    loadData()
  }, [canManageRecursosHumanos, navigate, authLoading, usuario?.id])

  const loadData = async () => {
    setLoading(true)
    try {
      // Cargar usuarios
      const usuariosResponse = await apiService.getUsuarios()
      if (usuariosResponse.success && usuariosResponse.data) {
        setUsuarios(usuariosResponse.data)
      }

      // Cargar estadísticas
      const statsResponse = await apiService.obtenerEstadisticasNotificaciones()
      if (statsResponse.success && statsResponse.data) {
        setEstadisticas(statsResponse.data)
      }

      if (usuario?.id) {
        const comRes = await apiService.listarComunicadosRrhhMasivos(usuario.id)
        if (comRes.success && comRes.data) {
          setComunicadosEnviados(comRes.data)
        } else {
          setComunicadosEnviados([])
        }
      }
    } catch (error) {
      console.error('Error cargando datos:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleEnviar = async () => {
    if (!formData.titulo.trim()) {
      setMensaje({ tipo: 'error', texto: 'El título es obligatorio' })
      return
    }

    if (!formData.descripcion.trim()) {
      setMensaje({ tipo: 'error', texto: 'La descripción es obligatoria' })
      return
    }

    setEnviando(true)
    setMensaje(null)

    try {
      let response

      if (formData.destino === 'todos') {
        response = await apiService.enviarNotificacionMasiva({
          titulo: formData.titulo,
          descripcion: formData.descripcion,
          tipo: formData.tipo,
          enviar_a_todos: true,
          id_usuario_emisor: usuario?.id
        })
      } else if (formData.destino === 'rol' && formData.rolSeleccionado) {
        response = await apiService.enviarNotificacionMasiva({
          titulo: formData.titulo,
          descripcion: formData.descripcion,
          tipo: formData.tipo,
          rol_filtro: formData.rolSeleccionado,
          id_usuario_emisor: usuario?.id
        })
      } else if (formData.destino === 'sector' && formData.sectorSeleccionado) {
        response = await apiService.enviarNotificacionMasiva({
          titulo: formData.titulo,
          descripcion: formData.descripcion,
          tipo: formData.tipo,
          sector_filtro: formData.sectorSeleccionado,
          id_usuario_emisor: usuario?.id
        })
      } else if (formData.destino === 'usuarios' && formData.usuariosSeleccionados.length > 0) {
        // Para usuarios específicos, enviar individualmente
        let enviadas = 0
        for (const userId of formData.usuariosSeleccionados) {
          const notifResponse = await apiService.createNotification({
            user_id: userId,
            title: formData.titulo,
            description: formData.descripcion,
            type: formData.tipo,
            origen: 'rrhh_masivo'
          })
          if (notifResponse.success) {
            enviadas++
          }
        }
        response = {
          success: true,
          data: {
            notificaciones_creadas: enviadas,
            usuarios_notificados: enviadas,
            mensaje: `Se enviaron ${enviadas} notificaciones`
          }
        }
      } else {
        setMensaje({ tipo: 'error', texto: 'Por favor, completa todos los campos requeridos' })
        setEnviando(false)
        return
      }

      if (response.success && response.data) {
        setMensaje({
          tipo: 'success',
          texto: `✅ ${response.data.mensaje || 'Notificaciones enviadas correctamente'}`
        })
        // Limpiar formulario
        setFormData({
          titulo: '',
          descripcion: '',
          tipo: 'info',
          destino: 'todos',
          rolSeleccionado: '',
          sectorSeleccionado: '',
          usuariosSeleccionados: []
        })
        // Recargar estadísticas
        loadData()
      } else {
        setMensaje({
          tipo: 'error',
          texto: response.error || 'Error al enviar notificaciones'
        })
      }
    } catch (error: any) {
      console.error('Error enviando notificaciones:', error)
      setMensaje({
        tipo: 'error',
        texto: error.message || 'Error al enviar notificaciones'
      })
    } finally {
      setEnviando(false)
    }
  }

  const handleEliminarComunicado = async (row: {
    titulo: string
    descripcion: string
    tipo: string
    ultima: string
    copias: number
  }) => {
    if (!usuario?.id) return
    const clave = `${row.titulo}::${row.descripcion}::${row.ultima}`
    if (
      !window.confirm(
        '¿Quitar este comunicado para todos los usuarios? Se borrarán todas las copias en sus bandejas.'
      )
    ) {
      return
    }
    setEliminandoClave(clave)
    setMensaje(null)
    const res = await apiService.eliminarComunicadoRrhhMasivo(usuario.id, row.titulo, row.descripcion)
    setEliminandoClave(null)
    if (res.success && res.data) {
      setMensaje({
        tipo: 'success',
        texto: `✅ Se eliminaron ${res.data.eliminadas} notificación(es) de este comunicado.`
      })
      await loadData()
    } else {
      setMensaje({
        tipo: 'error',
        texto: res.error || 'No se pudo eliminar el comunicado'
      })
    }
  }

  const toggleUsuarioSeleccionado = (userId: number) => {
    setFormData(prev => ({
      ...prev,
      usuariosSeleccionados: prev.usuariosSeleccionados.includes(userId)
        ? prev.usuariosSeleccionados.filter(id => id !== userId)
        : [...prev.usuariosSeleccionados, userId]
    }))
  }

  if (loading) {
    return (
      <div className="rrhh-notificaciones-loading">
        <div className="spinner"></div>
        <p>Cargando...</p>
      </div>
    )
  }

  return (
    <div className="rrhh-notificaciones-page">
      <header className="rrhh-notificaciones-header">
        <div className="rrhh-header-content">
          <h1>📢 Notificador Masivo</h1>
          <div className="rrhh-header-actions">
            <button className="btn-back" onClick={() => navigate('/rrhh/dashboard')}>
              ← Volver
            </button>
          </div>
        </div>
      </header>

      <div className="rrhh-notificaciones-content">
        {/* Estadísticas */}
        {estadisticas && (
          <div className="rrhh-stats-section">
            <h2>📊 Estadísticas de Notificaciones</h2>
            <div className="rrhh-stats-grid">
              <div className="rrhh-stat-card">
                <div className="rrhh-stat-icon">📬</div>
                <div className="rrhh-stat-info">
                  <h3>Total</h3>
                  <p className="rrhh-stat-value">{estadisticas.total_notificaciones || 0}</p>
                </div>
              </div>
              <div className="rrhh-stat-card">
                <div className="rrhh-stat-icon">🔔</div>
                <div className="rrhh-stat-info">
                  <h3>No Leídas</h3>
                  <p className="rrhh-stat-value">{estadisticas.notificaciones_no_leidas || 0}</p>
                </div>
              </div>
              <div className="rrhh-stat-card">
                <div className="rrhh-stat-icon">✅</div>
                <div className="rrhh-stat-info">
                  <h3>Leídas</h3>
                  <p className="rrhh-stat-value">{estadisticas.notificaciones_leidas || 0}</p>
                </div>
              </div>
              <div className="rrhh-stat-card">
                <div className="rrhh-stat-icon">📅</div>
                <div className="rrhh-stat-info">
                  <h3>Hoy</h3>
                  <p className="rrhh-stat-value">{estadisticas.notificaciones_hoy || 0}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="rrhh-comunicados-enviados">
          <h2>📋 Comunicados masivos enviados</h2>
          <p className="rrhh-form-hint">
            Solo RRHH puede quitar un comunicado: se borran todas las copias en el equipo (incluida la tarjeta del
            inicio).
          </p>
          {comunicadosEnviados.length === 0 ? (
            <p className="rrhh-comunicados-vacio">No hay comunicados del notificador masivo todavía.</p>
          ) : (
            <ul className="rrhh-comunicados-lista">
              {comunicadosEnviados.map((c) => {
                const clave = `${c.titulo}::${c.descripcion}::${c.ultima}`
                return (
                  <li key={clave} className="rrhh-comunicado-fila">
                    <div className="rrhh-comunicado-texto">
                      <strong className="rrhh-comunicado-titulo">{c.titulo}</strong>
                      {c.descripcion ? <p className="rrhh-comunicado-desc">{c.descripcion}</p> : null}
                      <small className="rrhh-comunicado-meta">
                        {c.copias} envío{c.copias === 1 ? '' : 's'} · último:{' '}
                        {new Date(c.ultima).toLocaleString('es-AR')} · {c.tipo}
                      </small>
                    </div>
                    <button
                      type="button"
                      className="rrhh-comunicado-borrar"
                      disabled={eliminandoClave === clave}
                      onClick={() => void handleEliminarComunicado(c)}
                    >
                      {eliminandoClave === clave ? '…' : '🗑️ Quitar'}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {/* Formulario de notificación */}
        <div className="rrhh-notificacion-form">
          <h2>✉️ Crear Nueva Notificación</h2>
          <p className="rrhh-form-hint">
            Podés usar emojis en el título y en el mensaje; en Plot Lab se muestran con color según el tipo
            elegido abajo.
          </p>

          {mensaje && (
            <div className={`rrhh-mensaje ${mensaje.tipo}`}>
              {mensaje.texto}
            </div>
          )}

          <div className="rrhh-form-group">
            <label>Título de la Notificación *</label>
            <input
              type="text"
              value={formData.titulo}
              onChange={(e) => setFormData(prev => ({ ...prev, titulo: e.target.value }))}
              placeholder="Ej: 📅 Reunión de equipo mañana"
              maxLength={255}
            />
          </div>

          <div className="rrhh-form-group">
            <label>Descripción *</label>
            <textarea
              value={formData.descripcion}
              onChange={(e) => setFormData(prev => ({ ...prev, descripcion: e.target.value }))}
              placeholder="Escribe el mensaje completo de la notificación..."
              rows={5}
            />
          </div>

          <div className="rrhh-form-group">
            <label>Tipo de Notificación</label>
            <div className="rrhh-tipos-grid">
              {TIPOS_NOTIFICACION.map(tipo => (
                <button
                  key={tipo.value}
                  type="button"
                  className={`rrhh-tipo-btn ${formData.tipo === tipo.value ? 'active' : ''}`}
                  onClick={() => setFormData(prev => ({ ...prev, tipo: tipo.value as any }))}
                  style={{ borderColor: formData.tipo === tipo.value ? tipo.color : 'transparent' }}
                >
                  {tipo.label}
                </button>
              ))}
            </div>
          </div>

          <div className="rrhh-form-group">
            <label>Destinatarios</label>
            <div className="rrhh-destino-options">
              <label className="rrhh-radio-option">
                <input
                  type="radio"
                  name="destino"
                  value="todos"
                  checked={formData.destino === 'todos'}
                  onChange={() => setFormData(prev => ({ ...prev, destino: 'todos' as any }))}
                />
                <span>🌐 Todos los usuarios</span>
              </label>
              <label className="rrhh-radio-option">
                <input
                  type="radio"
                  name="destino"
                  value="rol"
                  checked={formData.destino === 'rol'}
                  onChange={() => setFormData(prev => ({ ...prev, destino: 'rol' as any }))}
                />
                <span>👥 Por rol</span>
              </label>
              <label className="rrhh-radio-option">
                <input
                  type="radio"
                  name="destino"
                  value="sector"
                  checked={formData.destino === 'sector'}
                  onChange={() => setFormData(prev => ({ ...prev, destino: 'sector' as any }))}
                />
                <span>🏭 Por sector</span>
              </label>
              <label className="rrhh-radio-option">
                <input
                  type="radio"
                  name="destino"
                  value="usuarios"
                  checked={formData.destino === 'usuarios'}
                  onChange={() => setFormData(prev => ({ ...prev, destino: 'usuarios' as any }))}
                />
                <span>👤 Usuarios específicos</span>
              </label>
            </div>
          </div>

          {formData.destino === 'rol' && (
            <div className="rrhh-form-group">
              <label>Seleccionar Rol</label>
              <select
                value={formData.rolSeleccionado}
                onChange={(e) => setFormData(prev => ({ ...prev, rolSeleccionado: e.target.value }))}
              >
                <option value="">Selecciona un rol...</option>
                {ROLES_DISPONIBLES.map(rol => (
                  <option key={rol.value} value={rol.value}>{rol.label}</option>
                ))}
              </select>
            </div>
          )}

          {formData.destino === 'sector' && (
            <div className="rrhh-form-group">
              <label>Seleccionar Sector</label>
              <select
                value={formData.sectorSeleccionado}
                onChange={(e) => setFormData(prev => ({ ...prev, sectorSeleccionado: e.target.value }))}
              >
                <option value="">Selecciona un sector...</option>
                {SECTORES_DISPONIBLES.map(sector => (
                  <option key={sector} value={sector}>{sector}</option>
                ))}
              </select>
            </div>
          )}

          {formData.destino === 'usuarios' && (
            <div className="rrhh-form-group">
              <label>Seleccionar Usuarios ({formData.usuariosSeleccionados.length} seleccionados)</label>
              <div className="rrhh-usuarios-list">
                {usuarios.map(user => (
                  <label key={user.id} className="rrhh-usuario-checkbox">
                    <input
                      type="checkbox"
                      checked={formData.usuariosSeleccionados.includes(user.id)}
                      onChange={() => toggleUsuarioSeleccionado(user.id)}
                    />
                    <span>{user.nombre} <small>({user.rol})</small></span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="rrhh-form-actions">
            <button
              className="btn-primary btn-send"
              onClick={handleEnviar}
              disabled={enviando || !formData.titulo.trim() || !formData.descripcion.trim()}
            >
              {enviando ? '⏳ Enviando...' : '📤 Enviar Notificación'}
            </button>
            <button
              className="btn-secondary"
              onClick={() => navigate('/rrhh/dashboard')}
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default RecursosHumanosNotificacionesPage

