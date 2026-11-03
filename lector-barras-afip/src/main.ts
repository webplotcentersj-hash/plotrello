import './style.css'
import {
  analizarLectura,
  estadoVencimiento,
  formatearCuit,
  formatearFecha,
  type Lectura,
  type LecturaAfip
} from './afip'
import { ErrorCamara, iniciarEscaner, leerImagen, type Escaner } from './escaner'
import { borrarHistorial, cargarHistorial, guardarEnHistorial } from './historial'

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T

const video = $<HTMLVideoElement>('video')
const estadoEl = $('estado')
const motorEl = $('motor')
const reintentarBtn = $<HTMLButtonElement>('reintentar')
const linternaBtn = $<HTMLButtonElement>('btn-linterna')
const archivoInput = $<HTMLInputElement>('archivo')
const resultado = $<HTMLDialogElement>('resultado')
const manual = $<HTMLDialogElement>('manual')
const manualInput = $<HTMLInputElement>('manual-input')
const manualContador = $('manual-contador')

let escaner: Escaner | null = null
let iniciando = false
// Lecturas dudosas (dígito verificador o datos improbables) se aceptan recién al repetirse.
let ultimaDudosa = ''
let repeticiones = 0
// Al cerrar la hoja la cámara suele seguir sobre el mismo código: se lo ignora un momento para no reabrirla.
let ultimoAceptado = ''
let ignorarIgualesHasta = 0

function crear<K extends keyof HTMLElementTagNameMap>(tag: K, clase?: string, texto?: string): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag)
  if (clase) el.className = clase
  if (texto !== undefined) el.textContent = texto
  return el
}

function boton(texto: string, clase: string, alClick: () => void): HTMLButtonElement {
  const b = crear('button', clase, texto)
  b.type = 'button'
  b.onclick = alClick
  return b
}

function estado(texto: string) {
  estadoEl.textContent = texto
}

async function copiar(texto: string, b: HTMLButtonElement) {
  const original = b.textContent
  try {
    await navigator.clipboard.writeText(texto)
    b.textContent = 'Copiado'
  } catch {
    b.textContent = 'No se pudo copiar'
  }
  window.setTimeout(() => {
    b.textContent = original
  }, 1500)
}

// ---------- Cámara ----------

async function arrancarCamara() {
  if (iniciando || escaner) return
  iniciando = true
  reintentarBtn.hidden = true
  estado('Iniciando cámara…')
  try {
    escaner = await iniciarEscaner(video, alLeer)
    linternaBtn.hidden = !escaner.linternaDisponible
    motorEl.hidden = false
    motorEl.textContent = escaner.motor === 'nativo' ? 'Lector nativo' : 'Lector ZXing'
    estado('Apuntá al código de barras')
  } catch (e) {
    estado(e instanceof ErrorCamara ? e.message : 'No se pudo iniciar la cámara.')
    reintentarBtn.hidden = false
  } finally {
    iniciando = false
  }
}

function detenerCamara() {
  escaner?.detener()
  escaner = null
  linternaBtn.hidden = true
}

function reanudarCamara() {
  if (resultado.open || manual.open) return
  ultimaDudosa = ''
  repeticiones = 0
  ignorarIgualesHasta = Date.now() + 2000
  if (escaner) {
    escaner.reanudar()
    estado('Apuntá al código de barras')
  } else {
    void arrancarCamara()
  }
}

// ---------- Lecturas ----------

function alLeer(texto: string) {
  const lectura = analizarLectura(texto)
  if (lectura.estado === 'no-afip') {
    estado(`Leí otro código (${lectura.texto.length} dígitos). Buscando el de AFIP…`)
    return
  }
  if (lectura.codigo === ultimoAceptado && Date.now() < ignorarIgualesHasta) return
  if (lectura.estado === 'valido' && lectura.avisos.length === 0) {
    aceptar(lectura)
    return
  }
  // Dígito verificador distinto o datos improbables: una mala lectura es lo más probable; se pide repetirla.
  if (lectura.codigo === ultimaDudosa) repeticiones++
  else {
    ultimaDudosa = lectura.codigo
    repeticiones = 1
  }
  if (repeticiones >= 2) aceptar(lectura)
  else estado('Verificando lectura…')
}

