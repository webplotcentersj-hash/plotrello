import { useEffect, useMemo, useState } from 'react'
import SignaturePad from '../../../components/SignaturePad'
import { BILLETE_DENOMINACIONES, TURNOS_CAJA } from '../constants'
import {
  getParams,
  listCajas,
  resolveCajaSlugForUsuario,
  resolveCajaSlugFromHistorial,
  saveArqueo
} from '../cajaRepository'
import { DEFAULT_CAJERAS } from '../constants'
import { setStoredCajaSlug } from '../cajaUsuarioDisplay'
import { fmtArs, fmtArs0, parseNum } from '../format'
import { getArgentinaDateString } from '../../../utils/dateUtils'
import type { CajaRegistro } from '../types'

type Props = {
  usuarioNombre: string
  usuarioId?: number
  soloCajasOperativas?: boolean
  /** Vista cajera: caja asociada al usuario; selector solo si no se puede resolver. */
  fijarCajaUsuario?: boolean
  onSaved?: () => void
}

export default function CajaSectionArqueo({
  usuarioNombre,
  usuarioId,
  soloCajasOperativas = true,
  fijarCajaUsuario = false,
  onSaved
}: Props) {
  const [cajas, setCajas] = useState<CajaRegistro[]>([])
  const [fecha, setFecha] = useState(getArgentinaDateString())
  const [cajaSlug, setCajaSlug] = useState('')
  const [cajaAutoAsignada, setCajaAutoAsignada] = useState(false)
  const [cajaResolviendo, setCajaResolviendo] = useState(fijarCajaUsuario)
  const [turno, setTurno] = useState<string>('Único')
  const [billetes, setBilletes] = useState<Record<string, number>>({})
  const [firmaDataUrl, setFirmaDataUrl] = useState<string | null>(null)
  const [firmaPadKey, setFirmaPadKey] = useState(0)
  const [firmaError, setFirmaError] = useState<string | undefined>()
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setCajaResolviendo(fijarCajaUsuario)

    void Promise.all([listCajas(), fijarCajaUsuario ? getParams() : Promise.resolve(null)]).then(
      async ([list, params]) => {
        const filtered = soloCajasOperativas
          ? list.filter((c) => c.slug !== 'admin' && c.slug !== 'vuelto')
          : list
        if (cancelled) return
        setCajas(filtered)

        if (!fijarCajaUsuario) {
          if (filtered.length) setCajaSlug((prev) => prev || filtered[0].slug)
          setCajaAutoAsignada(false)
          setCajaResolviendo(false)
          return
        }

        const cajeras = params?.cajeras?.length ? params.cajeras : DEFAULT_CAJERAS
        let slug =
          resolveCajaSlugForUsuario(usuarioNombre, filtered, cajeras, { usuarioId }) ?? ''

        if (!slug && usuarioId) {
          slug = (await resolveCajaSlugFromHistorial(usuarioId, filtered)) ?? ''
        }

        if (cancelled) return
        setCajaSlug(slug)
        setCajaAutoAsignada(!!slug)
        setCajaResolviendo(false)
      }
    )

    return () => {
      cancelled = true
    }
  }, [soloCajasOperativas, fijarCajaUsuario, usuarioNombre, usuarioId])

  const onCajaManual = (slug: string) => {
    setCajaSlug(slug)
    if (usuarioId && slug) setStoredCajaSlug(usuarioId, slug)
  }

  const total = useMemo(() => {
    return BILLETE_DENOMINACIONES.reduce((sum, d) => {
      const q = billetes[`b${d}`] ?? 0
      return sum + q * d
    }, 0)
  }, [billetes])

  const setCantidad = (denom: number, raw: string) => {
    const q = Math.max(0, Math.floor(parseNum(raw)))
    setBilletes((prev) => ({ ...prev, [`b${denom}`]: q }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!cajaSlug) {
      setMsg(
        fijarCajaUsuario
          ? 'Elegí tu caja en el listado. Si no aparece, pedí a administración que te agregue en Maestros → Cajeras.'
          : 'Elegí una caja.'
      )
      return
    }
    if (!firmaDataUrl) {
      setFirmaError('Tenés que firmar en el recuadro antes de guardar.')
      return
    }
    setFirmaError(undefined)
    setSaving(true)
    setMsg(null)
    try {
      await saveArqueo({
        fecha,
        caja_slug: cajaSlug,
        turno,
        id_usuario: usuarioId ?? null,
        usuario_nombre: usuarioNombre,
        billetes,
        total,
        firma_data_url: firmaDataUrl
      })
      if (usuarioId) setStoredCajaSlug(usuarioId, cajaSlug)
      setMsg(`Arqueo guardado — total $ ${fmtArs(total)}`)
      setBilletes({})
      setFirmaDataUrl(null)
      setFirmaPadKey((k) => k + 1)
      onSaved?.()
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'No se pudo guardar')
    } finally {
      setSaving(false)
    }
  }

  const cajaAsignadaNombre = cajas.find((c) => c.slug === cajaSlug)?.nombre ?? ''
  const mostrarSelectorCaja =
    fijarCajaUsuario && !cajaResolviendo && (!cajaAutoAsignada || !cajaSlug)

  return (
    <form className="caja-cc-form" onSubmit={(e) => void handleSubmit(e)}>
      <div className="caja-cc-help">
        Contá los billetes de tu caja. El total se calcula solo y queda firmado a tu nombre.
      </div>
      <div className="caja-cc-card">
        <h3>Identificación</h3>
        <div className="caja-cc-grid-3">
          <label className="caja-cc-field">
            Fecha
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required />
          </label>
          <label className="caja-cc-field">
            Caja
            {cajaResolviendo ? (
              <input type="text" readOnly value="Identificando…" />
            ) : mostrarSelectorCaja ? (
              <>
                <select
                  value={cajaSlug}
                  onChange={(e) => onCajaManual(e.target.value)}
                  required
                >
                  <option value="">Elegir tu caja…</option>
                  {cajas.map((c) => (
                    <option key={c.slug} value={c.slug}>
                      {c.nombre}
                    </option>
                  ))}
                </select>
                <span className="caja-cc-field-hint">
                  Tu usuario no está en Maestros; elegí la caja una vez y quedará guardada.
                </span>
              </>
            ) : (
              <input type="text" readOnly value={cajaAsignadaNombre || '—'} />
            )}
          </label>
          <label className="caja-cc-field">
            Turno
            <select value={turno} onChange={(e) => setTurno(e.target.value)}>
              {TURNOS_CAJA.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
      <div className="caja-cc-card">
        <h3>Conteo de billetes</h3>
        {BILLETE_DENOMINACIONES.map((d) => {
          const q = billetes[`b${d}`] ?? 0
          const sub = q * d
          return (
            <div key={d} className="caja-cc-bill-row">
              <span className="caja-cc-bill-label">$ {fmtArs0(d)}</span>
              <input
                type="number"
                min={0}
                step={1}
                value={billetes[`b${d}`] ?? ''}
                onChange={(e) => setCantidad(d, e.target.value)}
                placeholder="0"
              />
              <span className={`caja-cc-bill-sub ${q ? 'has' : ''}`}>
                {q ? `$ ${fmtArs(sub)}` : '—'}
              </span>
            </div>
          )
        })}
      </div>
      <div className="caja-cc-result neutral">
        <span>Total contado</span>
        <strong>$ {fmtArs(total)}</strong>
      </div>
      <div className="caja-cc-card caja-cc-signature-block">
        <SignaturePad
          key={firmaPadKey}
          label={`Firma — ${usuarioNombre}`}
          value={firmaDataUrl}
          onChange={(url) => {
            setFirmaDataUrl(url)
            if (url) setFirmaError(undefined)
          }}
          error={firmaError}
        />
      </div>
      {msg && <p className={msg.startsWith('Arqueo') ? 'caja-cc-ok' : 'caja-cc-error'}>{msg}</p>}
      <div className="caja-cc-actions">
        <button
          type="submit"
          className="btn-primary"
          disabled={saving || cajaResolviendo}
        >
          {saving ? 'Guardando…' : 'Guardar y firmar'}
        </button>
      </div>
    </form>
  )
}
