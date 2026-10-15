import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import ReciboSueldoLct from '../components/ReciboSueldoLct'
import apiService from '../services/api'
import {
  rrhhDocItemAgregar,
  rrhhDocLoteActualizarEstado,
  rrhhDocLoteCrear,
  rrhhDocLotesListar,
  rrhhDocSubirArchivo,
  rrhhLegajosOrgListar,
  rrhhLibroSueldosItemsReemplazar,
  rrhhLibroSueldosItemsListar,
  rrhhLibroSueldosObtener,
  rrhhLibroSueldosUpsert,
  rrhhPuestosListar,
  rrhhSueldoFichasListar,
  rrhhSueldoFichasUpsert
} from '../services/rrhhExtendidoService'
import {
  ALICUOTA_CAMPOS,
  CCTS_PLOT,
  EMPRESA_LCT_DEFAULT,
  extraVacio,
  cctEnConvenio,
  importeToEdit,
  mergeAlicuotas,
  parseImporteInput,
  aniosAntiguedadAlPeriodo,
  antiguedadMesesAlPeriodo,
  fichaDesdeItem,
  formatArs2,
  liquidarRecibo,
  numerosLiquidacion,
  type RrhhLibroSueldos,
  type RrhhLibroSueldosItem,
  type RrhhSueldoFicha
} from '../utils/rrhhLibroSueldos'
import { descargarTxtLsd } from '../utils/exportLibroSueldosLsd'
import { exportarLibroSueldosXlsx } from '../utils/exportLibroSueldosXlsx'
import { descargarElementoPdf, elementoAPdfBlob } from '../utils/exportReciboSueldoPdf'
import { nombreSinDominioCorreo } from '../utils/userDisplayName'
import './rrhhExtendido.css'
import './RecursosHumanosLibroSueldosPage.css'

