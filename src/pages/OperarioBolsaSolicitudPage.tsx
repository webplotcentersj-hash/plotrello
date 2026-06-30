import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  Briefcase,
  CheckCircle2,
  FileUp,
  Hammer,
  Mail,
  Palette,
  Send,
  Sparkles,
  Wrench
} from 'lucide-react'
import { enviarSolicitudOperarioExterno } from '../features/work-pool/workPoolRepository'
import { operarioExternoHomeRoute, OPERARIO_EXTERNO_LOGIN, isOperarioExternoRol } from '../features/work-pool/workPoolOperarioExterno'
import { useAuth } from '../hooks/useAuth'
import { PHI_PUBLIC_URL } from '../utils/phiPublicUrl'
import {
  MAX_POSTULACION_MB,
  POSTULACION_DOC_EXT,
  POSTULACION_IMAGE_EXT,
  POSTULACION_NIVELES,
  POSTULACION_PORTFOLIO_EXT,
  POSTULACION_RUBROS,
  POSTULACION_WIZARD_STEPS,
  nivelLabel,
  referenciasRecomendadas,
  requiereLibretaDiseno,
  requiereReferenciasObligatorias,
  requiereTituloCertificado,
  requiereTituloUniversitarioDiseno,
  rubroLabel,
  tituloCertificadoOpcional,
  normalizePortfolioUrl,
  validatePostulacionFile,
  validatePostulacionForm,
  validatePostulacionWizardStep,
  type PostulacionFormInput,
  type PostulacionNivel,
  type PostulacionRubro,
  type PostulacionWizardStep
} from '../features/work-pool/workPoolPostulacion'
import { uploadAttachmentAndGetUrl } from '../utils/storage'
import '../features/phi/phi-landing.css'
import './OperarioBolsaSolicitudPage.css'

const LOGO_URL = '/plot-lab-logo.png'
const UPLOAD_FOLDER = 'work-pool-solicitudes'
const ONEST_FONT =
  'https://fonts.googleapis.com/css2?family=Onest:wght@500;700&display=swap'

const RUBRO_ICONS = {
  diseno: Palette,
  instalaciones: Wrench,
  metalurgica: Hammer
} as const

function FileField({
  id,
  label,
  hint,
  required,
  accept,
  file,
  disabled,
  onChange
}: {
  id: string
  label: string
  hint: string
  required?: boolean
  accept: string
  file: File | null
  disabled?: boolean
  onChange: (file: File | null) => void
}) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <div className="operario-solicitud-file">
      <label htmlFor={id}>
        {label}
        {required ? ' *' : ''}
      </label>
      <p className="operario-solicitud-hint">{hint}</p>
      <div className={`operario-solicitud-file__zone${file ? ' has-file' : ''}`}>
        <FileUp size={28} strokeWidth={1.5} className="operario-solicitud-file__zone-icon" aria-hidden />
        <div className="operario-solicitud-file__row">
          <button
            type="button"
            className="operario-solicitud-file__btn"
            onClick={() => ref.current?.click()}
            disabled={disabled}
          >
            {file ? 'Cambiar archivo' : 'Seleccionar archivo'}
          </button>
          <span className="operario-solicitud-file__name">
            {file ? file.name : 'PDF, DOC o imagen según el campo'}
          </span>
          {file && (
            <button
              type="button"
              className="operario-solicitud-file__clear"
              onClick={() => {
                onChange(null)
                if (ref.current) ref.current.value = ''
              }}
              disabled={disabled}
            >
              Quitar
            </button>
          )}
        </div>
      </div>
      <input
        id={id}
        ref={ref}
        type="file"
        accept={accept}
        hidden
        disabled={disabled}
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />
    </div>
  )
}

async function uploadIfPresent(file: File | null, subfolder: string) {
  if (!file) return { url: undefined, nombre: undefined }
  const url = await uploadAttachmentAndGetUrl(file, `${UPLOAD_FOLDER}/${subfolder}`)
  return { url, nombre: file.name }
}

