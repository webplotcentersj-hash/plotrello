/**
 * Escenas para capturas de docs/IMPLEMENTACION_BITACORA_OPERARIOS.html
 * Solo dev: /__docs/bitacora-capturas?scene=01 … 10
 */
import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ClipboardCheck } from 'lucide-react'
import Header from '../../components/Header'
import WorkPoolOperarioNotasFab from '../../features/work-pool/WorkPoolOperarioNotasFab'
import ActividadesOperariosCalendario from '../../features/work-pool/ActividadesOperariosCalendario'
import ActividadOperarioDetalleModal from '../../features/work-pool/ActividadOperarioDetalleModal'
import type { WorkPoolJob, WorkPoolOperarioNota } from '../../types/workPool'
import type { WorkPoolNotaSupervision } from '../../features/work-pool/workPoolOperarioNotas'
import { formatHorarioNota } from '../../features/work-pool/workPoolOperarioNotas'
import { getArgentinaDateString } from '../../utils/dateUtils'
import '../../pages/ActividadesOperariosPage.css'
import '../../features/work-pool/WorkPoolAdminPanel.css'
import '../../components/VerLegajoModal.css'
import '../../components/LegajoActividadesPlotPanel.css'
import './BitacoraDocsCapturePage.css'

const HOY = getArgentinaDateString()

const MOCK_JOB: WorkPoolJob = {
  id: 42,
  sector: 'diseno',
  id_orden: null,
  numero_op: '105638',
  titulo: 'Identidad visual local comercial',
  descripcion: null,
  modo: 'asignado',
  estado: 'en_curso',
  prioridad: 'normal',
  plazo: null,
  monto_presupuestado: 0,
  monto_final: null,
  moneda: 'ARS',
  id_usuario_asignado: 12,
  id_usuario_creador: 1,
  codigo_tarifa: null,
  metadata: {},
  notas_entrega: null,
  motivo_rechazo: null,
  tomado_at: `${HOY}T09:00:00Z`,
  entregado_at: null,
  aprobado_at: null,
  created_at: `${HOY}T10:00:00Z`,
  updated_at: `${HOY}T10:00:00Z`,
  asignado_nombre: 'María Operaria'
}

const MOCK_NOTA: WorkPoolOperarioNota = {
  id: 3,
  id_usuario: 12,
  tipo: 'bitacora',
  titulo: 'Hola',
  detalle: 'Avance en ajustes de logo y tipografía del frente.',
  hecho: false,
  id_job: 42,
  numero_op: '105638',
  id_orden: null,
  id_venta: null,
  numero_venta: null,
  id_oportunidad: null,
  numero_oportunidad: null,
  adjuntos: [
    {
      nombre: 'referencia-fachada.pdf',
      url: '#',
      mime: 'application/pdf',
      size: 245000
    }
  ],
  hora_inicio: '01:05',
  hora_fin: '12:05',
  created_at: `${HOY}T14:05:00.000Z`,
  updated_at: `${HOY}T14:05:00.000Z`,
  usuario_nombre: 'María Operaria'
}

const MOCK_SUPERVISION: WorkPoolNotaSupervision = {
  ...MOCK_NOTA,
  usuario_rol: 'operario-diseno',
  job_titulo: MOCK_JOB.titulo,
  job_estado: 'en_curso',
  id_legajo: 184
}

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString('es-AR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch {
    return iso
  }
}

function formatDiaLabel(yyyyMmDd: string) {
  try {
    return new Date(`${yyyyMmDd}T12:00:00`).toLocaleDateString('es-AR', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    })
  } catch {
    return yyyyMmDd
  }
}

function SceneFab01() {
  return (
    <div className="bdcapture bdcapture--fab" data-scene="01">
      <div className="bdcapture__fake-board" />
      <WorkPoolOperarioNotasFab idUsuario={12} jobs={[MOCK_JOB]} variant="phi" docsCapture={{ fabOnly: true }} />
    </div>
  )
}

function SceneFab02() {
  return (
    <div className="bdcapture bdcapture--fab" data-scene="02">
      <WorkPoolOperarioNotasFab
        idUsuario={12}
        jobs={[MOCK_JOB]}
        variant="phi"
        docsCapture={{ forceOpen: true, panelOnly: true }}
      />
    </div>
  )
}

