import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { armarCodigoBarrasAfip, codigoBarrasItfSvg } from '../utils/codigoBarrasAfip'
import './GeneradorCodigoBarrasAfipPage.css'

const MODULO_MIN_MM = 0.191

const TIPOS_COMPROBANTE: Array<{ grupo: string; opciones: Array<{ codigo: string; label: string }> }> = [
  {
    grupo: 'Facturas',
    opciones: [
      { codigo: '01', label: 'Factura A' },
      { codigo: '06', label: 'Factura B' },
      { codigo: '11', label: 'Factura C' },
      { codigo: '51', label: 'Factura M' }
    ]
  },
  {
    grupo: 'Notas de débito',
    opciones: [
      { codigo: '02', label: 'Nota de Débito A' },
      { codigo: '07', label: 'Nota de Débito B' },
      { codigo: '12', label: 'Nota de Débito C' },
      { codigo: '52', label: 'Nota de Débito M' }
    ]
  },
  {
    grupo: 'Notas de crédito',
    opciones: [
      { codigo: '03', label: 'Nota de Crédito A' },
      { codigo: '08', label: 'Nota de Crédito B' },
      { codigo: '13', label: 'Nota de Crédito C' },
      { codigo: '53', label: 'Nota de Crédito M' }
    ]
  },
  {
    grupo: 'Recibos',
    opciones: [
      { codigo: '04', label: 'Recibo A' },
      { codigo: '09', label: 'Recibo B' },
      { codigo: '15', label: 'Recibo C' },
      { codigo: '54', label: 'Recibo M' }
    ]
  }
]

function descargar(nombre: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  a.click()
  URL.revokeObjectURL(url)
}