export default function OperarioBolsaSolicitudPage() {
  const { usuario } = useAuth()

  useEffect(() => {
    document.title = 'Postulación · phi (φ) Plot Design'

    let link = document.querySelector<HTMLLinkElement>('link[data-phi-font]')
    if (!link) {
      link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = ONEST_FONT
      link.setAttribute('data-phi-font', 'true')
      document.head.appendChild(link)
    }
  }, [])

  const [stepIndex, setStepIndex] = useState(0)
  const [rubro, setRubro] = useState<PostulacionRubro>('diseno')
  const [nivel, setNivel] = useState<PostulacionNivel>('estudiante')
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [telefono, setTelefono] = useState('')
  const [documento, setDocumento] = useState('')
  const [tituloTexto, setTituloTexto] = useState('')
  const [experiencia, setExperiencia] = useState('')
  const [referencias, setReferencias] = useState('')
  const [portfolioUrl, setPortfolioUrl] = useState('')
  const [zona, setZona] = useState('')
  const [skills, setSkills] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [website, setWebsite] = useState('')

  const [cvFile, setCvFile] = useState<File | null>(null)
  const [tituloFile, setTituloFile] = useState<File | null>(null)
  const [tituloUniversitarioFile, setTituloUniversitarioFile] = useState<File | null>(null)
  const [libretaFile, setLibretaFile] = useState<File | null>(null)
  const [portfolioFile, setPortfolioFile] = useState<File | null>(null)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [ok, setOk] = useState(false)

  const currentStep = POSTULACION_WIZARD_STEPS[stepIndex]
  const isLastStep = stepIndex === POSTULACION_WIZARD_STEPS.length - 1

  const formInput = (): PostulacionFormInput => ({
    rubro,
    nivel,
    nombre_completo: nombre,
    email,
    telefono,
    documento,
    titulo_texto: tituloTexto,
    experiencia,
    referencias,
    portfolio_url: portfolioUrl,
    zona_cobertura: zona,
    skills: skills.split(',').map((s) => s.trim()).filter(Boolean),
    mensaje,
    cvFile,
    tituloFile,
    tituloUniversitarioFile,
    libretaFile,
    portfolioFile
  })

  const handleRubroChange = (next: PostulacionRubro) => {
    setRubro(next)
    if (next !== 'diseno') {
      setPortfolioUrl('')
      setPortfolioFile(null)
      setTituloUniversitarioFile(null)
      setLibretaFile(null)
    }
  }

  const goNext = () => {
    setError('')
    const stepErr = validatePostulacionWizardStep(currentStep.id, formInput())
    if (stepErr) {
      setError(stepErr)
      return
    }
    setStepIndex((i) => Math.min(i + 1, POSTULACION_WIZARD_STEPS.length - 1))
  }

  const goBack = () => {
    setError('')
    setStepIndex((i) => Math.max(i - 1, 0))
  }

  const handleSubmit = async () => {
    if (website.trim()) return

    const validationErrors = validatePostulacionForm(formInput())
    if (validationErrors.length > 0) {
      setError(validationErrors[0])
      return
    }

    setLoading(true)
    setError('')

    try {
      const [cv, titulo, tituloUni, libreta, portfolio] = await Promise.all([
        uploadIfPresent(cvFile, 'cv'),
        uploadIfPresent(tituloFile, 'titulos'),
        uploadIfPresent(tituloUniversitarioFile, 'titulos-universitarios'),
        uploadIfPresent(libretaFile, 'libretas'),
        uploadIfPresent(portfolioFile, 'portfolios')
      ])

      if (!cv.url) {
        setError('No se pudo subir el CV.')
        setLoading(false)
        return
      }

      const res = await enviarSolicitudOperarioExterno({
        rubro,
        nivel,
        nombre_completo: nombre.trim(),
        email: email.trim(),
        experiencia: experiencia.trim(),
        telefono: telefono.trim() || undefined,
        documento: documento.trim() || undefined,
        titulo_texto: tituloTexto.trim() || undefined,
        referencias: referencias.trim() || undefined,
        portfolio_url: portfolioUrl.trim() ? normalizePortfolioUrl(portfolioUrl) : undefined,
        mensaje: mensaje.trim() || undefined,
        zona_cobertura: zona.trim() || undefined,
        skills: skills.split(',').map((s) => s.trim()).filter(Boolean),
        cv_url: cv.url,
        cv_nombre: cv.nombre ?? 'cv.pdf',
        titulo_url: titulo.url,
        titulo_nombre: titulo.nombre,
        titulo_universitario_url: tituloUni.url,
        titulo_universitario_nombre: tituloUni.nombre,
        libreta_url: libreta.url,
        libreta_nombre: libreta.nombre,
        portfolio_archivo_url: portfolio.url,
        portfolio_archivo_nombre: portfolio.nombre
      })

      if (!res.success) {
        setError(res.error || 'No se pudo enviar la postulación')
        return
      }
      setOk(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al enviar la postulación')
    } finally {
      setLoading(false)
    }
  }

  const progressPct = Math.round(((stepIndex + 1) / POSTULACION_WIZARD_STEPS.length) * 100)

  if (ok) {
    const panelLink = isOperarioExternoRol(usuario?.rol)
      ? operarioExternoHomeRoute(usuario.rol)
      : null
    const dashboardLink = panelLink ?? OPERARIO_EXTERNO_LOGIN
    return (
      <div className="phi-root operario-solicitud-page operario-solicitud-page--ok">
        <div className="operario-solicitud-card operario-solicitud-card--ok">
          <div className="operario-solicitud-ok-icon" aria-hidden>
            <CheckCircle2 size={36} strokeWidth={2} />
          </div>
          <img src={LOGO_URL} alt="Plot Center" className="operario-solicitud-logo" />
          <h1>¡Postulación enviada!</h1>
          <p>
            Recibimos tu solicitud como <strong>{rubroLabel(rubro)}</strong> ({nivelLabel(nivel)}).
            {panelLink
              ? ' Ya podés entrar a tu panel de operario externo.'
              : ' Si es aprobada, te vamos a notificar por email con tu usuario de acceso.'}
          </p>
          <Link to={dashboardLink} className="phi-btn phi-btn--dark phi-btn--lg">
            {panelLink ? 'Ir a mi panel' : 'Ir al ingreso de operarios'}
          </Link>
        </div>
      </div>
    )
  }

  const docAccept = POSTULACION_DOC_EXT.map((e) => `.${e}`).join(',')
  const imageAccept = POSTULACION_IMAGE_EXT.map((e) => `.${e}`).join(',')
  const portfolioAccept = POSTULACION_PORTFOLIO_EXT.map((e) => `.${e}`).join(',')

  const refsObligatorias = requiereReferenciasObligatorias(rubro, nivel)
  const refsRecomendadas = referenciasRecomendadas(rubro, nivel)
  const needLibreta = requiereLibretaDiseno(rubro, nivel)
  const needTituloCert = requiereTituloCertificado(nivel)
  const tituloOpcional = tituloCertificadoOpcional(nivel)
  const needTituloUni = requiereTituloUniversitarioDiseno(rubro, nivel)
  const esDiseno = rubro === 'diseno'

  const renderStep = (step: PostulacionWizardStep) => {
    switch (step) {
      case 'rubro':
        return (
          <>
            <section className="operario-solicitud-section">
              <h2>¿En qué rubro te postulás?</h2>
              <div className="operario-solicitud-rubros" role="radiogroup" aria-label="Rubro">
                {POSTULACION_RUBROS.map((r) => {
                  const Icon = RUBRO_ICONS[r.id]
                  return (
                    <button
                      key={r.id}
                      type="button"
                      className={`operario-solicitud-rubro${rubro === r.id ? ' is-active' : ''}`}
                      onClick={() => handleRubroChange(r.id)}
                      aria-pressed={rubro === r.id}
                    >
                      <span className="operario-solicitud-rubro__icon">
                        <Icon size={18} strokeWidth={1.75} aria-hidden />
                      </span>
                      <strong>{r.label}</strong>
                      <span>{r.desc}</span>
                    </button>
                  )
                })}
              </div>
            </section>
            <section className="operario-solicitud-section">
              <h2>¿Cuál es tu nivel?</h2>
              <div className="operario-solicitud-niveles" role="radiogroup" aria-label="Nivel">
                {POSTULACION_NIVELES.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    className={`operario-solicitud-nivel${nivel === n.id ? ' is-active' : ''}`}
                    onClick={() => setNivel(n.id)}
                    aria-pressed={nivel === n.id}
                  >
                    <strong>{n.label}</strong>
                    <span>{n.hint}</span>
                  </button>
                ))}
              </div>
              {needLibreta && (
                <p className="operario-solicitud-note">
                  Como estudiante de diseño vas a necesitar subir la libreta universitaria en el paso de
                  documentación.
                </p>
              )}
            </section>
          </>
        )

      case 'datos':
        return (
          <section className="operario-solicitud-section">
            <h2>Datos personales</h2>
            <div className="operario-solicitud-grid">
              <label>
                Nombre completo *
                <input value={nombre} onChange={(e) => setNombre(e.target.value)} disabled={loading} />
              </label>
              <label>
                Email *
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                />
              </label>
              <label>
                Teléfono *
                <input
                  type="tel"
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                  placeholder="Ej: 264 4123456"
                  disabled={loading}
                  autoComplete="tel"
                />
              </label>
              <label>
                Documento (DNI) *
                <input
                  value={documento}
                  onChange={(e) => setDocumento(e.target.value)}
                  placeholder="Sin puntos ni espacios"
                  disabled={loading}
                  inputMode="numeric"
                />
              </label>
              <label className="operario-solicitud-grid--full">
                Zona de residencia
                <input
                  value={zona}
                  onChange={(e) => setZona(e.target.value)}
                  placeholder="Ej: San Juan capital, Rivadavia, Chimbas…"
                  disabled={loading}
                />
              </label>
            </div>
          </section>
        )

      case 'formacion':
        return (
          <section className="operario-solicitud-section">
            <h2>Formación y experiencia</h2>
            <label>
              Título / certificación (texto)
              <input
                value={tituloTexto}
                onChange={(e) => setTituloTexto(e.target.value)}
                placeholder="Ej: Diseñador Gráfico — UNCA"
                disabled={loading}
              />
            </label>
            <label>
              Ampliá tu experiencia *
              <textarea
                value={experiencia}
                onChange={(e) => setExperiencia(e.target.value)}
                rows={5}
                placeholder="Contá en qué trabajaste, años de experiencia, herramientas, tipos de clientes…"
                disabled={loading}
              />
            </label>
            <label>
              Referencias {refsObligatorias ? '*' : refsRecomendadas ? '(recomendado)' : '(opcional)'}
              <textarea
                value={referencias}
                onChange={(e) => setReferencias(e.target.value)}
                rows={3}
                placeholder="Nombre, rubro y contacto de referencias laborales (solo para revisión interna)"
                disabled={loading}
              />
            </label>
            <label>
              Skills (separados por coma)
              <input
                value={skills}
                onChange={(e) => setSkills(e.target.value)}
                placeholder="Illustrator, montaje, soldadura MIG…"
                disabled={loading}
              />
            </label>
          </section>
        )

      case 'documentos':
        return (
          <section className="operario-solicitud-section">
            <h2>Documentación</h2>
            <p className="operario-solicitud-hint">
              Máximo {MAX_POSTULACION_MB} MB por archivo. Documentos: PDF, DOC, DOCX.
            </p>

            <FileField
              id="post-cv"
              label="CV"
              required
              hint="Curriculum vitae actualizado."
              accept={docAccept}
              file={cvFile}
              disabled={loading}
              onChange={(f) => {
                const err = validatePostulacionFile(f, POSTULACION_DOC_EXT, 'el CV', true)
                setError(err ?? '')
                if (!err) setCvFile(f)
              }}
            />

            {(needTituloCert || tituloOpcional) && (
              <FileField
                id="post-titulo"
                label="Título o certificación del rubro"
                required={needTituloCert}
                hint={
                  tituloOpcional
                    ? 'Opcional para junior; sumá cursos o certificados si tenés.'
                    : 'Certificado de curso, carnet profesional, recibo de colegio, etc.'
                }
                accept={docAccept}
                file={tituloFile}
                disabled={loading}
                onChange={(f) => {
                  const err = validatePostulacionFile(
                    f,
                    POSTULACION_DOC_EXT,
                    'el título',
                    needTituloCert
                  )
                  setError(err ?? '')
                  if (!err) setTituloFile(f)
                }}
              />
            )}

            {needLibreta && (
              <FileField
                id="post-libreta"
                label="Libreta universitaria / analítico parcial"
                required
                hint="Foto o PDF legible de la libreta o materias aprobadas."
                accept={imageAccept}
                file={libretaFile}
                disabled={loading}
                onChange={(f) => {
                  const err = validatePostulacionFile(f, POSTULACION_IMAGE_EXT, 'la libreta', true)
                  setError(err ?? '')
                  if (!err) setLibretaFile(f)
                }}
              />
            )}

            {needTituloUni && (
              <FileField
                id="post-titulo-uni"
                label="Título universitario o analítico"
                required
                hint="Obligatorio para diseñadores semi-senior, titulados o expertos."
                accept={docAccept}
                file={tituloUniversitarioFile}
                disabled={loading}
                onChange={(f) => {
                  const err = validatePostulacionFile(
                    f,
                    POSTULACION_DOC_EXT,
                    'el título universitario',
                    true
                  )
                  setError(err ?? '')
                  if (!err) setTituloUniversitarioFile(f)
                }}
              />
            )}

            {esDiseno && (
              <>
                <FileField
                  id="post-portfolio-file"
                  label="Portafolio (archivo)"
                  hint={`PDF, ZIP o imágenes. Máx. ${MAX_POSTULACION_MB} MB.`}
                  accept={portfolioAccept}
                  file={portfolioFile}
                  disabled={loading}
                  onChange={(f) => {
                    const err = validatePostulacionFile(
                      f,
                      POSTULACION_PORTFOLIO_EXT,
                      'el portafolio',
                      false
                    )
                    setError(err ?? '')
                    if (!err) setPortfolioFile(f)
                  }}
                />
                <label>
                  Portafolio (URL alternativa)
                  <input
                    type="text"
                    inputMode="url"
                    value={portfolioUrl}
                    onChange={(e) => setPortfolioUrl(e.target.value)}
                    placeholder="behance.net/tu-usuario o https://…"
                    disabled={loading}
                    autoComplete="url"
                  />
                </label>
              </>
            )}
          </section>
        )

      case 'resumen':
        return (
          <section className="operario-solicitud-section">
            <h2>Revisá antes de enviar</h2>
            <dl className="operario-solicitud-resumen">
              <div>
                <dt>Rubro</dt>
                <dd>{rubroLabel(rubro)}</dd>
              </div>
              <div>
                <dt>Nivel</dt>
                <dd>{nivelLabel(nivel)}</dd>
              </div>
              <div>
                <dt>Nombre</dt>
                <dd>{nombre}</dd>
              </div>
              <div>
                <dt>Email</dt>
                <dd>{email}</dd>
              </div>
              {zona && (
                <div>
                  <dt>Residencia</dt>
                  <dd>{zona}</dd>
                </div>
              )}
              <div>
                <dt>CV</dt>
                <dd>{cvFile?.name ?? '—'}</dd>
              </div>
              {esDiseno && (
                <div>
                  <dt>Portafolio</dt>
                  <dd>{portfolioFile?.name ?? (portfolioUrl || '—')}</dd>
                </div>
              )}
            </dl>
            <label>
              Comentarios adicionales
              <textarea
                value={mensaje}
                onChange={(e) => setMensaje(e.target.value)}
                rows={3}
                placeholder="Algo más que quieras contarnos"
                disabled={loading}
              />
            </label>
          </section>
        )

      default:
        return null
    }
  }

  return (
    <div className="phi-root operario-solicitud-page">
      <div className="phi-nav-wrap">
        <nav className="phi-nav" aria-label="phi postulación">
          <a href={PHI_PUBLIC_URL} className="phi-nav-logo" aria-label="Volver a phi">
            <span className="phi-nav-logo-symbol">φ</span>
          </a>
          <div className="phi-nav-links">
            <a href={PHI_PUBLIC_URL} className="phi-nav-link">
              Volver a phi
            </a>
          </div>
          <Link
            to={OPERARIO_EXTERNO_LOGIN}
            className="phi-btn phi-btn--dark phi-btn--icon"
            title="Ingreso operario externo"
          >
            <Mail size={22} strokeWidth={2.5} aria-hidden />
            <span className="phi-sr-only">Ingreso operario externo</span>
          </Link>
        </nav>
      </div>

      <div className="operario-solicitud-shell">
        <aside className="operario-solicitud-hero" aria-label="Información">
          <div className="operario-solicitud-hero__brand">
            <img src={LOGO_URL} alt="Plot Center" className="operario-solicitud-logo" />
            <div>
              <p className="operario-solicitud-hero__eyebrow">phi (φ) · Plot Design</p>
              <h1>
                Sumate a la{' '}
                <span className="phi-highlight phi-highlight--pink">bolsa externa</span>
              </h1>
            </div>
          </div>
          <p className="operario-solicitud-lead">
            Diseño, instalaciones o metalúrgica. Completá el formulario por pasos; revisamos cada
            postulación a mano.
          </p>
          <ul className="operario-solicitud-perks">
            <li>
              <Sparkles size={16} aria-hidden />
              Trabajos asignados desde Plot Design o Bolsa Plot
            </li>
            <li>
              <Briefcase size={16} aria-hidden />
              Panel propio con entregas y cuenta corriente
            </li>
            <li>
              <CheckCircle2 size={16} aria-hidden />
              Chat con clientes por pedido del portal
            </li>
          </ul>
          <div className="operario-solicitud-hero__progress" aria-hidden>
            <div className="operario-solicitud-hero__progress-label">
              <span>Progreso</span>
              <strong>
                Paso {stepIndex + 1} de {POSTULACION_WIZARD_STEPS.length}
              </strong>
            </div>
            <div className="operario-solicitud-hero__bar">
              <div
                className="operario-solicitud-hero__bar-fill"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <div className="operario-solicitud-hero__steps">
              {POSTULACION_WIZARD_STEPS.map((step, index) => (
                <div
                  key={step.id}
                  className={`operario-solicitud-hero__step-item${
                    index === stepIndex ? ' is-current' : ''
                  }${index < stepIndex ? ' is-done' : ''}`}
                >
                  <span className="operario-solicitud-hero__step-dot" />
                  {step.label}
                </div>
              ))}
            </div>
          </div>
        </aside>

        <div className="operario-solicitud-card">
          <div className="operario-solicitud-mobile-head">
            <h2>Postulate como operario externo</h2>
            <p className="operario-solicitud-hint">
              Paso {stepIndex + 1} de {POSTULACION_WIZARD_STEPS.length} · {currentStep.label}
            </p>
          </div>

          <nav
            className="operario-solicitud-wizard operario-solicitud-wizard--mobile"
            aria-label="Pasos del formulario"
          >
            <div className="operario-solicitud-wizard__track">
              {POSTULACION_WIZARD_STEPS.map((step, index) => (
                <div
                  key={step.id}
                  className={`operario-solicitud-wizard__node${
                    index === stepIndex ? ' is-current' : ''
                  }${index < stepIndex ? ' is-done' : ''}`}
                >
                  <span className="operario-solicitud-wizard__num">
                    {index < stepIndex ? '✓' : index + 1}
                  </span>
                  <span className="operario-solicitud-wizard__label">{step.label}</span>
                </div>
              ))}
            </div>
            <p className="operario-solicitud-wizard__current-title">{currentStep.label}</p>
          </nav>

          <div className="operario-solicitud-wizard__panel" key={currentStep.id}>
            {renderStep(currentStep.id)}
          </div>

          <input
            type="text"
            name="website"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            tabIndex={-1}
            autoComplete="off"
            className="operario-solicitud-honeypot"
            aria-hidden
          />

          {error && (
            <p className="operario-solicitud-error" role="alert">
              {error}
            </p>
          )}

          <div className="operario-solicitud-wizard__actions">
            {stepIndex > 0 && (
              <button
                type="button"
                className="phi-btn phi-btn--outline operario-solicitud-btn--ghost"
                onClick={goBack}
                disabled={loading}
              >
                <ArrowLeft size={18} aria-hidden />
                Anterior
              </button>
            )}
            {!isLastStep ? (
              <button
                type="button"
                className="phi-btn phi-btn--dark"
                onClick={goNext}
                disabled={loading}
              >
                Siguiente
                <ArrowRight size={18} aria-hidden />
              </button>
            ) : (
              <button
                type="button"
                className="phi-btn phi-btn--dark"
                onClick={() => void handleSubmit()}
                disabled={loading}
              >
                {loading ? (
                  'Enviando postulación…'
                ) : (
                  <>
                    <Send size={18} aria-hidden />
                    Enviar postulación
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