function SceneFab03() {
  return (
    <div className="bdcapture bdcapture--fab" data-scene="03">
      <WorkPoolOperarioNotasFab
        idUsuario={12}
        jobs={[MOCK_JOB]}
        variant="phi"
        docsCapture={{
          forceOpen: true,
          forceTab: 'bitacora',
          panelOnly: true,
          prefill: {
            jobId: MOCK_JOB.id,
            tituloTarea: 'Ajuste de logo principal',
            texto: 'Revisión de proporciones y márgenes de seguridad.',
            horaInicio: '09:00',
            horaFin: '11:30'
          }
        }}
      />
    </div>
  )
}

function SceneFab04() {
  const items: WorkPoolOperarioNota[] = [
    MOCK_NOTA,
    {
      ...MOCK_NOTA,
      id: 4,
      titulo: 'Checklist entrega',
      tipo: 'checklist',
      detalle: 'Exportar PDF final',
      hecho: true,
      hora_inicio: null,
      hora_fin: null,
      adjuntos: [],
      created_at: `${HOY}T16:20:00.000Z`
    }
  ]
  return (
    <div className="bdcapture bdcapture--fab" data-scene="04">
      <WorkPoolOperarioNotasFab
        idUsuario={12}
        jobs={[MOCK_JOB]}
        variant="phi"
        docsCapture={{ forceOpen: true, panelOnly: true, staticItems: items }}
      />
    </div>
  )
}

function SceneHeader05() {
  return (
    <div className="bdcapture bdcapture--header" data-scene="05">
      <Header teamMembers={[]} activity={[]} currentUserName="Alejandro Chávez" isAdmin />
    </div>
  )
}

function ScenePlotDesign06() {
  return (
    <div className="bdcapture bdcapture--plot-admin" data-scene="06">
      <header className="work-pool-admin__hero">
        <div className="work-pool-admin__hero-main">
          <p className="work-pool-admin__eyebrow">Plot Design · Admin</p>
          <h1>Bolsa de trabajos</h1>
        </div>
        <div className="work-pool-admin__hero-actions">
          <button type="button" className="work-pool-module__btn work-pool-module__btn--ghost work-pool-admin__product-btn">
            <span className="work-pool-admin__phi-inline" aria-hidden>
              φ
            </span>
            Bolsa Plot
          </button>
          <button type="button" className="work-pool-module__back">
            ← PlotLab
          </button>
          <button
            type="button"
            className="work-pool-module__btn work-pool-module__btn--ghost work-pool-admin__product-btn"
            title="Bitácora, checklist y estadísticas de operarios"
          >
            <ClipboardCheck size={16} aria-hidden />
            Actividades operarios
          </button>
        </div>
      </header>
    </div>
  )
}