function aceptar(lectura: Lectura) {
  if (lectura.estado !== 'no-afip') {
    ultimoAceptado = lectura.codigo
    guardarEnHistorial(lectura.codigo, lectura.estado === 'valido' && lectura.avisos.length === 0)
    renderHistorial()
  }
  // Chrome bloquea vibrar (y lo avisa en consola) hasta que el usuario toca la página por primera vez.
  if (navigator.userActivation?.hasBeenActive !== false) navigator.vibrate?.(lectura.estado === 'valido' ? 80 : [60, 60, 60])
  mostrarResultado(lectura)
}

function insignia(tipo: 'ok' | 'aviso' | 'malo', texto: string) {
  return crear('p', `insignia insignia--${tipo}`, texto)
}

function datosPlano(l: LecturaAfip): string {
  const d = l.datos
  return [
    `CUIT: ${formatearCuit(d.cuit)}`,
    `Comprobante: ${d.tipoNombre ?? 'Código ' + d.tipoCodigo} (${d.tipoCodigo})`,
    `Punto de venta: ${d.puntoVenta}`,
    `CAI/CAE: ${d.cae}`,
    `Vencimiento: ${d.vencimiento ? formatearFecha(d.vencimiento) : d.vencimientoRaw}`,
    `Código: ${l.codigo}`
  ].join('\n')
}

function filaVencimiento(l: LecturaAfip): HTMLElement {
  const dd = crear('dd')
  const { vencimiento, vencimientoRaw } = l.datos
  if (!vencimiento) {
    dd.textContent = `${vencimientoRaw} (fecha inexistente)`
    return dd
  }
  dd.append(formatearFecha(vencimiento) + ' ')
  const { vencido, dias } = estadoVencimiento(vencimiento)
  const texto = vencido
    ? `Vencido hace ${-dias} ${dias === -1 ? 'día' : 'días'}`
    : dias === 0
      ? 'Vigente · vence hoy'
      : `Vigente · faltan ${dias} ${dias === 1 ? 'día' : 'días'}`
  dd.append(crear('span', `estado-vto estado-vto--${vencido ? 'venc' : 'vig'}`, texto))
  return dd
}

function mostrarResultado(l: Lectura) {
  escaner?.pausar()
  const cuerpo = $('res-cuerpo')
  cuerpo.replaceChildren()
  const botones = crear('div', 'hoja__botones')
  const otro = boton('Escanear otro', 'primario', () => resultado.close())

  if (l.estado === 'no-afip') {
    cuerpo.append(insignia('malo', 'No es un código AFIP'), crear('p', 'ayuda', l.motivo))
    if (l.texto) cuerpo.append(crear('p', 'codigo', l.texto))
    botones.append(otro)
    cuerpo.append(botones)
    abrir()
    return
  }

  if (l.estado === 'dv-incorrecto') {
    cuerpo.append(
      insignia('malo', 'Dígito verificador incorrecto'),
      crear(
        'p',
        'ayuda',
        `El último dígito leído es ${l.codigo[39]} y debería ser ${l.dvEsperado}. Puede ser una mala lectura: probá de nuevo con más luz y bien enfocado.`
      )
    )
  } else if (l.avisos.length > 0) {
    cuerpo.append(insignia('aviso', 'Válido, pero con datos dudosos'))
  } else {
    cuerpo.append(insignia('ok', 'Código válido'))
  }
  for (const aviso of l.avisos) cuerpo.append(crear('p', 'aviso', aviso))

  const d = l.datos
  const campos = crear('dl', 'campos')
  const fila = (titulo: string, valor: string) => {
    campos.append(crear('dt', undefined, titulo), crear('dd', undefined, valor))
  }
  fila('Emisor (CUIT)', formatearCuit(d.cuit))
  fila('Comprobante', d.tipoNombre ? `${d.tipoNombre} (${d.tipoCodigo})` : `Código ${d.tipoCodigo}`)
  fila('Punto de venta', d.puntoVenta)
  fila('CAI / CAE', d.cae)
  campos.append(crear('dt', undefined, 'Vencimiento'), filaVencimiento(l))
  cuerpo.append(campos)

  const c = l.codigo
  cuerpo.append(
    crear('p', 'codigo', `${c.slice(0, 11)} ${c.slice(11, 13)} ${c.slice(13, 17)} ${c.slice(17, 31)} ${c.slice(31, 39)} ${c[39]}`)
  )

  const copiarDatos = boton('Copiar datos', '', () => void copiar(datosPlano(l), copiarDatos))
  const copiarNumero = boton('Copiar número', '', () => void copiar(l.codigo, copiarNumero))
  botones.append(copiarDatos, copiarNumero, otro)
  cuerpo.append(botones)
  abrir()
}