export default function GeneradorCodigoBarrasAfipPage() {
  const [cuit, setCuit] = useState('')
  const [tipo, setTipo] = useState('01')
  const [tipoOtro, setTipoOtro] = useState('')
  const [puntoVenta, setPuntoVenta] = useState('')
  const [cae, setCae] = useState('')
  const [vencimiento, setVencimiento] = useState('')
  const [moduloMm, setModuloMm] = useState('0.33')
  const [altoMm, setAltoMm] = useState('13')
  const [copiado, setCopiado] = useState(false)

  const tipoEfectivo = tipo === 'otro' ? tipoOtro : tipo
  const faltantes = [
    !cuit.trim() && 'CUIT',
    !tipoEfectivo.trim() && 'tipo de comprobante',
    !puntoVenta.trim() && 'punto de venta',
    !cae.trim() && 'CAI/CAE',
    !vencimiento && 'vencimiento'
  ].filter(Boolean) as string[]

  const modulo = Math.max(MODULO_MIN_MM, Number(moduloMm) || MODULO_MIN_MM)
  const alto = Math.max(5, Number(altoMm) || 13)

  const completo = faltantes.length === 0
  const { codigo, error } = useMemo(() => {
    if (!completo) return { codigo: null, error: null }
    try {
      return {
        codigo: armarCodigoBarrasAfip({ cuit, tipoComprobante: tipoEfectivo, puntoVenta, cae, vencimiento }),
        error: null
      }
    } catch (e) {
      return { codigo: null, error: e instanceof Error ? e.message : 'No se pudo generar el código.' }
    }
  }, [completo, cuit, tipoEfectivo, puntoVenta, cae, vencimiento])

  const svg = useMemo(
    () => (codigo ? codigoBarrasItfSvg(codigo, { moduloMm: modulo, altoMm: alto, conTexto: true }) : ''),
    [codigo, modulo, alto]
  )

  const copiar = async () => {
    if (!codigo) return
    try {
      await navigator.clipboard.writeText(codigo)
      setCopiado(true)
      window.setTimeout(() => setCopiado(false), 1800)
    } catch {
      window.prompt('Copiá el número:', codigo)
    }
  }

  const descargarSvg = () => {
    if (codigo) descargar(`codigo-barras-${codigo}.svg`, new Blob([svg], { type: 'image/svg+xml' }))
  }

  const descargarPng = () => {
    if (!codigo) return
    const img = new Image()
    img.onload = () => {
      const pxPorModulo = 4
      const vb = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(svg)
      const w = Math.round(Number(vb?.[1] ?? 0) * pxPorModulo)
      const h = Math.round(Number(vb?.[2] ?? 0) * pxPorModulo)
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, w, h)
      ctx.drawImage(img, 0, 0, w, h)
      canvas.toBlob((blob) => blob && descargar(`codigo-barras-${codigo}.png`, blob), 'image/png')
    }
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  }

  return (
    <main className="cbafip">
      <header className="cbafip__head cbafip__noprint">
        <div className="cbafip__head-row">
          <div>
            <h1>Generador de código de barras AFIP</h1>
            <p>
              Código de barras de comprobantes según la RG 1702 (Interleaved 2 of 5, 40 dígitos). Funciona
              para cualquier emisor: cargá los datos del comprobante y se genera al instante.
            </p>
          </div>
          <div className="cbafip__head-actions">
            <a href="/lector-afip/" target="_blank" rel="noopener noreferrer" className="cbafip__volver">
              Lector cámara
            </a>
            <Link to="/erp" className="cbafip__volver">
              ← ERP
            </Link>
          </div>
        </div>
      </header>

      <div className="cbafip__layout">
        <form className="cbafip__form cbafip__noprint" onSubmit={(e) => e.preventDefault()} autoComplete="off">
          <label>
            CUIT del emisor
            <input
              inputMode="numeric"
              placeholder="30-71551880-1"
              value={cuit}
              onChange={(e) => setCuit(e.target.value)}
            />
          </label>

          <label>
            Tipo de comprobante
            <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
              {TIPOS_COMPROBANTE.map((g) => (
                <optgroup key={g.grupo} label={g.grupo}>
                  {g.opciones.map((o) => (
                    <option key={o.codigo} value={o.codigo}>
                      {o.label} ({o.codigo})
                    </option>
                  ))}
                </optgroup>
              ))}
              <option value="otro">Otro código…</option>
            </select>
          </label>

          {tipo === 'otro' && (
            <label>
              Código AFIP (2 dígitos)
              <input
                inputMode="numeric"
                maxLength={2}
                placeholder="19"
                value={tipoOtro}
                onChange={(e) => setTipoOtro(e.target.value.replace(/\D/g, ''))}
              />
            </label>
          )}

          <div className="cbafip__row">
            <label>
              Punto de venta
              <input
                inputMode="numeric"
                maxLength={4}
                placeholder="0001"
                value={puntoVenta}
                onChange={(e) => setPuntoVenta(e.target.value.replace(/\D/g, ''))}
              />
            </label>
            <label>
              Vencimiento del CAI / CAE
              <input type="date" value={vencimiento} onChange={(e) => setVencimiento(e.target.value)} />
            </label>
          </div>

          <label>
            CAI / CAE (14 dígitos)
            <input
              inputMode="numeric"
              maxLength={14}
              placeholder="86406405514474"
              value={cae}
              onChange={(e) => setCae(e.target.value.replace(/\D/g, ''))}
            />
          </label>

          <fieldset>
            <legend>Tamaño al imprimir</legend>
            <div className="cbafip__row">
              <label>
                Módulo (mm)
                <input
                  type="number"
                  step="0.01"
                  min={MODULO_MIN_MM}
                  value={moduloMm}
                  onChange={(e) => setModuloMm(e.target.value)}
                />
              </label>
              <label>
                Alto de barras (mm)
                <input type="number" step="1" min="5" value={altoMm} onChange={(e) => setAltoMm(e.target.value)} />
              </label>
            </div>
            {Number(moduloMm) > 0 && Number(moduloMm) < MODULO_MIN_MM && (
              <p className="cbafip__aviso">La norma exige un módulo de al menos 0,191 mm; se usa ese valor.</p>
            )}
          </fieldset>
        </form>

        <section className="cbafip__salida" aria-live="polite">
          {codigo ? (
            <>
              <div className="cbafip__hoja" dangerouslySetInnerHTML={{ __html: svg }} />
              <div className="cbafip__acciones cbafip__noprint">
                <button type="button" onClick={copiar}>
                  {copiado ? 'Copiado' : 'Copiar número'}
                </button>
                <button type="button" onClick={descargarSvg}>
                  Descargar SVG
                </button>
                <button type="button" onClick={descargarPng}>
                  Descargar PNG
                </button>
                <button type="button" onClick={() => window.print()}>
                  Imprimir
                </button>
              </div>
            </>
          ) : error ? (
            <p className="cbafip__error" role="alert">
              {error}
            </p>
          ) : (
            <p className="cbafip__vacio">Falta completar: {faltantes.join(', ')}.</p>
          )}
        </section>
      </div>
    </main>
  )
}