function SceneSupervision07() {
  const [y, m] = HOY.split('-').map(Number)
  const month = useMemo(() => new Date(y, m - 1, 1), [y, m])
  const counts: Record<string, number> = { [HOY]: 3, [`${y}-${String(m).padStart(2, '0')}-20`]: 1 }

  return (
    <div className="bdcapture bdcapture--supervision" data-scene="07">
      <div className="act-op-page">
        <header className="act-op-page__head">
          <div>
            <p className="act-op-page__eyebrow">Supervisión Plot Lab</p>
            <h1>Actividades de operarios</h1>
          </div>
        </header>
        <div className="act-op-page__layout">
          <aside className="act-op-page__aside">
            <ActividadesOperariosCalendario
              month={month}
              selectedDate={HOY}
              countsByDay={counts}
              onSelectDate={() => {}}
              onChangeMonth={() => {}}
            />
          </aside>
          <div className="act-op-page__main">
            <section className="act-op-dia">
              <header className="act-op-dia__head">
                <div>
                  <h2>{formatDiaLabel(HOY)}</h2>
                  <p>3 actividades del día</p>
                </div>
              </header>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}

function SceneSupervision08() {
  return (
    <div className="bdcapture bdcapture--supervision" data-scene="08">
      <div className="act-op-page">
        <section className="act-op-dia">
          <header className="act-op-dia__head">
            <div>
              <h2>{formatDiaLabel(HOY)}</h2>
              <p>2 actividades del día</p>
            </div>
            <div className="act-op-dia__chips">
              <span>1 bitácora</span>
              <span>1 checklist</span>
            </div>
          </header>
        </section>
        <div className="act-op-page__groups">
          <section className="act-op-card">
            <header className="act-op-card__head">
              <div>
                <h2>María Operaria</h2>
                <small className="act-op-card__legajo">Legajo #184</small>
              </div>
              <div className="act-op-card__head-actions">
                <span>2 del día</span>
                <button type="button" className="act-op-card__legajo-btn">
                  Ver legajo
                </button>
              </div>
            </header>
            <ul className="act-op-card__list">
              <li>
                <button type="button" className="act-op-card__item-btn">
                  <div className="act-op-card__meta">
                    <span className="act-op-card__tipo act-op-card__tipo--bitacora">Bitácora</span>
                    <span>{formatWhen(MOCK_NOTA.created_at)}</span>
                    <span>{formatHorarioNota(MOCK_NOTA.hora_inicio, MOCK_NOTA.hora_fin)}</span>
                  </div>
                  <p>{MOCK_NOTA.titulo}</p>
                  <span className="act-op-card__op">OP {MOCK_NOTA.numero_op}</span>
                </button>
              </li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  )
}

function SceneSupervision09() {
  return (
    <div className="bdcapture bdcapture--supervision" data-scene="09">
      <ActividadOperarioDetalleModal nota={MOCK_SUPERVISION} onClose={() => {}} />
    </div>
  )
}

function SceneLegajo10() {
  const tabs = [
    { id: 'legajo', label: '📋 Legajo' },
    { id: 'movimientos', label: '📈 Actividad operativa' },
    { id: 'actividades_plot', label: '📝 Actividades Plot' }
  ]

  return (
    <div className="bdcapture bdcapture--legajo" data-scene="10">
      <div className="ver-legajo-modal-overlay bdcapture__legajo-overlay">
        <div className="ver-legajo-modal-content ver-legajo-modal-content--wide">
          <div className="ver-legajo-modal-header">
            <h2>📋 Legajo de Empleado</h2>
            <button type="button" className="ver-legajo-close-btn" aria-label="Cerrar">
              ✕
            </button>
          </div>
          <div className="ver-legajo-body">
            <div className="ver-legajo-tabs">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`ver-legajo-tab ${t.id === 'actividades_plot' ? 'active' : ''}`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div className="ver-legajo-tab-content">
              <h3 className="ver-legajo-section-title">📝 Actividades Plot Lab</h3>
              <div className="legajo-act-plot">
                <div className="legajo-act-plot__head">
                  <p>Registro automático desde el anotador de operarios (bitácora, checklist, anotador).</p>
                </div>
                <ul className="legajo-act-plot__list">
                  <li>
                    <div className="legajo-act-plot__meta">
                      <span className="legajo-act-plot__tipo legajo-act-plot__tipo--bitacora">Bitácora</span>
                      <span>{formatWhen(MOCK_NOTA.created_at)}</span>
                      <span>{formatHorarioNota(MOCK_NOTA.hora_inicio, MOCK_NOTA.hora_fin)}</span>
                    </div>
                    <p>{MOCK_NOTA.titulo}</p>
                    <small>{MOCK_NOTA.detalle}</small>
                    <div className="legajo-act-plot__refs">
                      <span>OP {MOCK_NOTA.numero_op}</span>
                      <span>{MOCK_JOB.titulo}</span>
                    </div>
                    <ul className="legajo-act-plot__adj">
                      <li>
                        <span>{MOCK_NOTA.adjuntos[0]?.nombre}</span>
                      </li>
                    </ul>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const SCENES: Record<string, () => React.ReactElement> = {
  '01': SceneFab01,
  '02': SceneFab02,
  '03': SceneFab03,
  '04': SceneFab04,
  '05': SceneHeader05,
  '06': ScenePlotDesign06,
  '07': SceneSupervision07,
  '08': SceneSupervision08,
  '09': SceneSupervision09,
  '10': SceneLegajo10
}

function CaptureContent() {
  const [params] = useSearchParams()
  const scene = params.get('scene') || '01'
  const Scene = SCENES[scene] ?? SceneFab01
  return <Scene />
}

export default function BitacoraDocsCapturePage() {
  if (!import.meta.env.DEV) {
    return <p>Solo disponible en desarrollo.</p>
  }
  return <CaptureContent />
}
