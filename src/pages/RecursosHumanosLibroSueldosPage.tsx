import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import ReciboSueldoLct from '../components/ReciboSueldoLct'
import RrhhSacVacacionesPanel from '../components/RrhhSacVacacionesPanel'
import apiService from '../services/api'
import {
  rrhhDocItemAgregar,
  rrhhDocLoteActualizarEstado,
  rrhhDocLoteActualizarTitulo,
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
  adicionalAntiguedadCalculado,
  adicionalAntiguedadNecesitaPrecarga,
  aplicarLiquidacionAItem,
  conceptosParaArca,
  conceptosParaArcaCsv,
  legalDelLibro,
  aniosAntiguedadAlPeriodo,
  antiguedadMesesAlPeriodo,
  fechaCortaEs,
  fichaDesdeItem,
  formatAntiguedadReconocida,
  formatArs2,
  formatCuil,
  labelPeriodoMes,
  liquidarRecibo,
  mesesReconocidosEfectivos,
  montoExtraEfectivo,
  montosSueldoBaseDesdeLiqConfig,
  numerosLiquidacion,
  tituloReciboPeriodo,
  type RrhhLibroSueldos,
  type RrhhLibroSueldosItem,
  type RrhhSueldoFicha
} from '../utils/rrhhLibroSueldos'
import { avisosItemLsd, descargarTxtLsd } from '../utils/exportLibroSueldosLsd'
import { datosLibroDesdeLiquidacion } from '../utils/rrhhLibroDesdeLiquidacion'
import { completarItemDesdeLegajo, faltantesItem, fechaPagoLegal } from '../utils/rrhhLibroHidratar'
import { NOMBRE_LEGAL_CARGA, falAplica } from '../utils/rrhhCargasLegales'
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
  const [busqueda, setBusqueda] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  /** Empleados cuyos datos vienen de la Liquidación mensual del período. */
  const [sincro, setSincro] = useState<{ generado: string | null; ids: Set<number> } | null>(null)
  /** Hay datos en pantalla (editados o traídos de legajo / liquidación) que no están en la base. */
  const [sinGuardar, setSinGuardar] = useState(false)
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
      fichas: RrhhSueldoFicha[],
      liqMontos: Record<number, number>,
      pctAntiguedad: number
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
          const leg = legRes.data?.[r.id_usuario]
          const fechaIngreso = prev?.fecha_ingreso || leg?.fecha_ingreso || null
          const anios = aniosAntiguedadAlPeriodo(fechaIngreso, periodo)
          const meses = antiguedadMesesAlPeriodo(fechaIngreso, periodo)
          const categoria =
            prev?.categoria ||
            ficha?.categoria ||
            leg?.categoria ||
            leg?.puesto ||
            puestos.get(r.id_puesto || 0) ||
            r.sector ||
            ''
          const tipoServ =
            leg?.tipo_servicio || ficha?.etiqueta_basico || prev?.etiqueta_basico || ''
          const medio = /medio/i.test(tipoServ)
          const cctCodigo =
            prev?.cct_codigo ||
            ficha?.cct_codigo ||
            leg?.convenio_cct ||
            (/admin/i.test(categoria) ? '9999/99' : '0409/05')
          const basicoPrev = Number(prev?.sueldo_basico) || 0
          const basicoFicha = Number(ficha?.sueldo_basico) || 0
          const basicoLiq = liqMontos[r.id_usuario] || 0
          const basicoLeg =
            leg?.retribucion_pactada != null && Number.isFinite(Number(leg.retribucion_pactada))
              ? Number(leg.retribucion_pactada)
              : 0
          // Prioridad: mes anterior / ficha → sueldo base de liquidación mensual → retribución del legajo.
          const sueldoBasico =
            basicoPrev > 0 ? basicoPrev : basicoFicha > 0 ? basicoFicha : basicoLiq > 0 ? basicoLiq : basicoLeg
          const aniosItem = prev?.anios_antiguedad ?? anios
          const adicionalPrev = prev?.adicional_antiguedad ?? ficha?.adicional_antiguedad ?? 0
          const adicionalAntiguedad = adicionalAntiguedadNecesitaPrecarga(
            adicionalPrev,
            sueldoBasico,
            pctAntiguedad
          )
            ? adicionalAntiguedadCalculado(sueldoBasico, aniosItem, pctAntiguedad)
            : Number(adicionalPrev) || 0
          return {
            id: prev?.id,
            id_libro: libroId,
            id_usuario: r.id_usuario,
            incluido: prev?.incluido ?? true,
            n_legajo:
              prev?.n_legajo ||
              ficha?.n_legajo ||
              leg?.n_legajo ||
              idx + 1,
            apellido_nombre: prev?.apellido_nombre || nombre,
            cuil: prev?.cuil || ficha?.cuil || leg?.cuil || '',
            categoria,
            fecha_ingreso: fechaIngreso,
            antiguedad_reconocida: mesesReconocidosEfectivos({
              antiguedad_reconocida: prev?.antiguedad_reconocida ?? ficha?.antiguedad_reconocida ?? meses,
              anios_antiguedad: aniosItem,
              fecha_ingreso: fechaIngreso,
              periodo
            }),
            anios_antiguedad: aniosItem,
            dias: prev?.dias || 30,
            etiqueta_basico:
              prev?.etiqueta_basico ||
              ficha?.etiqueta_basico ||
              (medio ? 'Sueldo básico medio día' : 'Sueldo básico'),
            sueldo_basico: sueldoBasico,
            adicional_antiguedad: adicionalAntiguedad,
            scvo: prev?.scvo ?? ficha?.scvo ?? scvoDefault,
            banco: prev?.banco ?? ficha?.banco ?? leg?.banco ?? null,
            cbu: prev?.cbu ?? ficha?.cbu ?? leg?.cbu ?? null,
            // Art. 124 LCT: el sueldo se paga por acreditación en cuenta.
            forma_pago:
              prev?.forma_pago || ficha?.forma_pago || ((prev?.cbu ?? ficha?.cbu ?? leg?.cbu) ? '3' : '1'),
            conyuge: prev?.conyuge ?? ficha?.conyuge ?? false,
            hijos: prev?.hijos ?? ficha?.hijos ?? 0,
            cct: prev?.cct ?? ficha?.cct ?? cctEnConvenio(cctCodigo),
            cct_codigo: cctCodigo,
            cobertura_scvo: prev?.cobertura_scvo ?? ficha?.cobertura_scvo ?? true,
            situacion_revista: prev?.situacion_revista || ficha?.situacion_revista || '01',
            condicion: prev?.condicion || ficha?.condicion || '01',
            actividad: prev?.actividad ?? ficha?.actividad ?? null,
            modalidad:
              prev?.modalidad ||
              ficha?.modalidad ||
              leg?.modalidad_contrato ||
              (medio ? '008' : '001'),
            codigo_os: prev?.codigo_os ?? ficha?.codigo_os ?? leg?.codigo_os ?? null,
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
      const [libRes, fichasRes, liqRes, legRes] = await Promise.all([
        rrhhLibroSueldosObtener(periodo),
        rrhhSueldoFichasListar(),
        apiService.rrhhLiquidacionPeriodoObtener(periodo),
        apiService.obtenerLegajosBasico()
      ])
      if (!libRes.success) throw new Error(libRes.error || 'No se pudo leer el libro')
      const liqCfg = liqRes.success && liqRes.data ? liqRes.data.config_json : null
      const { montos: liqMontos, pctAntiguedad } = montosSueldoBaseDesdeLiqConfig(liqCfg)
      const sincro = datosLibroDesdeLiquidacion(liqCfg, periodo)
      const legBy = legRes.success && legRes.data ? legRes.data : {}
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
      // Libro abierto + liquidación del período: parámetros, cargas y datos legales vienen de ahí.
      const sincronizar = actual.estado !== 'cerrado' && sincro != null
      if (sincronizar && sincro) {
        actual = {
          ...actual,
          importe_detraer: sincro.legal.parametros.detraccion,
          alicuotas: { ...actual.alicuotas, legal: sincro.legal }
        }
      }
      setLibro(actual)
      setSincro(
        sincronizar && sincro
          ? { generado: sincro.generado, ids: new Set(Object.keys(sincro.snapshots).map(Number)) }
          : null
      )
      // Fecha de pago: si no hay, la límite legal (4.º día hábil del mes siguiente, art. 128 LCT).
      if (!actual.fecha_pago && actual.estado !== 'cerrado') {
        actual = { ...actual, fecha_pago: fechaPagoLegal(periodo) }
        setLibro(actual)
      }
      const aplicarSincro = (lista: ItemDraft[], esAlta = false): ItemDraft[] => {
        const cerradoLib = actual!.estado === 'cerrado'
        return lista.map((it) => {
          // Datos registrales y familia desde el legajo (no en libros cerrados).
          let out = cerradoLib ? it : completarItemDesdeLegajo(it, legBy[it.id_usuario])
          if (!sincronizar || !sincro) return out
          const snap = sincro.snapshots[String(it.id_usuario)]
          if (snap) out = aplicarLiquidacionAItem(out, snap, actual!.cct_default || '0409/05')
          // Libro nuevo: entra en nómina quien está en la liquidación del período.
          else if (esAlta && Object.keys(sincro.snapshots).length > 0) out = { ...out, incluido: false }
          return out
        })
      }
      const itemsRes = await rrhhLibroSueldosItemsListar(actual.id)
      if (!itemsRes.success) throw new Error(itemsRes.error || 'No se pudieron leer los ítems')
      if (itemsRes.data && itemsRes.data.length > 0) {
        const normalizados = itemsRes.data.map((it) => {
          const leg = legBy[it.id_usuario]
          const basicoLiq = liqMontos[it.id_usuario] || 0
          const basicoLeg =
            leg?.retribucion_pactada != null && Number.isFinite(Number(leg.retribucion_pactada))
              ? Number(leg.retribucion_pactada)
              : 0
          const sueldoBasico =
            Number(it.sueldo_basico) > 0
              ? Number(it.sueldo_basico)
              : basicoLiq > 0
                ? basicoLiq
                : basicoLeg
          const anios =
            it.anios_antiguedad ||
            aniosAntiguedadAlPeriodo(it.fecha_ingreso || leg?.fecha_ingreso || null, periodo)
          const adicional = adicionalAntiguedadNecesitaPrecarga(
            it.adicional_antiguedad,
            sueldoBasico,
            pctAntiguedad
          )
            ? adicionalAntiguedadCalculado(sueldoBasico, anios, pctAntiguedad)
            : Number(it.adicional_antiguedad) || 0
          return {
            ...it,
            cuil: it.cuil || leg?.cuil || '',
            categoria: it.categoria || leg?.categoria || leg?.puesto || it.categoria,
            fecha_ingreso: it.fecha_ingreso || leg?.fecha_ingreso || null,
            n_legajo: it.n_legajo || leg?.n_legajo || it.n_legajo,
            sueldo_basico: sueldoBasico,
            anios_antiguedad: anios,
            adicional_antiguedad: adicional,
            antiguedad_reconocida: mesesReconocidosEfectivos({
              antiguedad_reconocida: it.antiguedad_reconocida,
              anios_antiguedad: anios,
              fecha_ingreso: it.fecha_ingreso || leg?.fecha_ingreso || null,
              periodo
            })
          }
        })
        const finales = aplicarSincro(normalizados)
        setItems(finales)
        setSel(finales[0]?.id_usuario ?? null)
        // ¿Lo traído de legajo / liquidación difiere de lo guardado?
        const firma = (lista: ItemDraft[]) =>
          JSON.stringify(
            lista.map((it) => [
              it.id_usuario,
              it.incluido,
              it.cuil,
              it.cbu,
              it.banco,
              it.codigo_os,
              it.categoria,
              it.conyuge,
              it.hijos,
              it.forma_pago,
              it.sueldo_basico,
              it.adicional_antiguedad,
              it.dias,
              it.cct_codigo,
              it.modalidad,
              (it.extras || []).map((x) => [x.id, x.monto, x.cantidad ?? null])
            ])
          )
        const libroCambio =
          JSON.stringify(libRes.data?.alicuotas ?? {}) !== JSON.stringify(actual.alicuotas) ||
          (libRes.data?.fecha_pago ?? null) !== actual.fecha_pago
        setSinGuardar(libroCambio || firma(finales) !== firma(itemsRes.data))
      } else {
        const prevLib = await rrhhLibroSueldosObtener(periodoAnterior(periodo))
        let prevItems: RrhhLibroSueldosItem[] = []
        if (prevLib.success && prevLib.data) {
          const prev = await rrhhLibroSueldosItemsListar(prevLib.data.id)
          if (prev.success && prev.data) prevItems = prev.data
        }
        const altas = await armarAltas(
          actual.id,
          actual.scvo_default,
          prevItems,
          fichasRes.data || [],
          liqMontos,
          pctAntiguedad
        )
        const finales = aplicarSincro(altas, true)
        setItems(finales)
        setSel(finales[0]?.id_usuario ?? null)
        // Nómina nueva armada en pantalla: todavía no está en la base.
        setSinGuardar(finales.length > 0)
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

  const patchItem = (
    idUsuario: number,
    patch: Partial<ItemDraft> | ((it: ItemDraft) => Partial<ItemDraft>)
  ) => {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id_usuario !== idUsuario) return it
        const p = typeof patch === 'function' ? patch(it) : patch
        return { ...it, ...p }
      })
    )
    setSinGuardar(true)
  }

  const patchLibro = (patch: Partial<RrhhLibroSueldos>) => {
    setLibro((prev) => (prev ? { ...prev, ...patch } : prev))
    setSinGuardar(true)
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
      setSinGuardar(false)
      setMsg('Libro guardado. Las fichas quedan para el mes siguiente.')
      return true
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar')
      return false
    } finally {
      setBusy(false)
    }
  }

  const itemsFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return items
    return items.filter((it) => {
      const leg = String(it.n_legajo)
      const nombre = (it.apellido_nombre || '').toLowerCase()
      const cuil = (it.cuil || '').toLowerCase().replace(/[-\s]/g, '')
      const cat = (it.categoria || '').toLowerCase()
      const qCuil = q.replace(/[-\s]/g, '')
      return nombre.includes(q) || cuil.includes(qCuil) || leg.includes(q) || cat.includes(q)
    })
  }, [items, busqueda])

  useEffect(() => {
    if (itemsFiltrados.length === 0) return
    if (!itemsFiltrados.some((it) => it.id_usuario === sel)) {
      setSel(itemsFiltrados[0].id_usuario)
    }
  }, [itemsFiltrados, sel])

  const itemSel = items.find((i) => i.id_usuario === sel) || itemsFiltrados[0] || items[0] || null
  const legalLibro = useMemo(() => (libro ? legalDelLibro(libro) : null), [libro])
  const conceptosArca = useMemo(() => conceptosParaArca(items), [items])
  /** Básico, antigüedad, días, convenio y jornada vienen de la liquidación: no se editan acá. */
  const deLiq = (idUsuario: number) => !!sincro?.ids.has(idUsuario)
  const selDeLiq = itemSel ? deLiq(itemSel.id_usuario) : false
  const avisosSel = itemSel ? avisosItemLsd({ ...itemSel, id: itemSel.id || 0, id_libro: itemSel.id_libro || 0 }) : []
  const itemsDeferred = useDeferredValue(items)
  const libroDeferred = useDeferredValue(libro)
  const selDeferred = useDeferredValue(sel)

  const liq = useMemo(() => {
    // En envío masivo usamos estado vivo (no deferred) para que el PDF coincida con el empleado.
    const libroSrc = busy ? libro : libroDeferred
    const itemsSrc = busy ? items : itemsDeferred
    const selSrc = busy ? sel : selDeferred
    if (!libroSrc) return null
    const it = itemsSrc.find((i) => i.id_usuario === selSrc) || itemsSrc[0]
    if (!it) return null
    return liquidarRecibo({
      item: { ...it, id: it.id || 0, id_libro: it.id_libro || libroSrc.id },
      libro: libroSrc
    })
  }, [busy, libro, items, sel, libroDeferred, itemsDeferred, selDeferred])

  /** Por empleado: bruto, neto y datos que faltan (una sola pasada para tabla y resumen). */
  const resumenPorEmpleado = useMemo(() => {
    const m = new Map<
      number,
      { bruto: number; neto: number; aportes: number; contribuciones: number; costo: number; faltan: string[] }
    >()
    if (!libro) return m
    for (const it of items) {
      const n = numerosLiquidacion(it as RrhhLibroSueldosItem, libro)
      m.set(it.id_usuario, {
        bruto: n.bruto,
        neto: n.neto,
        aportes: n.descuentos,
        contribuciones: n.contribuciones,
        costo: n.costoEmpleador,
        faltan: faltantesItem(it)
      })
    }
    return m
  }, [items, libro])

  const idsFiltrados = useMemo(
    () => new Set(itemsFiltrados.map((it) => it.id_usuario)),
    [itemsFiltrados]
  )
  const todosIncluidos =
    itemsFiltrados.length > 0 && itemsFiltrados.every((it) => it.incluido)
  const algunoIncluido = itemsFiltrados.some((it) => it.incluido)

  const marcarTodos = (incluido: boolean) => {
    setItems((prev) =>
      prev.map((it) => (idsFiltrados.has(it.id_usuario) ? { ...it, incluido } : it))
    )
    setSinGuardar(true)
  }

  const totales = useMemo(() => {
    const t = { n: 0, bruto: 0, aportes: 0, contribuciones: 0, neto: 0, costo: 0, conFaltantes: 0 }
    for (const it of items) {
      if (!it.incluido) continue
      const r = resumenPorEmpleado.get(it.id_usuario)
      if (!r) continue
      t.n += 1
      t.bruto += r.bruto
      t.aportes += r.aportes
      t.contribuciones += r.contribuciones
      t.neto += r.neto
      t.costo += r.costo
      if (r.faltan.length) t.conFaltantes += 1
    }
    return t
  }, [items, resumenPorEmpleado])

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
    setError(null)
    setMsg(null)
    const incluidos = items.filter((i) => i.incluido)
    if (!incluidos.length) {
      setError('No hay empleados marcados en la nómina. Marcá al menos uno (checkbox) y volvé a enviar.')
      return
    }
    const tituloMes = tituloReciboPeriodo(periodo)
    setBusy(true)
    try {
      const saved = await guardar()
      if (!saved) return
      setBusy(true)
      const lotes = await rrhhDocLotesListar()
      let lote =
        (libro.id_lote_recibos
          ? (lotes.data || []).find((l) => l.id === libro.id_lote_recibos)
          : null) ||
        (lotes.data || []).find((l) => l.periodo === periodo && l.tipo === 'recibo_sueldo') ||
        null
      if (!lote) {
        const created = await rrhhDocLoteCrear({
          periodo,
          titulo: tituloMes,
          created_by: usuario.id
        })
        if (!created.success || !created.data) throw new Error(created.error || 'No se pudo crear el lote')
        lote = created.data
      } else if (lote.titulo !== tituloMes) {
        const upTitulo = await rrhhDocLoteActualizarTitulo(lote.id, tituloMes)
        if (upTitulo.success) lote = { ...lote, titulo: tituloMes }
      }
      let ok = 0
      const fallos: string[] = []
      for (const it of incluidos) {
        try {
          flushSync(() => setSel(it.id_usuario))
          await esperarFrame()
          await new Promise((r) => setTimeout(r, 80))
          const el = previewRef.current
          if (!el) throw new Error('No se pudo renderizar el recibo')
          const blob = await elementoAPdfBlob(el)
          const fileName = `Recibo_${periodo}_leg${it.n_legajo}.pdf`
          const file = new File([blob], fileName, { type: 'application/pdf' })
          const up = await rrhhDocSubirArchivo(file, it.id_usuario)
          if (!up.success || !up.data) throw new Error(up.error || 'Falló el upload')
          const add = await rrhhDocItemAgregar({
            id_lote: lote.id,
            id_usuario: it.id_usuario,
            archivo_url: up.data.url,
            archivo_nombre: tituloMes
          })
          if (!add.success) throw new Error(add.error || 'No se pudo anexar')
          await apiService.createNotification({
            user_id: it.id_usuario,
            title: tituloMes,
            description: 'Tenés un recibo de sueldo para ver y firmar en Mis recibos (/mis-recibos).',
            type: 'info',
            origen: 'sistema',
            related_id: 'mis-recibos'
          })
          ok += 1
        } catch (e) {
          fallos.push(
            `${it.apellido_nombre || it.id_usuario}: ${e instanceof Error ? e.message : 'error'}`
          )
        }
      }
      if (ok === 0) {
        throw new Error(
          fallos.length
            ? `No se publicó ningún recibo. ${fallos.slice(0, 3).join(' · ')}`
            : 'No se publicó ningún recibo.'
        )
      }
      await rrhhDocLoteActualizarEstado(lote.id, 'enviado')
      await rrhhLibroSueldosUpsert({ periodo, patch: { id_lote_recibos: lote.id } })
      setLibro((prev) => (prev ? { ...prev, id_lote_recibos: lote!.id } : prev))
      setMsg(
        `${ok} recibo${ok === 1 ? '' : 's'} en Mis recibos (${tituloMes}).` +
          (fallos.length ? ` Fallaron ${fallos.length}.` : '')
      )
      if (fallos.length) setError(fallos.slice(0, 5).join(' · '))
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

  const cambiarEstado = async (estado: 'borrador' | 'cerrado') => {
    if (!libro) return
    if (
      estado === 'cerrado' &&
      !window.confirm(
        'Al cerrar el libro queda congelado: no se edita ni se vuelve a sincronizar con la liquidación. ¿Cerrar?'
      )
    ) {
      return
    }
    if (estado === 'cerrado') {
      const ok = await guardar()
      if (!ok) return
    }
    setBusy(true)
    try {
      const res = await rrhhLibroSueldosUpsert({ periodo, patch: { estado } })
      if (!res.success || !res.data) throw new Error(res.error || 'No se pudo cambiar el estado')
      setLibro(res.data)
      setMsg(estado === 'cerrado' ? 'Libro cerrado.' : 'Libro reabierto: vuelve a tomar los datos de la liquidación.')
      if (estado === 'borrador') void cargar()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cambiar el estado')
    } finally {
      setBusy(false)
    }
  }

  const descargarTxt = () => {
    if (!libro) return
    const r = descargarTxtLsd(
      libro,
      items.map((i) => ({ ...i, id: i.id || 0, id_libro: libro.id }))
    )
    if (r.errores.length) setError(r.errores.join(' · '))
    else setMsg(`TXT ARCA: ${r.nTrab} trabajadores (ANSI, sin comprimir).`)
  }

  const resumenSel = itemSel ? resumenPorEmpleado.get(itemSel.id_usuario) : undefined

  return (
    <div className="rrhh-ext-page rrhh-libro-page">
      <header className="libro-head">
        <div className="libro-head-title">
          <h1>Libro de sueldos</h1>
          <div className="libro-chips">
            <span className={`libro-chip ${cerrado ? 'is-lock' : 'is-draft'}`}>{cerrado ? 'Cerrado' : 'Borrador'}</span>
            {sincro ? (
              <span className="libro-chip is-ok" title="Básico, antigüedad, horas extra, inasistencias y cargas vienen de la Liquidación mensual">
                Datos de Liquidación
                {sincro.generado ? ` · ${new Date(sincro.generado).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}` : ''}
              </span>
            ) : (
              <span className="libro-chip is-warn" title="Abrí la Liquidación mensual del período (mes completo) para traer los datos">
                {cerrado ? 'Datos congelados' : 'Sin liquidación del período'}
              </span>
            )}
            {sinGuardar && !cerrado ? <span className="libro-chip is-warn">Cambios sin guardar</span> : null}
          </div>
        </div>
        <div className="libro-head-actions">
          <label className="libro-periodo">
            <span>Período</span>
            <input type="month" value={periodo} onChange={(e) => setPeriodo(e.target.value)} disabled={busy} />
          </label>
          <button type="button" className="rrhh-ext-btn primary" onClick={() => void guardar()} disabled={busy || cerrado}>
            {busy ? 'Procesando…' : 'Guardar'}
          </button>
          <button type="button" className="rrhh-ext-btn" onClick={() => navigate('/rrhh/liquidacion')}>
            Liquidación
          </button>
          <button type="button" className="rrhh-ext-btn" onClick={() => navigate('/rrhh/simulador')}>
            Simulador
          </button>
          <button type="button" className="rrhh-ext-btn ghost" onClick={() => navigate('/rrhh')}>
            Volver
          </button>
        </div>
      </header>

      {error ? <p className="rrhh-ext-error">{error}</p> : null}
      {msg ? <p className="rrhh-libro-msg">{msg}</p> : null}

      <section className="libro-kpis" aria-label="Totales del período">
        <article className="libro-kpi">
          <span className="libro-kpi-label">En nómina</span>
          <strong className="libro-kpi-value">
            {totales.n}
            <small> / {items.length}</small>
          </strong>
          <span className="libro-kpi-hint">{labelPeriodoMes(periodo)}</span>
        </article>
        <article className="libro-kpi">
          <span className="libro-kpi-label">Remuneración bruta</span>
          <strong className="libro-kpi-value">{formatArs2(totales.bruto)}</strong>
          <span className="libro-kpi-hint">Remunerativo declarado</span>
        </article>
        <article className="libro-kpi">
          <span className="libro-kpi-label">Aportes y descuentos</span>
          <strong className="libro-kpi-value is-neg">−{formatArs2(totales.aportes)}</strong>
          <span className="libro-kpi-hint">Jubilación, INSSJP, OS, sindicato</span>
        </article>
        <article className="libro-kpi is-main">
          <span className="libro-kpi-label">Neto a pagar</span>
          <strong className="libro-kpi-value">{formatArs2(totales.neto)}</strong>
          <span className="libro-kpi-hint">
            {libro?.fecha_pago ? `Pago hasta ${fechaCortaEs(libro.fecha_pago)}` : 'Sin fecha de pago'}
          </span>
        </article>
        <article className="libro-kpi">
          <span className="libro-kpi-label">Contribuciones</span>
          <strong className="libro-kpi-value">{formatArs2(totales.contribuciones)}</strong>
          <span className="libro-kpi-hint">SIPA, OS, AAFF, FNE, ART, SCVO</span>
        </article>
        <article className="libro-kpi">
          <span className="libro-kpi-label">Costo laboral</span>
          <strong className="libro-kpi-value">{formatArs2(totales.costo)}</strong>
          <span className="libro-kpi-hint">Bruto + no remunerativo + contribuciones</span>
        </article>
      </section>

      {libro ? (
        <RrhhSacVacacionesPanel
          key={periodo}
          periodo={periodo}
          libro={libro}
          items={items}
          cerrado={cerrado}
          onAplicar={(cambios) => {
            setItems((prev) => prev.map((it) => (cambios.has(it.id_usuario) ? { ...it, extras: cambios.get(it.id_usuario)! } : it)))
            setSinGuardar(true)
            setMsg('Aguinaldo y plus vacacional aplicados como conceptos del recibo. Revisalos y guardá el libro.')
          }}
        />
      ) : null}

      {totales.conFaltantes > 0 ? (
        <p className="libro-alerta">
          {totales.conFaltantes} empleado{totales.conFaltantes === 1 ? '' : 's'} en nómina con datos incompletos (marcados en
          la tabla). Lo ideal es completarlos en su legajo: el libro los toma de ahí al abrir el período.
        </p>
      ) : null}

      <div className="libro-toolbar">
        <label className="rrhh-libro-search">
          <span className="sr-only">Buscar empleado</span>
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre, CUIL, legajo o categoría…"
            autoComplete="off"
          />
        </label>
        <div className="libro-toolbar-group">
          <button
            type="button"
            className="rrhh-ext-btn"
            onClick={() =>
              libro && exportarLibroSueldosXlsx(libro, items.map((i) => ({ ...i, id: i.id || 0, id_libro: libro.id })))
            }
            disabled={!libro || busy}
          >
            Excel
          </button>
          <button type="button" className="rrhh-ext-btn" onClick={() => void exportarPdfUno()} disabled={!liq || busy}>
            PDF recibo
          </button>
          <button type="button" className="rrhh-ext-btn" onClick={descargarTxt} disabled={!libro || busy}>
            TXT ARCA
          </button>
          <button
            type="button"
            className="rrhh-ext-btn primary"
            onClick={() => void enviarEmpleados()}
            disabled={busy || cerrado}
            title="Publica el PDF de cada empleado marcado en Mis recibos (/mis-recibos) y le manda una notificación. No envía mail."
          >
            Enviar recibos
          </button>
          {cerrado ? (
            <button type="button" className="rrhh-ext-btn ghost" onClick={() => void cambiarEstado('borrador')} disabled={busy}>
              Reabrir
            </button>
          ) : (
            <button type="button" className="rrhh-ext-btn ghost" onClick={() => void cambiarEstado('cerrado')} disabled={busy || !libro}>
              Cerrar libro
            </button>
          )}
        </div>
      </div>

      <div className="libro-main">
        <section className="rrhh-ext-card libro-nomina">
          <div className="libro-card-head">
            <h3>Nómina</h3>
            <span className="libro-muted">
              {busqueda.trim() ? `${itemsFiltrados.length} de ${items.length}` : `${items.length} empleados`}
            </span>
          </div>
          <div className="rrhh-libro-table-wrap">
            <table className="rrhh-ext-table libro-tabla">
              <thead>
                <tr>
                  <th>
                    <input
                      type="checkbox"
                      title={todosIncluidos ? 'Sacar todos de la nómina' : 'Incluir todos'}
                      checked={todosIncluidos}
                      disabled={cerrado || itemsFiltrados.length === 0}
                      ref={(el) => {
                        if (el) el.indeterminate = algunoIncluido && !todosIncluidos
                      }}
                      onChange={(e) => marcarTodos(e.target.checked)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </th>
                  <th>Leg.</th>
                  <th>Empleado</th>
                  <th className="num">Bruto</th>
                  <th className="num">Neto</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {itemsFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="libro-vacio">
                      {items.length === 0 ? 'Sin empleados en este período.' : 'Ningún empleado coincide con la búsqueda.'}
                    </td>
                  </tr>
                ) : null}
                {itemsFiltrados.map((it) => {
                  const r = resumenPorEmpleado.get(it.id_usuario)
                  return (
                    <tr
                      key={it.id_usuario}
                      className={`${sel === it.id_usuario ? 'is-sel' : ''}${it.incluido ? '' : ' is-off'}`}
                      onClick={() => setSel(it.id_usuario)}
                    >
                      <td onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={it.incluido}
                          disabled={cerrado}
                          title={it.incluido ? 'En nómina' : 'Fuera de nómina'}
                          onChange={(e) => patchItem(it.id_usuario, { incluido: e.target.checked })}
                        />
                      </td>
                      <td className="libro-leg">{it.n_legajo || '—'}</td>
                      <td>
                        <div className="libro-emp-nombre">{it.apellido_nombre || '—'}</div>
                        <div className="libro-emp-sub">
                          {it.categoria || 'Sin categoría'}
                          {it.cuil ? ` · ${formatCuil(it.cuil)}` : ''}
                        </div>
                      </td>
                      <td className="num">{formatArs2(r?.bruto ?? 0)}</td>
                      <td className="num libro-neto">{formatArs2(r?.neto ?? 0)}</td>
                      <td>
                        <div className="libro-estado">
                          {deLiq(it.id_usuario) ? (
                            <span className="libro-tag is-ok" title="Datos de la Liquidación mensual">
                              Liq.
                            </span>
                          ) : null}
                          {it.cct_codigo && !cctEnConvenio(it.cct_codigo) ? (
                            <span className="libro-tag" title="Fuera de convenio">
                              F/C
                            </span>
                          ) : null}
                          {String(it.modalidad) === '008' ? (
                            <span className="libro-tag" title="Jornada parcial">
                              Parcial
                            </span>
                          ) : null}
                          {r?.faltan.length ? (
                            <span className="libro-tag is-warn" title={`Falta: ${r.faltan.join(', ')}`}>
                              Falta {r.faltan.length}
                            </span>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rrhh-ext-card libro-detalle">
          {itemSel ? (
            <>
              <div className="libro-card-head">
                <div>
                  <h3>{itemSel.apellido_nombre || 'Empleado'}</h3>
                  <span className="libro-muted">
                    Legajo {itemSel.n_legajo || '—'}
                    {itemSel.fecha_ingreso ? ` · ingreso ${fechaCortaEs(itemSel.fecha_ingreso)}` : ''}
                    {itemSel.anios_antiguedad ? ` · ${itemSel.anios_antiguedad} año${itemSel.anios_antiguedad === 1 ? '' : 's'}` : ''}
                  </span>
                </div>
                {resumenSel ? (
                  <div className="libro-detalle-neto">
                    <span>Neto</span>
                    <strong>{formatArs2(resumenSel.neto)}</strong>
                  </div>
                ) : null}
              </div>

              {selDeLiq ? (
                <p className="libro-nota-liq">
                  Básico, antigüedad, días, convenio, jornada, horas extra e inasistencias vienen de la Liquidación
                  mensual: se corrigen allá.
                </p>
              ) : null}
              {resumenSel?.faltan.length ? (
                <p className="libro-alerta">Falta cargar: {resumenSel.faltan.join(', ')}.</p>
              ) : null}
              {avisosSel.length ? <p className="libro-alerta">{avisosSel.join(' · ')}</p> : null}

              <fieldset className="libro-grupo">
                <legend>Haberes</legend>
                <label>
                  Etiqueta del básico
                  <input
                    value={itemSel.etiqueta_basico}
                    disabled={cerrado}
                    onChange={(e) => patchItem(itemSel.id_usuario, { etiqueta_basico: e.target.value })}
                  />
                </label>
                <label>
                  Sueldo básico
                  <ImporteField
                    value={itemSel.sueldo_basico}
                    disabled={cerrado || selDeLiq}
                    onCommit={(n) =>
                      patchItem(itemSel.id_usuario, {
                        sueldo_basico: n,
                        adicional_antiguedad: adicionalAntiguedadNecesitaPrecarga(itemSel.adicional_antiguedad, n, 1)
                          ? adicionalAntiguedadCalculado(n, itemSel.anios_antiguedad, 1)
                          : itemSel.adicional_antiguedad
                      })
                    }
                  />
                </label>
                <label>
                  Adicional antigüedad
                  <ImporteField
                    value={itemSel.adicional_antiguedad}
                    disabled={cerrado || selDeLiq}
                    onCommit={(n) => patchItem(itemSel.id_usuario, { adicional_antiguedad: n })}
                  />
                </label>
                <label>
                  Días pagos
                  <input
                    type="number"
                    value={itemSel.dias}
                    disabled={cerrado || selDeLiq}
                    onChange={(e) => patchItem(itemSel.id_usuario, { dias: Number(e.target.value) || 30 })}
                  />
                </label>
                <label>
                  Años de antigüedad
                  <input
                    type="number"
                    value={itemSel.anios_antiguedad}
                    disabled={cerrado || selDeLiq}
                    onChange={(e) => patchItem(itemSel.id_usuario, { anios_antiguedad: Number(e.target.value) || 0 })}
                  />
                </label>
                <label>
                  Antigüedad reconocida (meses)
                  <input
                    type="number"
                    min={0}
                    value={itemSel.antiguedad_reconocida}
                    disabled={cerrado}
                    onChange={(e) =>
                      patchItem(itemSel.id_usuario, { antiguedad_reconocida: Number(e.target.value) || 0 })
                    }
                  />
                  <small>En recibo: {formatAntiguedadReconocida(itemSel.antiguedad_reconocida) || '—'}</small>
                </label>
                <label>
                  Seguro de vida (SCVO)
                  <ImporteField
                    value={itemSel.scvo}
                    disabled={cerrado}
                    onCommit={(n) => patchItem(itemSel.id_usuario, { scvo: n })}
                  />
                </label>
              </fieldset>

              <fieldset className="libro-grupo">
                <legend>Datos registrales</legend>
                <label>
                  N.º legajo
                  <input
                    type="number"
                    value={itemSel.n_legajo}
                    disabled={cerrado}
                    onChange={(e) => patchItem(itemSel.id_usuario, { n_legajo: Number(e.target.value) || 0 })}
                  />
                </label>
                <label>
                  CUIL
                  <input
                    value={itemSel.cuil}
                    disabled={cerrado}
                    onChange={(e) => patchItem(itemSel.id_usuario, { cuil: e.target.value })}
                  />
                </label>
                <label>
                  Categoría
                  <input
                    value={itemSel.categoria || ''}
                    disabled={cerrado}
                    onChange={(e) => patchItem(itemSel.id_usuario, { categoria: e.target.value })}
                  />
                </label>
                <label>
                  Fecha de ingreso
                  <input
                    type="date"
                    value={itemSel.fecha_ingreso || ''}
                    disabled={cerrado}
                    onChange={(e) => {
                      const fi = e.target.value || null
                      const anios = aniosAntiguedadAlPeriodo(fi, periodo)
                      patchItem(itemSel.id_usuario, {
                        fecha_ingreso: fi,
                        antiguedad_reconocida: antiguedadMesesAlPeriodo(fi, periodo),
                        ...(selDeLiq
                          ? {}
                          : {
                              anios_antiguedad: anios,
                              adicional_antiguedad: adicionalAntiguedadNecesitaPrecarga(
                                itemSel.adicional_antiguedad,
                                itemSel.sueldo_basico,
                                1
                              )
                                ? adicionalAntiguedadCalculado(itemSel.sueldo_basico, anios, 1)
                                : itemSel.adicional_antiguedad
                            })
                      })
                    }}
                  />
                </label>
                <label>
                  Convenio (CCT)
                  <input
                    list="rrhh-ccts"
                    value={itemSel.cct_codigo || ''}
                    disabled={cerrado || selDeLiq}
                    title={selDeLiq ? 'Se marca en Liquidación (fuera de convenio)' : undefined}
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
                  Modalidad ARCA
                  <select
                    value={itemSel.modalidad}
                    disabled={cerrado || selDeLiq}
                    title={selDeLiq ? 'Se marca en Liquidación (jornada parcial)' : undefined}
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
                    placeholder="6 dígitos"
                    onChange={(e) => patchItem(itemSel.id_usuario, { codigo_os: e.target.value || null })}
                  />
                </label>
                <label>
                  Cónyuge / hijos (F.931)
                  <span className="libro-inline">
                    <select
                      value={itemSel.conyuge ? '1' : '0'}
                      disabled={cerrado}
                      onChange={(e) => patchItem(itemSel.id_usuario, { conyuge: e.target.value === '1' })}
                    >
                      <option value="0">Sin cónyuge</option>
                      <option value="1">Con cónyuge</option>
                    </select>
                    <input
                      type="number"
                      min={0}
                      value={itemSel.hijos}
                      disabled={cerrado}
                      title="Hijos"
                      onChange={(e) =>
                        patchItem(itemSel.id_usuario, { hijos: Math.max(0, Number(e.target.value) || 0) })
                      }
                    />
                  </span>
                </label>
              </fieldset>

              <fieldset className="libro-grupo">
                <legend>Pago</legend>
                <label>
                  Forma de pago
                  <select
                    value={itemSel.forma_pago}
                    disabled={cerrado}
                    onChange={(e) => patchItem(itemSel.id_usuario, { forma_pago: e.target.value })}
                  >
                    <option value="3">Acreditación en cuenta</option>
                    <option value="1">Efectivo</option>
                    <option value="2">Cheque</option>
                  </select>
                </label>
                <label>
                  Banco
                  <input
                    value={itemSel.banco || ''}
                    disabled={cerrado}
                    onChange={(e) => patchItem(itemSel.id_usuario, { banco: e.target.value || null })}
                  />
                </label>
                <label className="libro-span2">
                  CBU
                  <input
                    value={itemSel.cbu || ''}
                    disabled={cerrado}
                    inputMode="numeric"
                    placeholder="22 dígitos"
                    onChange={(e) => patchItem(itemSel.id_usuario, { cbu: e.target.value || null })}
                  />
                </label>
              </fieldset>

              <div className="rrhh-libro-extras">
                <div className="rrhh-libro-extras-head">
                  <h4>Conceptos del recibo</h4>
                  <button
                    type="button"
                    className="rrhh-ext-btn"
                    disabled={cerrado}
                    onClick={() =>
                      patchItem(itemSel.id_usuario, (it) => ({
                        extras: [...(it.extras || []), extraVacio()]
                      }))
                    }
                  >
                    Agregar concepto
                  </button>
                </div>
                {(itemSel.extras || []).length === 0 ? (
                  <p className="libro-muted">Sin conceptos extra (premios, retenciones, adelantos…).</p>
                ) : null}
                {(itemSel.extras || []).map((x) => {
                  const bloqueado = cerrado || x.origen === 'liq'
                  const setX = (p: Partial<typeof x>) =>
                    patchItem(itemSel.id_usuario, (it) => ({
                      extras: (it.extras || []).map((r) => (r.id === x.id ? { ...r, ...p } : r))
                    }))
                  return (
                    <div key={x.id} className={`rrhh-libro-extra-row${x.origen === 'liq' ? ' is-liq' : ''}`}>
                      <input
                        placeholder="Concepto"
                        value={x.concepto}
                        disabled={bloqueado}
                        onChange={(e) => setX({ concepto: e.target.value })}
                      />
                      <select
                        value={x.tipo}
                        disabled={bloqueado}
                        onChange={(e) => setX({ tipo: e.target.value as typeof x.tipo })}
                      >
                        <option value="remunerativo">Remunerativo</option>
                        <option value="no_remunerativo">No remunerativo</option>
                        <option value="descuento">Descuento</option>
                        <option value="empleador">Costo empleador</option>
                      </select>
                      <input
                        placeholder="Unidad o %"
                        title='Monto fijo, o dejá monto en 0 y poné p. ej. "22%" para calcular sobre el bruto'
                        value={x.origen === 'liq' && x.cantidad != null ? `${x.cantidad} ${x.unidad}` : x.unidad}
                        disabled={bloqueado}
                        onChange={(e) => setX({ unidad: e.target.value })}
                      />
                      <div className="rrhh-libro-extra-monto">
                        <ImporteField value={x.monto} disabled={bloqueado} onCommit={(n) => setX({ monto: n })} />
                        {libro && x.monto === 0 && x.unidad.includes('%') ? (
                          <span
                            className="rrhh-libro-extra-calc"
                            title={x.tipo === 'remunerativo' ? 'Calculado sobre básico + antigüedad' : 'Calculado sobre el bruto'}
                          >
                            ≈{' '}
                            {formatArs2(
                              (() => {
                                const nums = numerosLiquidacion(
                                  { ...itemSel, id: itemSel.id || 0, id_libro: itemSel.id_libro || libro.id },
                                  libro
                                )
                                const base = x.tipo === 'remunerativo' ? nums.basico + nums.antig : nums.bruto
                                return montoExtraEfectivo(x, base).monto
                              })()
                            )}
                          </span>
                        ) : null}
                      </div>
                      <input
                        placeholder="Cód. ARCA"
                        value={x.codigo_lsd}
                        disabled={bloqueado}
                        onChange={(e) => setX({ codigo_lsd: e.target.value })}
                      />
                      {x.origen === 'liq' ? (
                        <span className="libro-tag is-ok" title="Viene de la Liquidación mensual">
                          Liq.
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="rrhh-ext-btn ghost"
                          disabled={cerrado}
                          onClick={() =>
                            patchItem(itemSel.id_usuario, (it) => ({
                              extras: (it.extras || []).filter((r) => r.id !== x.id)
                            }))
                          }
                        >
                          Quitar
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </>
          ) : (
            <p className="libro-muted">Elegí un empleado de la nómina.</p>
          )}
        </section>
      </div>

      <section className="rrhh-ext-card libro-recibo">
        <div className="libro-card-head">
          <h3>Recibo {itemSel ? `· ${itemSel.apellido_nombre}` : ''}</h3>
          <span className="libro-muted">Así lo recibe el empleado en Mis recibos (Decreto 407/2026)</span>
        </div>
        <div className="rrhh-libro-preview">
          {liq ? (
            <div ref={previewRef}>
              <ReciboSueldoLct liq={liq} />
            </div>
          ) : (
            <p>Elegí un empleado y cargá el básico.</p>
          )}
        </div>
      </section>

      <details className="rrhh-ext-card libro-plegable">
        <summary>
          <strong>Empleador y datos para ARCA</strong>
          <span className="libro-muted">
            {libro?.empresa_nombre} · CUIT {formatCuil(libro?.empresa_cuit)} · pago {fechaCortaEs(libro?.fecha_pago) || '—'}
          </span>
        </summary>
        <div className="rrhh-libro-toolbar">
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
            Banco (último depósito)
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
            <small>Límite legal: {fechaCortaEs(fechaPagoLegal(periodo))} (art. 128 LCT)</small>
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
            N.º liquidación ARCA
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
              disabled={cerrado || legalLibro?.origen === 'liquidacion'}
              onCommit={(n) => patchLibro({ importe_detraer: n })}
            />
          </label>
          <label>
            Código ART
            <input
              value={libro?.art_codigo || ''}
              onChange={(e) => patchLibro({ art_codigo: e.target.value })}
              disabled={cerrado}
            />
          </label>
          <label>
            Compañía SCVO
            <input
              value={libro?.scvo_cia || ''}
              onChange={(e) => patchLibro({ scvo_cia: e.target.value })}
              disabled={cerrado}
            />
          </label>
        </div>
      </details>

      {legalLibro?.origen === 'liquidacion' ? (
        <details className="rrhh-ext-card libro-plegable">
          <summary>
            <strong>Cargas sociales y parámetros legales</strong>
            <span className="libro-muted">de la Liquidación · se editan allá</span>
          </summary>
          <div className="libro-cargas">
            {legalLibro.cargas.map((c) => (
              <div key={c.id} className="libro-carga">
                <span>
                  {c.lado === 'aporte' ? 'Aporte' : 'Contribución'} · {NOMBRE_LEGAL_CARGA[c.id] || c.nombre}
                </span>
                <strong>{c.porcentaje.toLocaleString('es-AR')} %</strong>
              </div>
            ))}
            <div className="libro-carga">
              <span>Tope de aportes</span>
              <strong>{formatArs2(legalLibro.parametros.topeAportes)}</strong>
            </div>
            <div className="libro-carga">
              <span>Fondo de Asistencia Laboral</span>
              <strong>
                {falAplica(periodo, legalLibro.parametros)
                  ? `${legalLibro.parametros.falPct.toLocaleString('es-AR')} %`
                  : `desde ${legalLibro.parametros.falDesde}`}
              </strong>
            </div>
            <div className="libro-carga">
              <span>ART suma fija</span>
              <strong>{formatArs2(legalLibro.parametros.artFijo)}</strong>
            </div>
            <div className="libro-carga">
              <span>Detracción</span>
              <strong>{formatArs2(legalLibro.parametros.detraccion)}</strong>
            </div>
          </div>
        </details>
      ) : (
        <details className="rrhh-ext-card libro-plegable">
          <summary>
            <strong>Alícuotas del libro</strong>
            <span className="libro-muted">
              {cerrado ? 'libro cerrado' : 'este período no tiene Liquidación mensual'} · editables
            </span>
          </summary>
          <p className="rrhh-libro-note">
            Se usan las alícuotas propias del libro (ej. 10,77). Los aportes igual se topan y el sindicato solo aplica
            dentro de convenio.
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
                    onCommit={(n) => patchLibro({ alicuotas: { ...a, [c.key]: n / 100 } })}
                  />
                </label>
              )
            })}
          </div>
        </details>
      )}

      <details className="rrhh-ext-card libro-plegable">
        <summary>
          <strong>Conceptos para dar de alta en ARCA</strong>
          <span className="libro-muted">{conceptosArca.length} códigos · una sola vez en Libro de sueldos digital</span>
        </summary>
        <ol className="rrhh-libro-note">
          <li>Entrá a ARCA › Libro de sueldos digital › Conceptos › Alta.</li>
          <li>
            Por cada fila cargá el <strong>código</strong> y la descripción tal cual, y asocialo al concepto de ARCA de
            la columna “Asociar a”.
          </li>
          <li>Los “Remunerativo (resta)” van con signo negativo: el TXT los manda como débito y bajan la base de aportes.</li>
          <li>Después subí el TXT del período. Si ARCA rechaza un código, falta darlo de alta.</li>
        </ol>
        <div className="rrhh-libro-table-wrap">
          <table className="rrhh-ext-table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Descripción</th>
                <th>Tipo</th>
                <th>Unidad</th>
                <th>Asociar a</th>
              </tr>
            </thead>
            <tbody>
              {conceptosArca.map((c) => (
                <tr key={c.codigo}>
                  <td>
                    <code>{c.codigo}</code>
                  </td>
                  <td>{c.descripcion}</td>
                  <td>{c.tipo}</td>
                  <td>{c.unidad}</td>
                  <td>
                    {c.asociar}
                    {c.delSistema ? '' : ' (concepto extra)'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button
          type="button"
          className="rrhh-ext-btn"
          style={{ marginTop: 8 }}
          onClick={() => {
            const blob = new Blob(['﻿' + conceptosParaArcaCsv(conceptosArca)], { type: 'text/csv;charset=utf-8' })
            const a = document.createElement('a')
            a.href = URL.createObjectURL(blob)
            a.download = 'conceptos_lsd_arca.csv'
            a.click()
            URL.revokeObjectURL(a.href)
          }}
        >
          Descargar lista (CSV)
        </button>
        <p className="rrhh-libro-note" style={{ marginTop: 10 }}>
          <a href="https://www.arca.gob.ar/librodesueldosdigital/" target="_blank" rel="noreferrer">
            Libro de sueldos digital
          </a>
          {' · '}
          <a href="https://www.arca.gob.ar/LibrodeSueldosDigital/ayuda/disenios.asp" target="_blank" rel="noreferrer">
            Diseños de registro
          </a>
        </p>
      </details>
    </div>
  )
}

export default RecursosHumanosLibroSueldosPage