function abrir() {
  if (!resultado.open) resultado.showModal()
}

// ---------- Historial ----------

function renderHistorial() {
  const registros = cargarHistorial()
  $('historial').hidden = registros.length === 0
  const lista = $('lista')
  lista.replaceChildren()
  for (const r of registros) {
    const l = analizarLectura(r.codigo)
    if (l.estado === 'no-afip') continue
    const d = l.datos
    const item = crear('li')
    const b = crear('button', 'item')
    b.type = 'button'
    b.append(
      crear('strong', undefined, `${d.tipoNombre ?? 'Comprobante ' + d.tipoCodigo} ${d.puntoVenta}`),
      crear('span', undefined, `${formatearCuit(d.cuit)} · vto ${d.vencimiento ? formatearFecha(d.vencimiento) : '—'}`),
      crear('small', r.valido ? '' : 'dudoso', new Date(r.ts).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' }) + (r.valido ? '' : ' · revisar'))
    )
    b.onclick = () => mostrarResultado(l)
    item.append(b)
    lista.append(item)
  }
}

// ---------- Eventos ----------

reintentarBtn.onclick = () => void arrancarCamara()

linternaBtn.onclick = async () => {
  try {
    const encendida = await escaner?.alternarLinterna()
    linternaBtn.textContent = encendida ? 'Apagar linterna' : 'Linterna'
  } catch {
    estado('Este dispositivo no permite usar la linterna.')
  }
}

$('btn-foto').onclick = () => archivoInput.click()

archivoInput.onchange = async () => {
  const archivo = archivoInput.files?.[0]
  archivoInput.value = ''
  if (!archivo) return
  estado('Analizando la foto…')
  try {
    const texto = await leerImagen(archivo)
    if (texto) aceptar(analizarLectura(texto))
    else estado('No encontré el código en la foto. Acercate, con buena luz y sin recortar las barras.')
  } catch {
    estado('No se pudo abrir esa imagen.')
  }
}

$('btn-manual').onclick = () => {
  escaner?.pausar()
  manualInput.value = ''
  manualContador.textContent = '0 / 40'
  manual.showModal()
  manualInput.focus()
}

manualInput.oninput = () => {
  manualInput.value = manualInput.value.replace(/\D/g, '').slice(0, 40)
  manualContador.textContent = `${manualInput.value.length} / 40`
}

$('form-manual').onsubmit = (e) => {
  e.preventDefault()
  const valor = manualInput.value
  if (!valor) return
  manual.close()
  aceptar(analizarLectura(valor))
}

$('manual-cancelar').onclick = () => manual.close()

for (const hoja of [resultado, manual]) {
  hoja.addEventListener('close', reanudarCamara)
  // tocar fuera de la hoja la cierra
  hoja.addEventListener('click', (e) => {
    if (e.target === hoja) hoja.close()
  })
}

$('borrar').onclick = () => {
  borrarHistorial()
  renderHistorial()
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) detenerCamara()
  else if (!resultado.open && !manual.open) void arrancarCamara()
})

renderHistorial()
void arrancarCamara()
