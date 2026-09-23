/**
 * Informe de trabajo 21 sep 2026 → docs/INFORME_TRABAJO_21_SEPTIEMBRE_2026.pdf
 * Uso: node scripts/informe-trabajo-21-sep-pdf.mjs
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { jsPDF } from 'jspdf'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outPath = join(__dirname, '..', 'docs', 'INFORME_TRABAJO_21_SEPTIEMBRE_2026.pdf')

function pdfText(value) {
  if (!value) return ''
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u00b7/g, '-')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/[^\x20-\x7E]/g, (ch) => {
      const map = { Ñ: 'N', ñ: 'n', '°': 'o' }
      return map[ch] ?? ''
    })
}

const INK = { r: 15, g: 23, b: 42 }
const MUTED = { r: 71, g: 85, b: 105 }
const ACCENT = { r: 234, g: 88, b: 12 }
const RULE = { r: 226, g: 232, b: 240 }

const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' })
const arialReg = 'C:\\Windows\\Fonts\\arial.ttf'
const arialBold = 'C:\\Windows\\Fonts\\arialbd.ttf'
const hasArial = existsSync(arialReg) && existsSync(arialBold)
if (hasArial) {
  doc.addFileToVFS('arial.ttf', readFileSync(arialReg).toString('base64'))
  doc.addFileToVFS('arialbd.ttf', readFileSync(arialBold).toString('base64'))
  doc.addFont('arial.ttf', 'Arial', 'normal')
  doc.addFont('arialbd.ttf', 'Arial', 'bold')
}
const FONT = hasArial ? 'Arial' : 'helvetica'
const pageW = doc.internal.pageSize.getWidth()
const pageH = doc.internal.pageSize.getHeight()
const margin = 52
const maxW = pageW - margin * 2
let y = margin

function newPage() {
  doc.addPage()
  y = margin
  headerBar(true)
  y = 72
}

function ensure(need) {
  if (y + need > pageH - 56) newPage()
}

function headerBar(continuation = false) {
  doc.setFillColor(ACCENT.r, ACCENT.g, ACCENT.b)
  doc.rect(0, 0, pageW, 8, 'F')
  if (continuation) {
    doc.setFont(FONT, 'normal')
    doc.setFontSize(8)
    doc.setTextColor(MUTED.r, MUTED.g, MUTED.b)
    doc.text(pdfText('Plot Lab  ·  Informe de trabajo  ·  21 de septiembre de 2026'), margin, 28)
  }
}

function footer() {
  const n = doc.getNumberOfPages()
  for (let i = 1; i <= n; i++) {
    doc.setPage(i)
    doc.setDrawColor(RULE.r, RULE.g, RULE.b)
    doc.setLineWidth(0.6)
    doc.line(margin, pageH - 36, pageW - margin, pageH - 36)
    doc.setFont(FONT, 'normal')
    doc.setFontSize(8)
    doc.setTextColor(MUTED.r, MUTED.g, MUTED.b)
    doc.text(pdfText('Plot Center  ·  Plot Lab'), margin, pageH - 22)
    doc.text(`${i} / ${n}`, pageW - margin, pageH - 22, { align: 'right' })
  }
}

function title(text, size = 18) {
  ensure(size * 1.6)
  doc.setFont(FONT, 'bold')
  doc.setFontSize(size)
  doc.setTextColor(INK.r, INK.g, INK.b)
  const lines = doc.splitTextToSize(pdfText(text), maxW)
  for (const line of lines) {
    doc.text(line, margin, y)
    y += size * 1.25
  }
}

function subtitle(text) {
  ensure(16)
  doc.setFont(FONT, 'normal')
  doc.setFontSize(10)
  doc.setTextColor(MUTED.r, MUTED.g, MUTED.b)
  doc.text(pdfText(text), margin, y)
  y += 16
}

function h2(text) {
  y += 18
  ensure(28)
  doc.setFillColor(ACCENT.r, ACCENT.g, ACCENT.b)
  doc.rect(margin, y - 11, 4, 16, 'F')
  doc.setFont(FONT, 'bold')
  doc.setFontSize(13)
  doc.setTextColor(INK.r, INK.g, INK.b)
  doc.text(pdfText(text), margin + 12, y)
  y += 18
}

function h3(text) {
  y += 10
  ensure(18)
  doc.setFont(FONT, 'bold')
  doc.setFontSize(11)
  doc.setTextColor(INK.r, INK.g, INK.b)
  doc.text(pdfText(text), margin, y)
  y += 14
}

function para(text) {
  doc.setFont(FONT, 'normal')
  doc.setFontSize(10)
  doc.setTextColor(INK.r, INK.g, INK.b)
  const lines = doc.splitTextToSize(pdfText(text), maxW)
  const lineH = 14
  for (const line of lines) {
    ensure(lineH)
    doc.text(line, margin, y)
    y += lineH
  }
  y += 6
}

function bullet(text) {
  doc.setFont(FONT, 'normal')
  doc.setFontSize(10)
  doc.setTextColor(INK.r, INK.g, INK.b)
  const mark = '•  '
  const wrapW = maxW - 16
  const lines = doc.splitTextToSize(pdfText(text), wrapW)
  const lineH = 14
  ensure(lineH)
  doc.setTextColor(ACCENT.r, ACCENT.g, ACCENT.b)
  doc.text(mark, margin, y)
  doc.setTextColor(INK.r, INK.g, INK.b)
  doc.text(lines[0], margin + 14, y)
  y += lineH
  for (let i = 1; i < lines.length; i++) {
    ensure(lineH)
    doc.text(lines[i], margin + 14, y)
    y += lineH
  }
  y += 3
}

headerBar()
y = 36
subtitle('Plot Center  ·  Sistema interno Plot Lab')
title('Informe de trabajo')
title('21 de septiembre de 2026', 14)
y += 4
doc.setDrawColor(ACCENT.r, ACCENT.g, ACCENT.b)
doc.setLineWidth(1.5)
doc.line(margin, y, margin + 72, y)
y += 22

para(
  'Este informe resume el trabajo del lunes 21 de septiembre de 2026 sobre Plot Lab, el sistema operativo interno de Plot Center (tablero de produccion, ventas, caja, ERP, RRHH, portal de clientes y herramientas de IA). La jornada se organizo en dos bloques tecnicos: avanzar en la refactorizacion del codigo definida el viernes 18, y trabajar en la automatizacion de WhatsApp. Ademas se utilizo el menu diario para pedir la comida.'
)

h2('1. Refactorizacion de Plot Lab')

para(
  'El viernes 18 se definio el proyecto de refactorizacion: no cambiar lo que el equipo ve en pantalla, sino como esta organizado el codigo, para poder seguir creciendo sin que cada arreglo toque un archivo gigante. Hoy se avanzo en esa linea: se paso del plan a empezar a ejecutarlo.'
)

h3('1.1 Por que se sigue con esto')

para(
  'Plot Lab es una sola aplicacion que concentra tablero de OP, mostrador, caja, compras, ERP, RRHH, portal de clientes, totem, Plot AI y mas. Una parte grande del codigo vive en pocos archivos. El servicio de datos (api.ts) concentra la conversacion con la base; mas de 200 pantallas lo importan. Las rutas del staff estan casi todas en un solo host. Paginas como CRM Ventas, el modal de editar ficha y horarios de RRHH son piezas pesadas.'
)

para(
  'Eso hace lento cualquier cambio: para tocar un detalle hay que navegar un archivo enorme, con riesgo de romper otra cosa. El refactor copia un modelo que ya funciona en el repo (Control de Cajas y Plot Design / Bolsa: carpetas features/ con su propia logica).'
)

h3('1.2 Que se avanzo hoy')

para(
  'Se trabajo sobre el eje acordado el viernes: extraer y ordenar, sin cambiar URLs, pantallas, RPCs de base de datos ni reglas de negocio. Lo que el usuario hace hoy tiene que seguir igual. El avance de la jornada fue de ingenieria: seguir partiendo el monolito en dominios, con el import de las pantallas intacto al principio (el servicio original queda como fachada que reune los pedazos).'
)

para('El recorte de fases sigue vigente y es el mapa de este trabajo:')

bullet('Fase 0 - Red de seguridad: listar metodos publicos, extraer helpers a un nucleo chico y usar el build de TypeScript como control de cada paso.')
bullet('Fase 1 - Partir el servicio de datos por dominio (etiquetas y galeria primero; ordenes de trabajo al final).')
bullet('Fase 2 - Partir tipos, reexportando desde el mismo lugar para no romper imports.')
bullet('Fase 3 - Partir rutas staff: el host se queda como cascara (sesion y layout); tablero, mostrador, compras, RRHH y ERP salen a archivos.')
bullet('Fase 4 - Paginas y modales grandes hacia features/, dejando la pagina como reexport.')
bullet('Fase 5 - Una sola fuente para helpers duplicados del servidor (JWT, CORS, Mercado Pago).')

para(
  'Quedo fuera de este proyecto (se puede retomar despues): endurecer seguridad RLS, poner en marcha la facturacion electronica en produccion, migraciones SQL formales, y el sitio publico phi (otro repositorio). No se cambia de tecnologia: Plot Lab sigue siendo React, Vite, TypeScript y Supabase.'
)

h3('1.3 Criterio de cierre de cada paso')

para(
  'Un dominio por vez, con el producto igual que ayer. Si una pantalla, una ruta o un cobro se comporta distinto, el paso no esta cerrado. El objetivo de esta semana no es “terminar el refactor”, sino dejar el patron repetible: extraer, ensamblar, verificar, seguir con el siguiente dominio.'
)

h2('2. Automatizacion de WhatsApp')

para(
  'El segundo bloque del dia fue trabajar en automatizar WhatsApp como canal operativo de Plot Lab. Hoy gran parte de la comunicacion con clientes por WhatsApp sigue siendo asistida: el sistema arma el mensaje o el link, y una persona abre WhatsApp y lo manda. El trabajo de hoy apunta a achicar ese paso manual.'
)

h3('2.1 Como esta WhatsApp hoy en Plot Lab')

para(
  'WhatsApp ya esta metido en varios circuitos, pero casi siempre como atajo, no como envio automatico:'
)

bullet('Tablero y entrega: cada OP puede tener telefono y un link wa.me para avisar al cliente (trabajo listo, falta un dato, demora).')
bullet('CRM / presupuestos: se puede compartir un presupuesto o un brief por WhatsApp; se abre la app con el texto listo.')
bullet('Plot AI: puede redactar el aviso (“tu trabajo OP ... esta listo para retirar”) y abrir WhatsApp. No lo envia solo: el usuario confirma.')
bullet('Atencion al publico: las conversaciones del chat guardan telefono y link de WhatsApp del visitante, para que el staff continue por ahi.')
bullet('Brief automatico: hay un flujo documentado (n8n + webhook) para responder un pedido de presupuesto con el link del formulario. Esa pieza existe; el envio automatico es lo que se esta empujando.')

h3('2.2 Que se busco hoy')

para(
  'Se trabajo en pasar de “abrir WhatsApp para que alguien mande” a un canal que Plot Lab pueda usar solo, en los casos de negocio que ya estan claros:'
)

bullet('Avisos de produccion: trabajo listo para retirar, falta un dato, demora. Hoy Plot AI redacta y el staff envia; el objetivo es que el aviso salga cuando el estado de la OP lo justifica.')
bullet('Presupuestos y briefs: que el link del formulario o del PDF no dependa de que alguien copie y pegue.')
bullet('Atencion: que un visitante que dejo WhatsApp pueda recibir respuesta por el mismo canal, no solo por el chat embebido.')
bullet('Trazabilidad: que quede registro de que se aviso, a quien y con que texto, atado a la OP o a la venta. Sin eso, automatizar es mandar a ciegas.')

para(
  'El criterio es el mismo que en el refactor: no inventar un producto nuevo. Se automatiza lo que el equipo ya hace a mano todos los dias. El envio masivo o el chatbot que reemplaza al mostrador no es el alcance de esta jornada.'
)

h3('2.3 Estado al cierre')

para(
  'Quedo avanzado el diseno del canal: que mensajes se pueden automatizar, de donde sale el telefono (OP, cliente, conversacion de atencion) y que sigue siendo confirmacion humana (cobros, excepciones, textos fuera de plantilla). El siguiente paso concreto es cerrar el primer envio automatico de punta a punta en un caso chico (por ejemplo aviso de “listo para retirar”) y despues repetir el patron.'
)

h2('3. Menu diario / comida')

para(
  'Ademas del trabajo tecnico, se pidio la comida del dia a traves del menu diario de Plot Lab (el modulo de almuerzo del equipo). Queda registrado en este informe como parte de la jornada.'
)

h2('Cierre')

para(
  'En el dia se avanzo en la refactorizacion de Plot Lab: se ejecuto sobre el plan del viernes (partir el monolito por dominios, sin cambiar el producto). En paralelo se trabajo en automatizar WhatsApp, para que avisos, presupuestos y atencion no dependan de abrir la app a mano en cada caso. El siguiente paso es seguir extrayendo el siguiente dominio del servicio de datos, y cerrar el primer aviso automatico de WhatsApp de punta a punta.'
)

y += 28
ensure(130)
doc.setFont(FONT, 'normal')
doc.setFontSize(10)
doc.setTextColor(MUTED.r, MUTED.g, MUTED.b)
doc.text(pdfText('San Juan, 21 de septiembre de 2026'), margin, y)
y += 22
doc.text(pdfText('Firma:'), margin, y)
y += 40
doc.setDrawColor(INK.r, INK.g, INK.b)
doc.setLineWidth(0.8)
doc.line(margin, y, margin + 240, y)
y += 16
doc.setFont(FONT, 'bold')
doc.setFontSize(11)
doc.setTextColor(INK.r, INK.g, INK.b)
doc.text(hasArial ? 'MANUEL ALEJANDRO CHÁVEZ' : pdfText('MANUEL ALEJANDRO CHAVEZ'), margin, y)
y += 14
doc.setFont(FONT, 'normal')
doc.setFontSize(9)
doc.setTextColor(MUTED.r, MUTED.g, MUTED.b)
doc.text(pdfText('Plot Lab  /  Plot Center'), margin, y)

footer()
writeFileSync(outPath, Buffer.from(doc.output('arraybuffer')))
console.log('PDF generado:', outPath)