function mesActualYm(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function periodoAnterior(periodo: string): string {
  const [y, m] = periodo.split('-').map(Number)
  const d = new Date(y, m - 2, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function apellidoNombre(apellido: string, nombre: string): string {
  const a = nombreSinDominioCorreo(apellido)
  const n = nombreSinDominioCorreo(nombre)
  return `${a} ${n}`.trim()
}

function ImporteField(props: {
  value: number
  disabled?: boolean
  onCommit: (n: number) => void
  className?: string
}) {
  const [txt, setTxt] = useState<string | null>(null)
  return (
    <input
      type="text"
      inputMode="decimal"
      className={props.className}
      value={txt ?? importeToEdit(props.value)}
      disabled={props.disabled}
      onFocus={() => setTxt(importeToEdit(props.value))}
      onChange={(e) => setTxt(e.target.value)}
      onBlur={() => {
        props.onCommit(parseImporteInput(txt ?? '') ?? 0)
        setTxt(null)
      }}
    />
  )
}

type ItemDraft = Omit<RrhhLibroSueldosItem, 'id' | 'id_libro'> & { id?: number; id_libro?: number }

const RecursosHumanosLibroSueldosPage = () => {
  const navigate = useNavigate()
  const { usuario, canManageRecursosHumanos, loading: authLoading } = useAuth()
  const canAccess = !!usuario && (canManageRecursosHumanos || usuario.rol === 'gerencia')

  const [periodo, setPeriodo] = useState(mesActualYm)
  const [libro, setLibro] = useState<RrhhLibroSueldos | null>(null)
  const [items, setItems] = useState<ItemDraft[]>([])
  const [sel, setSel] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const previewRef = useRef<HTMLDivElement>(null)

  const cerrado = libro?.estado === 'cerrado'

  useEffect(() => {
    if (authLoading) return
    if (!canAccess) navigate('/rrhh')
  }, [authLoading, canAccess, navigate])

  const armarAltas = useCallback(
    async (
      libroId: number,
      scvoDefault: number,
      prevItems: RrhhLibroSueldosItem[],
      fichas: RrhhSueldoFicha[]
    ): Promise<ItemDraft[]> => {
      const [orgRes, puestoRes, legRes] = await Promise.all([
        rrhhLegajosOrgListar(),
        rrhhPuestosListar(),
        apiService.obtenerLegajosBasico()
      ])
      const puestos = new Map((puestoRes.data || []).map((p) => [p.id, p.nombre]))
      const fichaBy = new Map(fichas.map((f) => [f.id_usuario, f]))
      const prevBy = new Map(prevItems.map((i) => [i.id_usuario, i]))
      const rows = orgRes.data || []
      return rows
        .map((r, idx) => {
          const prev = prevBy.get(r.id_usuario)
          const ficha = fichaBy.get(r.id_usuario)
          const nombre = apellidoNombre(r.apellido, r.nombre)
          const fechaIngreso =
            prev?.fecha_ingreso || legRes.data?.[r.id_usuario]?.fecha_ingreso || null
          const anios = aniosAntiguedadAlPeriodo(fechaIngreso, periodo)
          const meses = antiguedadMesesAlPeriodo(fechaIngreso, periodo)
          const categoria = prev?.categoria || ficha?.categoria || puestos.get(r.id_puesto || 0) || r.sector || ''
          const medio = /medio/i.test(ficha?.etiqueta_basico || prev?.etiqueta_basico || '')
          return {
            id: prev?.id,
            id_libro: libroId,
            id_usuario: r.id_usuario,
            incluido: prev?.incluido ?? true,
            n_legajo: prev?.n_legajo || ficha?.n_legajo || idx + 1,
            apellido_nombre: prev?.apellido_nombre || nombre,
            cuil: prev?.cuil || ficha?.cuil || '',
            categoria,
            fecha_ingreso: fechaIngreso,
            antiguedad_reconocida: prev?.antiguedad_reconocida ?? ficha?.antiguedad_reconocida ?? meses,
            anios_antiguedad: prev?.anios_antiguedad ?? anios,
            dias: prev?.dias || 30,
            etiqueta_basico: prev?.etiqueta_basico || ficha?.etiqueta_basico || (medio ? 'Sueldo básico medio día' : 'Sueldo básico'),
            sueldo_basico: prev?.sueldo_basico ?? ficha?.sueldo_basico ?? 0,
            adicional_antiguedad: prev?.adicional_antiguedad ?? ficha?.adicional_antiguedad ?? 0,
            scvo: prev?.scvo ?? ficha?.scvo ?? scvoDefault,
            banco: prev?.banco ?? ficha?.banco ?? null,
            cbu: prev?.cbu ?? ficha?.cbu ?? null,
            forma_pago: prev?.forma_pago || ficha?.forma_pago || '1',
            conyuge: prev?.conyuge ?? ficha?.conyuge ?? false,
            hijos: prev?.hijos ?? ficha?.hijos ?? 0,
            cct: prev?.cct ?? ficha?.cct ?? cctEnConvenio(prev?.cct_codigo || ficha?.cct_codigo || '0409/05'),
            cct_codigo:
              prev?.cct_codigo ||
              ficha?.cct_codigo ||
              (/admin/i.test(categoria) ? '9999/99' : '0409/05'),
            cobertura_scvo: prev?.cobertura_scvo ?? ficha?.cobertura_scvo ?? true,
            situacion_revista: prev?.situacion_revista || ficha?.situacion_revista || '01',
            condicion: prev?.condicion || ficha?.condicion || '01',
            actividad: prev?.actividad ?? ficha?.actividad ?? null,
            modalidad: prev?.modalidad || ficha?.modalidad || (medio ? '008' : '001'),
            codigo_os: prev?.codigo_os ?? ficha?.codigo_os ?? null,
            horas_trabajadas: prev?.horas_trabajadas || 0,
            extras: prev?.extras ? prev.extras.map((x) => ({ ...x })) : []
          } satisfies ItemDraft
        })
        .sort((a, b) => a.n_legajo - b.n_legajo || a.apellido_nombre.localeCompare(b.apellido_nombre, 'es'))
    },
    [periodo]
  )

  const cargar = useCallback(async () => {
    setLoading(true)
    setError(null)
    setMsg(null)
    try {
      const [libRes, fichasRes] = await Promise.all([
        rrhhLibroSueldosObtener(periodo),
        rrhhSueldoFichasListar()
      ])
      if (!libRes.success) throw new Error(libRes.error || 'No se pudo leer el libro')
      let actual = libRes.data
      if (!actual) {
        const created = await rrhhLibroSueldosUpsert({
          periodo,
          created_by: usuario?.id ?? null,
          patch: {
            empresa_nombre: EMPRESA_LCT_DEFAULT.nombre,
            empresa_domicilio: EMPRESA_LCT_DEFAULT.domicilio,
            empresa_cuit: EMPRESA_LCT_DEFAULT.cuit,
            jurisdiccion: EMPRESA_LCT_DEFAULT.jurisdiccion,
            art_codigo: EMPRESA_LCT_DEFAULT.artCodigo,
            scvo_cia: EMPRESA_LCT_DEFAULT.scvoCia,
            cct_default: '0409/05',
            alicuotas: mergeAlicuotas()
          }
        })
        if (!created.success || !created.data) throw new Error(created.error || 'No se pudo crear el libro')
        actual = created.data
      }
      setLibro(actual)
      const itemsRes = await rrhhLibroSueldosItemsListar(actual.id)
      if (!itemsRes.success) throw new Error(itemsRes.error || 'No se pudieron leer los ítems')
      if (itemsRes.data && itemsRes.data.length > 0) {
        setItems(itemsRes.data)
        setSel(itemsRes.data[0]?.id_usuario ?? null)
      } else {
        const prevLib = await rrhhLibroSueldosObtener(periodoAnterior(periodo))
        let prevItems: RrhhLibroSueldosItem[] = []
        if (prevLib.success && prevLib.data) {
          const prev = await rrhhLibroSueldosItemsListar(prevLib.data.id)
          if (prev.success && prev.data) prevItems = prev.data
        }
        const altas = await armarAltas(actual.id, actual.scvo_default, prevItems, fichasRes.data || [])
        setItems(altas)
        setSel(altas[0]?.id_usuario ?? null)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar')
    } finally {
      setLoading(false)
    }
  }, [armarAltas, periodo, usuario?.id])

  useEffect(() => {
    if (authLoading || !canAccess) return
    void cargar()
  }, [authLoading, canAccess, cargar])

  const patchItem = (idUsuario: number, patch: Partial<ItemDraft>) => {
    setItems((prev) => prev.map((it) => (it.id_usuario === idUsuario ? { ...it, ...patch } : it)))
  }

  const patchLibro = (patch: Partial<RrhhLibroSueldos>) => {
    setLibro((prev) => (prev ? { ...prev, ...patch } : prev))
  }

  const guardar = async (): Promise<boolean> => {
    if (!libro) return false
    setBusy(true)
    setError(null)
    setMsg(null)
    try {
      const up = await rrhhLibroSueldosUpsert({
        periodo: libro.periodo,
        patch: {
          empresa_nombre: libro.empresa_nombre,
          empresa_domicilio: libro.empresa_domicilio,
          empresa_cuit: libro.empresa_cuit,
          jurisdiccion: libro.jurisdiccion,
          cct_default: libro.cct_default,
          art_codigo: libro.art_codigo,
          scvo_cia: libro.scvo_cia,
          banco: libro.banco,
          fecha_pago: libro.fecha_pago,
          scvo_default: libro.scvo_default,
          os_base_mult: libro.os_base_mult,
          nro_liquidacion: libro.nro_liquidacion,
          dias_base: libro.dias_base,
          tipo_empleador: libro.tipo_empleador,
          codigo_actividad: libro.codigo_actividad,
          codigo_localidad: libro.codigo_localidad,
          codigo_os_default: libro.codigo_os_default,
          importe_detraer: libro.importe_detraer,
          alicuotas: libro.alicuotas,
          notas: libro.notas,
          id_lote_recibos: libro.id_lote_recibos
        }
      })
      if (!up.success || !up.data) throw new Error(up.error || 'No se guardó el libro')
      const itemsRes = await rrhhLibroSueldosItemsReemplazar(up.data.id, items)
      if (!itemsRes.success) throw new Error(itemsRes.error || 'No se guardaron los ítems')
      await rrhhSueldoFichasUpsert(items.map((it) => fichaDesdeItem({ ...it, id: it.id || 0, id_libro: up.data!.id })))
      setLibro(up.data)
      if (itemsRes.data) setItems(itemsRes.data)
      setMsg('Libro guardado. Las fichas quedan para el mes siguiente.')
      return true
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar')
      return false
    } finally {
      setBusy(false)
    }
  }

  const itemSel = items.find((i) => i.id_usuario === sel) || items[0] || null
  const itemsDeferred = useDeferredValue(items)
  const libroDeferred = useDeferredValue(libro)
  const selDeferred = useDeferredValue(sel)

  const liq = useMemo(() => {
    if (!libroDeferred) return null
    const it = itemsDeferred.find((i) => i.id_usuario === selDeferred) || itemsDeferred[0]
    if (!it) return null
    return liquidarRecibo({
      item: { ...it, id: it.id || 0, id_libro: it.id_libro || libroDeferred.id },
      libro: libroDeferred
    })
  }, [libroDeferred, itemsDeferred, selDeferred])

  const netos = useMemo(() => {
    const m = new Map<number, number>()
    if (!libro) return m
    for (const it of items) {
      m.set(it.id_usuario, numerosLiquidacion(it as RrhhLibroSueldosItem, libro).neto)
    }
    return m
  }, [items, libro])

  const totales = useMemo(() => {
    if (!libro) return { neto: 0, bruto: 0, costo: 0, n: 0 }
    let n = 0
    let bruto = 0
    let neto = 0
    let costo = 0
    for (const it of items) {
      if (!it.incluido) continue
      const t = numerosLiquidacion(it as RrhhLibroSueldosItem, libro)
      n += 1
      bruto += t.bruto
      neto += t.neto
      costo += t.costoEmpleador
    }
    return { n, bruto, neto, costo }
  }, [items, libro])

  const exportarPdfUno = async () => {
    if (!previewRef.current || !itemSel) return
    setBusy(true)
    try {
      await descargarElementoPdf(
        previewRef.current,
        `recibo_${periodo}_${itemSel.n_legajo}_${itemSel.apellido_nombre.replace(/\s+/g, '_')}`
      )
    } finally {
      setBusy(false)
    }
  }

  const esperarFrame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))

  const enviarEmpleados = async () => {
    if (!libro || !usuario) return
    setBusy(true)
    setError(null)
    setMsg(null)
    try {
      const saved = await guardar()
      if (!saved) return
      setBusy(true)
      const lotes = await rrhhDocLotesListar()
      let lote = (lotes.data || []).find(
        (l) => l.periodo === periodo && l.tipo === 'recibo_sueldo' && (libro.id_lote_recibos ? l.id === libro.id_lote_recibos : true)
      )
      if (!lote) {
        const created = await rrhhDocLoteCrear({
          periodo,
          titulo: `Recibos de sueldo ${periodo}`,
          created_by: usuario.id
        })
        if (!created.success || !created.data) throw new Error(created.error || 'No se pudo crear el lote')
        lote = created.data
      }
      const incluidos = items.filter((i) => i.incluido && (i.sueldo_basico > 0 || i.adicional_antiguedad > 0))
      let ok = 0
      for (const it of incluidos) {
        setSel(it.id_usuario)
        await esperarFrame()
        const el = previewRef.current
        if (!el) throw new Error('No se pudo renderizar el recibo')
        const blob = await elementoAPdfBlob(el)
        const file = new File([blob], `recibo_${periodo}_${it.n_legajo}.pdf`, { type: 'application/pdf' })
        const up = await rrhhDocSubirArchivo(file, it.id_usuario)
        if (!up.success || !up.data) throw new Error(up.error || `Falló el upload de ${it.apellido_nombre}`)
        const add = await rrhhDocItemAgregar({
          id_lote: lote.id,
          id_usuario: it.id_usuario,
          archivo_url: up.data.url,
          archivo_nombre: up.data.nombre
        })
        if (!add.success) throw new Error(add.error || `No se pudo anexar ${it.apellido_nombre}`)
        ok += 1
      }
      await rrhhDocLoteActualizarEstado(lote.id, 'enviado')
      await rrhhLibroSueldosUpsert({ periodo, patch: { id_lote_recibos: lote.id } })
      setLibro((prev) => (prev ? { ...prev, id_lote_recibos: lote!.id } : prev))
      setMsg(`${ok} recibos enviados a Mis recibos. El empleado firma ahí.`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al enviar recibos')
    } finally {
      setBusy(false)
    }
  }

  if (authLoading || (loading && !libro)) {
    return (
      <div className="rrhh-ext-page">
        <p>Cargando libro de sueldos…</p>
      </div>
    )
  }

  return (
    <div className="rrhh-ext-page rrhh-libro-page">
      <header className="rrhh-ext-header">
        <div>
          <h1>Libro de sueldos</h1>
          <p>
            Recibo LCT mensual (modelo Plot Center) y archivo TXT para el{' '}
            <a href="https://www.arca.gob.ar/librodesueldosdigital/" target="_blank" rel="noreferrer">
              Libro de sueldos digital de ARCA
            </a>
            .
          </p>
        </div>
        <button type="button" className="rrhh-ext-btn ghost" onClick={() => navigate('/rrhh')}>
          Volver
        </button>
      </header>

      {error ? <p className="rrhh-ext-error">{error}</p> : null}
      {msg ? <p className="rrhh-libro-msg">{msg}</p> : null}

      <p className="rrhh-libro-note">
        Empleador según Simplificación registral: PLOT CENTER SRL · CUIT 30-71551880-1 · jurisdicción San Juan ·
        CCT 0409/05 Gráficos y 9999/99 excluido · ART sin contrato LRT · SCVO Experta S880. Parametrizá una vez en
        ARCA los códigos SUELDO, ANTIG, SIND, JUB, INSSJP y OS y subí el TXT en Liquidaciones.{' '}
        <a href="https://www.arca.gob.ar/librodesueldosdigital/" target="_blank" rel="noreferrer">
          Libro de sueldos digital
        </a>
        {' · '}
        <a href="https://www.arca.gob.ar/LibrodeSueldosDigital/ayuda/disenios.asp" target="_blank" rel="noreferrer">
          Diseños de registro
        </a>
        .
      </p>

      <div className="rrhh-libro-toolbar">
        <label>
          Período
          <input
            type="month"
            value={periodo}
            onChange={(e) => setPeriodo(e.target.value)}
            disabled={busy}
          />
        </label>
        <label>
          Razón social
          <input
            value={libro?.empresa_nombre || ''}
            onChange={(e) => patchLibro({ empresa_nombre: e.target.value })}
            disabled={cerrado}
          />
        </label>
        <label>
          CUIT empleador
          <input
            value={libro?.empresa_cuit || ''}
            onChange={(e) => patchLibro({ empresa_cuit: e.target.value })}
            disabled={cerrado}
          />
        </label>
        <label>
          Domicilio
          <input
            value={libro?.empresa_domicilio || ''}
            onChange={(e) => patchLibro({ empresa_domicilio: e.target.value })}
            disabled={cerrado}
          />
        </label>
        <label>
          Jurisdicción
          <input
            value={libro?.jurisdiccion || ''}
            onChange={(e) => patchLibro({ jurisdiccion: e.target.value })}
            disabled={cerrado}
          />
        </label>
        <label>
          Banco / acreditación
          <input
            value={libro?.banco || ''}
            onChange={(e) => patchLibro({ banco: e.target.value || null })}
            disabled={cerrado}
          />
        </label>
        <label>
          Fecha de pago
          <input
            type="date"
            value={libro?.fecha_pago || ''}
            onChange={(e) => patchLibro({ fecha_pago: e.target.value || null })}
            disabled={cerrado}
          />
        </label>
        <label>
          SCVO default
          <ImporteField
            value={libro?.scvo_default ?? 0}
            disabled={cerrado}
            onCommit={(n) => patchLibro({ scvo_default: n })}
          />
        </label>
        <label>
          Base OS (× bruto)
          <ImporteField
            value={libro?.os_base_mult ?? 2}
            disabled={cerrado}
            onCommit={(n) => patchLibro({ os_base_mult: n || 2 })}
          />
        </label>
        <label>
          N° liq. ARCA
          <input
            type="number"
            value={libro?.nro_liquidacion ?? 1}
            onChange={(e) => patchLibro({ nro_liquidacion: Number(e.target.value) || 1 })}
            disabled={cerrado}
          />
        </label>
        <label>
          Código OS default
          <input
            value={libro?.codigo_os_default || ''}
            onChange={(e) => patchLibro({ codigo_os_default: e.target.value || null })}
            disabled={cerrado}
            placeholder="6 dígitos"
          />
        </label>
        <label>
          Importe a detraer
          <ImporteField
            value={libro?.importe_detraer ?? 0}
            disabled={cerrado}
            onCommit={(n) => patchLibro({ importe_detraer: n })}
          />
        </label>
        <label>
          ART
          <input
            value={libro?.art_codigo || ''}
            onChange={(e) => patchLibro({ art_codigo: e.target.value })}
            disabled={cerrado}
          />
        </label>
        <label>
          SCVO compañía
          <input
            value={libro?.scvo_cia || ''}
            onChange={(e) => patchLibro({ scvo_cia: e.target.value })}
            disabled={cerrado}
          />
        </label>
      </div>

      <div className="rrhh-ext-card" style={{ marginBottom: 14 }}>
        <h3>Alícuotas del recibo (editables)</h3>
        <p className="rrhh-libro-note" style={{ marginBottom: 8 }}>
          Porcentajes como en el Excel (ej. 10,77). Se aplican a toda la nómina del período.
        </p>
        <div className="rrhh-libro-ali">
          {ALICUOTA_CAMPOS.map((c) => {
            const a = mergeAlicuotas(libro?.alicuotas)
            return (
              <label key={c.key}>
                {c.label} %
                <ImporteField
                  value={Math.round(a[c.key] * 10000) / 100}
                  disabled={cerrado}
                  onCommit={(n) =>
                    patchLibro({
                      alicuotas: { ...a, [c.key]: n / 100 }
                    })
                  }
                />
              </label>
            )
          })}
        </div>
      </div>

      <div className="rrhh-libro-actions" style={{ marginBottom: 14 }}>
        <button type="button" className="rrhh-ext-btn primary" onClick={() => void guardar()} disabled={busy || cerrado}>
          Guardar
        </button>
        <button
          type="button"
          className="rrhh-ext-btn"
          onClick={() => libro && exportarLibroSueldosXlsx(libro, items.map((i) => ({ ...i, id: i.id || 0, id_libro: libro.id })))}
          disabled={!libro || busy}
        >
          Excel libro
        </button>
        <button type="button" className="rrhh-ext-btn" onClick={() => void exportarPdfUno()} disabled={!liq || busy}>
          PDF este recibo
        </button>
        <button
          type="button"
          className="rrhh-ext-btn"
          onClick={() => {
            if (!libro) return
            const r = descargarTxtLsd(
              libro,
              items.map((i) => ({ ...i, id: i.id || 0, id_libro: libro.id }))
            )
            if (r.errores.length) setError(r.errores.join(' · '))
            else setMsg(`TXT ARCA: ${r.nTrab} trabajadores (ANSI, sin comprimir).`)
          }}
          disabled={!libro || busy}
        >
          TXT ARCA / F.931
        </button>
        <button type="button" className="rrhh-ext-btn primary" onClick={() => void enviarEmpleados()} disabled={busy || cerrado}>
          Enviar recibos a empleados
        </button>
        <span className="rrhh-ext-badge">
          {totales.n} incl. · bruto {formatArs2(totales.bruto)} · neto {formatArs2(totales.neto)} · costo{' '}
          {formatArs2(totales.costo)}
        </span>
      </div>

      <div className="rrhh-libro-grid">
        <div className="rrhh-ext-card">
          <h3>Nómina</h3>
          <div className="rrhh-libro-table-wrap">
            <table className="rrhh-ext-table rrhh-libro-table">
              <thead>
                <tr>
                  <th></th>
                  <th>Leg.</th>
                  <th>Empleado</th>
                  <th>CUIL</th>
                  <th>Categoría</th>
                  <th>Ingreso</th>
                  <th>Básico</th>
                  <th>Antig. $</th>
                  <th>SCVO</th>
                  <th>Neto</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => {
                  const n = netos.get(it.id_usuario) || 0
                  return (
                    <tr
                      key={it.id_usuario}
                      className={sel === it.id_usuario ? 'is-sel' : ''}
                      onClick={() => setSel(it.id_usuario)}
                    >
                      <td>
                        <input
                          type="checkbox"
                          checked={it.incluido}
                          disabled={cerrado}
                          onChange={(e) => patchItem(it.id_usuario, { incluido: e.target.checked })}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          value={it.n_legajo}
                          disabled={cerrado}
                          onChange={(e) => patchItem(it.id_usuario, { n_legajo: Number(e.target.value) || 0 })}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          value={it.apellido_nombre}
                          disabled={cerrado}
                          onChange={(e) => patchItem(it.id_usuario, { apellido_nombre: e.target.value })}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          value={it.cuil}
                          disabled={cerrado}
                          onChange={(e) => patchItem(it.id_usuario, { cuil: e.target.value })}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          value={it.categoria || ''}
                          disabled={cerrado}
                          onChange={(e) => patchItem(it.id_usuario, { categoria: e.target.value })}
                        />
                      </td>
                      <td>
                        <input
                          type="date"
                          value={it.fecha_ingreso || ''}
                          disabled={cerrado}
                          onChange={(e) => patchItem(it.id_usuario, { fecha_ingreso: e.target.value || null })}
                        />
                      </td>
                      <td>
                        <ImporteField
                          value={it.sueldo_basico}
                          disabled={cerrado}
                          onCommit={(n) => patchItem(it.id_usuario, { sueldo_basico: n })}
                        />
                      </td>
                      <td>
                        <ImporteField
                          value={it.adicional_antiguedad}
                          disabled={cerrado}
                          onCommit={(n) => patchItem(it.id_usuario, { adicional_antiguedad: n })}
                        />
                      </td>
                      <td>
                        <ImporteField
                          value={it.scvo}
                          disabled={cerrado}
                          onCommit={(n) => patchItem(it.id_usuario, { scvo: n })}
                        />
                      </td>
                      <td>{formatArs2(n)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {itemSel ? (
            <div className="rrhh-libro-emp">
              <label>
                Etiqueta básico
                <input
                  className="rrhh-ext-form"
                  value={itemSel.etiqueta_basico}
                  disabled={cerrado}
                  onChange={(e) => patchItem(itemSel.id_usuario, { etiqueta_basico: e.target.value })}
                />
              </label>
              <label>
                Días
                <input
                  type="number"
                  value={itemSel.dias}
                  disabled={cerrado}
                  onChange={(e) => patchItem(itemSel.id_usuario, { dias: Number(e.target.value) || 30 })}
                />
              </label>
              <label>
                Años antigüedad (concepto)
                <input
                  type="number"
                  value={itemSel.anios_antiguedad}
                  disabled={cerrado}
                  onChange={(e) => patchItem(itemSel.id_usuario, { anios_antiguedad: Number(e.target.value) || 0 })}
                />
              </label>
              <label>
                Antigüedad reconocida
                <input
                  type="number"
                  value={itemSel.antiguedad_reconocida}
                  disabled={cerrado}
                  onChange={(e) =>
                    patchItem(itemSel.id_usuario, { antiguedad_reconocida: Number(e.target.value) || 0 })
                  }
                />
              </label>
              <label>
                Convenio CCT
                <input
                  list="rrhh-ccts"
                  value={itemSel.cct_codigo || ''}
                  disabled={cerrado}
                  onChange={(e) =>
                    patchItem(itemSel.id_usuario, {
                      cct_codigo: e.target.value || null,
                      cct: cctEnConvenio(e.target.value)
                    })
                  }
                />
                <datalist id="rrhh-ccts">
                  {CCTS_PLOT.map((c) => (
                    <option key={c.codigo} value={c.codigo}>
                      {c.label}
                    </option>
                  ))}
                </datalist>
              </label>
              <label>
                Banco
                <input
                  value={itemSel.banco || ''}
                  disabled={cerrado}
                  onChange={(e) => patchItem(itemSel.id_usuario, { banco: e.target.value || null })}
                />
              </label>
              <label>
                CBU
                <input
                  value={itemSel.cbu || ''}
                  disabled={cerrado}
                  onChange={(e) => patchItem(itemSel.id_usuario, { cbu: e.target.value || null })}
                />
              </label>
              <label>
                Modalidad ARCA
                <select
                  value={itemSel.modalidad}
                  disabled={cerrado}
                  onChange={(e) => patchItem(itemSel.id_usuario, { modalidad: e.target.value })}
                >
                  <option value="001">001 · Tiempo indeterminado</option>
                  <option value="008">008 · Tiempo parcial</option>
                </select>
              </label>
              <label>
                Código obra social
                <input
                  value={itemSel.codigo_os || ''}
                  disabled={cerrado}
                  onChange={(e) => patchItem(itemSel.id_usuario, { codigo_os: e.target.value || null })}
                />
              </label>
              <label>
                Forma de pago
                <select
                  value={itemSel.forma_pago}
                  disabled={cerrado}
                  onChange={(e) => patchItem(itemSel.id_usuario, { forma_pago: e.target.value })}
                >
                  <option value="1">Efectivo</option>
                  <option value="2">Cheque</option>
                  <option value="3">Acreditación en cuenta</option>
                </select>
              </label>
            </div>
          ) : null}

          {itemSel ? (
            <div className="rrhh-libro-extras">
              <div className="rrhh-libro-extras-head">
                <h4>Conceptos extra de {itemSel.apellido_nombre || 'empleado'}</h4>
                <button
                  type="button"
                  className="rrhh-ext-btn"
                  disabled={cerrado}
                  onClick={() =>
                    patchItem(itemSel.id_usuario, { extras: [...(itemSel.extras || []), extraVacio()] })
                  }
                >
                  Agregar concepto
                </button>
              </div>
              {(itemSel.extras || []).map((x) => (
                <div key={x.id} className="rrhh-libro-extra-row">
                  <input
                    placeholder="Concepto"
                    value={x.concepto}
                    disabled={cerrado}
                    onChange={(e) =>
                      patchItem(itemSel.id_usuario, {
                        extras: (itemSel.extras || []).map((r) =>
                          r.id === x.id ? { ...r, concepto: e.target.value } : r
                        )
                      })
                    }
                  />
                  <select
                    value={x.tipo}
                    disabled={cerrado}
                    onChange={(e) =>
                      patchItem(itemSel.id_usuario, {
                        extras: (itemSel.extras || []).map((r) =>
                          r.id === x.id
                            ? { ...r, tipo: e.target.value as typeof r.tipo }
                            : r
                        )
                      })
                    }
                  >
                    <option value="remunerativo">Remunerativo</option>
                    <option value="no_remunerativo">No remunerativo</option>
                    <option value="descuento">Descuento</option>
                    <option value="empleador">Costo empleador</option>
                  </select>
                  <input
                    placeholder="Unidad"
                    value={x.unidad}
                    disabled={cerrado}
                    onChange={(e) =>
                      patchItem(itemSel.id_usuario, {
                        extras: (itemSel.extras || []).map((r) =>
                          r.id === x.id ? { ...r, unidad: e.target.value } : r
                        )
                      })
                    }
                  />
                  <ImporteField
                    value={x.monto}
                    disabled={cerrado}
                    onCommit={(n) =>
                      patchItem(itemSel.id_usuario, {
                        extras: (itemSel.extras || []).map((r) => (r.id === x.id ? { ...r, monto: n } : r))
                      })
                    }
                  />
                  <input
                    placeholder="Cód. LSD"
                    value={x.codigo_lsd}
                    disabled={cerrado}
                    onChange={(e) =>
                      patchItem(itemSel.id_usuario, {
                        extras: (itemSel.extras || []).map((r) =>
                          r.id === x.id ? { ...r, codigo_lsd: e.target.value } : r
                        )
                      })
                    }
                  />
                  <button
                    type="button"
                    className="rrhh-ext-btn ghost"
                    disabled={cerrado}
                    onClick={() =>
                      patchItem(itemSel.id_usuario, {
                        extras: (itemSel.extras || []).filter((r) => r.id !== x.id)
                      })
                    }
                  >
                    Quitar
                  </button>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div className="rrhh-ext-card">
          <h3>Vista del recibo</h3>
          <div className="rrhh-libro-preview">
            {liq ? (
              <div ref={previewRef}>
                <ReciboSueldoLct liq={liq} />
              </div>
            ) : (
              <p>Elegí un empleado y cargá el básico.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default RecursosHumanosLibroSueldosPage
