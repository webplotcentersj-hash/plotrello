import { useState } from 'react'
import { enviarSolicitudAltaCliente } from '../services/solicitudesAltaClienteService'
import {
  CONDICIONES_CON_CUIT,
  OPCIONES_IVA_FORM,
  SOLICITUD_FORM_VACIO,
  validarSolicitudAltaCliente,
  type ErroresSolicitud,
  type SolicitudAltaClienteForm
} from '../utils/solicitudAltaCliente'
import './SolicitudAltaClientePage.css'

type Campo = keyof SolicitudAltaClienteForm

/** Formulario público (sin login) para que un cliente nuevo pida su alta. */
const SolicitudAltaClientePage = () => {
  const [form, setForm] = useState<SolicitudAltaClienteForm>(SOLICITUD_FORM_VACIO)
  const [errores, setErrores] = useState<ErroresSolicitud>({})
  const [tocado, setTocado] = useState<Partial<Record<Campo, boolean>>>({})
  const [honeypot, setHoneypot] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null)
  const [enviada, setEnviada] = useState(false)

  const set = (campo: Campo, valor: string) => {
    const next = { ...form, [campo]: valor } as SolicitudAltaClienteForm
    setForm(next)
    if (tocado[campo] || errores[campo]) setErrores(validarSolicitudAltaCliente(next))
  }
  const blur = (campo: Campo) => {
    setTocado((t) => ({ ...t, [campo]: true }))
    setErrores(validarSolicitudAltaCliente(form))
  }
  const err = (campo: Campo) => (tocado[campo] ? errores[campo] : undefined)

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorEnvio(null)
    const errs = validarSolicitudAltaCliente(form)
    setErrores(errs)
    setTocado({
      nombre: true,
      apellido: true,
      dniCuit: true,
      telefono: true,
      direccion: true,
      email: true,
      condicionIva: true
    })
    if (Object.keys(errs).length) {
      // Llevar al primer campo con error (en el celular quedan fuera de vista).
      setTimeout(() => {
        const el = document.querySelector<HTMLElement>(
          '.alta-cli-campo.has-error input, .alta-cli-iva.has-error input'
        )
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        el?.focus({ preventScroll: true })
      }, 0)
      return
    }
    setEnviando(true)
    try {
      const res = await enviarSolicitudAltaCliente(form, honeypot)
      if (!res.success) {
        setErrorEnvio(res.error)
        return
      }
      setEnviada(true)
    } finally {
      setEnviando(false)
    }
  }

  const necesitaCuit = form.condicionIva !== '' && CONDICIONES_CON_CUIT.includes(form.condicionIva)

  return (
    <div className="alta-cli-page">
      <div className="alta-cli-card">
        <header className="alta-cli-header">
          <img src="/plot-lab-logo.png" alt="Plot Center" className="alta-cli-logo" />
          <div>
            <h1>Alta de cliente</h1>
            <p>Completá tus datos una sola vez y los usamos para tus pedidos y facturas.</p>
          </div>
        </header>

        {enviada ? (
          <div className="alta-cli-ok" role="status">
            <div className="alta-cli-ok-icon" aria-hidden>
              ✓
            </div>
            <h2>¡Gracias, {form.nombre.trim()}!</h2>
            <p>
              Recibimos tus datos. En cuanto los revisemos quedás registrado como cliente de Plot Center y te
              contactamos si falta algo.
            </p>
          </div>
        ) : (
          <form className="alta-cli-form" onSubmit={enviar} noValidate>
            <div className="alta-cli-row">
              <Campo label="Nombre" error={err('nombre')}>
                <input
                  value={form.nombre}
                  onChange={(e) => set('nombre', e.target.value)}
                  onBlur={() => blur('nombre')}
                  autoComplete="given-name"
                  maxLength={120}
                />
              </Campo>
              <Campo label="Apellido" error={err('apellido')}>
                <input
                  value={form.apellido}
                  onChange={(e) => set('apellido', e.target.value)}
                  onBlur={() => blur('apellido')}
                  autoComplete="family-name"
                  maxLength={120}
                />
              </Campo>
            </div>

            <fieldset className={`alta-cli-iva${err('condicionIva') ? ' has-error' : ''}`}>
              <legend>Condición frente al IVA</legend>
              <div className="alta-cli-iva-grid">
                {OPCIONES_IVA_FORM.map((o) => (
                  <label key={o.valor} className={`alta-cli-iva-op${form.condicionIva === o.valor ? ' is-on' : ''}`}>
                    <input
                      type="radio"
                      name="condicionIva"
                      value={o.valor}
                      checked={form.condicionIva === o.valor}
                      onChange={() => {
                        set('condicionIva', o.valor)
                        setTocado((t) => ({ ...t, condicionIva: true }))
                      }}
                    />
                    <span className="alta-cli-iva-nombre">{o.valor}</span>
                    <span className="alta-cli-iva-ayuda">{o.ayuda}</span>
                  </label>
                ))}
              </div>
              {err('condicionIva') ? <span className="alta-cli-error">{err('condicionIva')}</span> : null}
            </fieldset>

            <div className="alta-cli-row">
              <Campo
                label={necesitaCuit ? 'CUIT' : 'DNI o CUIT'}
                error={err('dniCuit')}
                ayuda={necesitaCuit ? '11 dígitos, sin guiones' : 'Solo números'}
              >
                <input
                  value={form.dniCuit}
                  onChange={(e) => set('dniCuit', e.target.value)}
                  onBlur={() => blur('dniCuit')}
                  inputMode="numeric"
                  maxLength={15}
                />
              </Campo>
              <Campo label="Teléfono" error={err('telefono')} ayuda="Con código de área, ej. 264 412 3456">
                <input
                  type="tel"
                  value={form.telefono}
                  onChange={(e) => set('telefono', e.target.value)}
                  onBlur={() => blur('telefono')}
                  autoComplete="tel"
                  maxLength={30}
                />
              </Campo>
            </div>

            {necesitaCuit ? (
              <Campo label="Razón social (opcional)" ayuda="Si facturás a nombre de una empresa">
                <input
                  value={form.razonSocial}
                  onChange={(e) => set('razonSocial', e.target.value)}
                  autoComplete="organization"
                  maxLength={200}
                />
              </Campo>
            ) : null}

            <Campo label="Domicilio" error={err('direccion')} ayuda="Calle, número, localidad">
              <input
                value={form.direccion}
                onChange={(e) => set('direccion', e.target.value)}
                onBlur={() => blur('direccion')}
                autoComplete="street-address"
                maxLength={300}
              />
            </Campo>

            <Campo label="Email" error={err('email')} ayuda="Ahí te enviamos facturas y avisos">
              <input
                type="email"
                value={form.email}
                onChange={(e) => set('email', e.target.value)}
                onBlur={() => blur('email')}
                autoComplete="email"
                maxLength={200}
              />
            </Campo>

            <Campo label="Comentarios (opcional)">
              <textarea
                value={form.observaciones}
                onChange={(e) => set('observaciones', e.target.value)}
                rows={2}
                maxLength={1000}
              />
            </Campo>

            {/* Campo trampa para bots: oculto a las personas. */}
            <div className="alta-cli-hp" aria-hidden="true">
              <label>
                Sitio web
                <input tabIndex={-1} autoComplete="off" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} />
              </label>
            </div>

            {errorEnvio ? <p className="alta-cli-error-envio">{errorEnvio}</p> : null}

            <button type="submit" className="alta-cli-submit" disabled={enviando}>
              {enviando ? 'Enviando…' : 'Enviar mis datos'}
            </button>
            <p className="alta-cli-legal">
              Usamos estos datos solo para registrarte como cliente y emitir tus comprobantes (Ley 25.326).
            </p>
          </form>
        )}
      </div>
    </div>
  )
}

function Campo(props: { label: string; error?: string; ayuda?: string; children: React.ReactNode }) {
  return (
    <label className={`alta-cli-campo${props.error ? ' has-error' : ''}`}>
      <span className="alta-cli-label">{props.label}</span>
      {props.children}
      {props.error ? (
        <span className="alta-cli-error">{props.error}</span>
      ) : props.ayuda ? (
        <span className="alta-cli-ayuda">{props.ayuda}</span>
      ) : null}
    </label>
  )
}

export default SolicitudAltaClientePage
