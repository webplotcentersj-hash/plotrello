/**
 * Informe de trabajo 18 sep 2026 → docs/INFORME_TRABAJO_18_SEPTIEMBRE_2026.pdf
 * Uso: node scripts/informe-trabajo-18-sep-pdf.mjs
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { jsPDF } from 'jspdf'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outPath = join(__dirname, '..', 'docs', 'INFORME_TRABAJO_18_SEPTIEMBRE_2026.pdf')

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
    doc.text(pdfText('Plot Lab  ·  Informe de trabajo  ·  18 de septiembre de 2026'), margin, 28)
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
title('18 de septiembre de 2026', 14)
y += 4
doc.setDrawColor(ACCENT.r, ACCENT.g, ACCENT.b)
doc.setLineWidth(1.5)
doc.line(margin, y, margin + 72, y)
y += 22

para(
  'Este informe resume el trabajo del viernes 18 de septiembre de 2026 sobre Plot Lab, el sistema operativo interno de Plot Center (tablero de produccion, ventas, caja, ERP, RRHH, portal de clientes y herramientas de IA). La jornada se organizo en dos bloques tecnicos: revisar y explicar la logica de facturacion, y definir un proyecto de refactorizacion del codigo. Ademas se utilizo el menu diario para pedir la comida.'
)

h2('1. Logica de facturacion')

para(
  'Se trabajo sobre como Plot Lab entiende y procesa una “factura”: de donde sale el dato, que pantallas intervienen, como se calcula el comprobante y como se conecta (cuando corresponde) con AFIP. El objetivo fue dejar clara la logica de negocio y de sistema, para poder seguir desarrollando sobre una base compartida.'
)

h3('1.1 El circuito del dia a dia (venta y cobro)')

para(
  'En la operacion cotidiana, el dinero entra por el modulo comercial y por caja. Una venta se carga en el CRM / mostrador (cliente, items, total, medio de pago). El cobro se registra ahi y se sincroniza con Control de Cajas (la caja operativa es el usuario: cada cajero opera la suya). Ese es el circuito que el equipo usa todos los dias: vender, cobrar, dejar trazabilidad.'
)

para(
  'Desde el detalle de una venta se pueden generar documentos en PDF para el cliente o para archivo interno:'
)

bullet('Factura PDF: un documento comercial con los datos de la venta (numero de venta, cliente, items y total). Sirve para entregar o archivar; no es el comprobante electronico de AFIP.')
bullet('Remito PDF: acuse de mercaderia / trabajo, con el mismo origen de datos.')
bullet('Pagare PDF: cuando aplica cuenta corriente u otro acuerdo de pago.')

para(
  'Estos PDFs se arman en el navegador a partir de la venta. Usan el numero de venta, no un punto de venta fiscal ni un CAE. Es decir: documentan la operacion comercial, no reemplazan la factura electronica.'
)

h3('1.2 El circuito fiscal (ERP / Contable)')

para(
  'En paralelo, Plot Lab tiene un modulo Contable (ruta /erp) pensado para el comprobante fiscal. La factura de venta vive en tablas propias (facturas_venta, items, cuentas por cobrar, asientos) y se opera desde estas pantallas:'
)

bullet('/erp/facturas: listado, filtros por estado (Borrador, Emitida, Anulada, Cancelada) y tipo A / B / C.')
bullet('/erp/facturas/nueva: alta. Se puede tomar una venta del CRM que todavia no tenga factura, o una orden de trabajo, o cargar los datos a mano.')
bullet('/erp/facturas/:id: detalle, emision, cobro asociado y autorizacion AFIP.')
bullet('/erp/facturas/:id/nota: nota de credito o debito sobre una factura ya emitida.')
bullet('/erp/impuestos: libro IVA ventas y compras.')
bullet('/erp/configuracion-afip: datos de la empresa (CUIT, razon social, punto de venta, ambiente Testing o Produccion, ultimo numero de cada letra).')

h3('1.3 Como se arma el tipo de factura')

para(
  'Al crear el comprobante, el sistema infiere letra y condicion IVA a partir del cliente:'
)

bullet('Factura A: emisor responsable inscripto hacia otro responsable inscripto (CUIT de 11 digitos y condicion RI).')
bullet('Factura B: caso habitual hacia consumidor final, monotributista u otros no RI.')
bullet('Factura C: cuando la condicion del emisor/receptor corresponde a monotributo.')

para(
  'Los items pueden copiarse de la venta (descripcion, cantidad, precio). Si la venta no tiene renglones, se arma una linea con el total, desagregando IVA 21% por defecto. El usuario puede editar cantidades, descuentos y alicuotas. Los totales (neto, IVA, total) se recalculan en pantalla antes de guardar.'
)

h3('1.4 Estados internos: borrador, emitir, cobrar')

para(
  'La logica interna del comprobante tiene dos pasos separados de AFIP:'
)

bullet('Guardar en borrador: queda en facturas_venta con estado Borrador. Todavia no genera deuda ni asiento.')
bullet('Emitir: pasa a Emitida. Ahi se crea la cuenta por cobrar (el cliente debe ese total) y se intenta generar el asiento contable automatico (si hay plan de cuentas). Las notas de credito no generan una CxC nueva: ajustan la deuda.')
bullet('Registrar cobro: desde el detalle se puede imputar un pago a esa CxC (efectivo, transferencia, tarjeta, etc.) y sincronizarlo con caja.')

para(
  'Emitir, en este diseno, significa “cerrar el comprobante adentro de Plot Lab”. Todavia no es autorizar ante AFIP. Eso es un paso posterior, a proposito, para no mandar a la AFIP un borrador a medio cargar.'
)

h3('1.5 Autorizacion AFIP (factura electronica)')

para(
  'Cuando la factura ya esta Emitida, desde el detalle se puede pedir CAE. El servidor llama a /api/erp/afip-autorizar (sesion staff + token AFIP). El flujo es:'
)

bullet('Se lee la factura y la configuracion AFIP (CUIT, punto de venta, ambiente).')
bullet('Se arma el voucher wsfev1 (tipo de comprobante AFIP: 01 Factura A, 06 Factura B, 11 Factura C).')
bullet('Si el numero interno no esta alineado, se consulta el ultimo comprobante en AFIP y se usa el siguiente.')
bullet('Si AFIP aprueba (resultado A), se guarda CAE, vencimiento de CAE, numero oficial y se actualiza el ultimo numero en la configuracion.')
bullet('Si AFIP rechaza, la factura queda en estado AFIP Error con el mensaje, para corregir y reintentar.')

para(
  'La integracion usa AfipSDK (@afipsdk/afip.js). El ambiente por defecto del proyecto es homologacion (pruebas), con AFIP_PRODUCTION=false. Para produccion real haria falta certificado, CUIT de Plot Center y pasar el ambiente a Produccion. La pantalla de configuracion permite probar la conexion (consulta del ultimo comprobante) antes de autorizar facturas.'
)

h3('1.6 Como se conectan venta, OP y factura')

para(
  'El alta de factura puede nacer de tres origenes, siempre con la misma logica de items y totales:'
)

bullet('Una venta del CRM: se listan las ventas que todavia no tienen factura asociada; al elegirla se copian cliente, fecha, OP si existe, e items.')
bullet('Una orden de trabajo: se toman cliente y descripcion de la OP; si hay venta vinculada, se prefiere esa venta.')
bullet('Carga manual: cliente e items a mano, sin venta previa.')

para(
  'Desde el modal de una venta en el CRM hay un acceso directo “Factura AFIP (Contable)” que abre /erp/facturas/nueva con esa venta precargada. Asi el circuito comercial y el fiscal quedan enlazados por id_venta / id_op, sin mezclar el PDF comercial con el comprobante electronico.'
)

h2('2. Proyecto de refactorizacion')

para(
  'El segundo bloque del dia fue definir un proyecto de refactorizacion de Plot Lab. No se trato de rediseñar el producto ni de cambiar lo que el equipo ve en pantalla. Se trato de como esta organizado el codigo, para que se pueda seguir creciendo sin que cada cambio toque un archivo gigante.'
)

h3('2.1 Por que hace falta')

para(
  'Plot Lab es una sola aplicacion (SPA React) que concentra tablero de OP, mostrador, caja, compras, ERP, RRHH, portal de clientes, totem, Plot AI, flota y mas. El codigo de aplicacion (src, api y lib) ronda las 368.000 lineas; el repositorio versionado entero, unas 851.000. TypeScript en src suma unas 243.000 lineas; el CSS, unas 115.000.'
)

para(
  'El cuello de botella no es “hay mucho codigo” en abstracto, sino que una parte grande vive en pocos archivos. El servicio de datos src/services/api.ts tiene unas 23.100 lineas: es la clase que habla con Supabase (ordenes, ventas, clientes, RRHH, facturas, etc.). Mas de 200 pantallas lo importan. Otras piezas pesadas: la pagina de CRM Ventas (~4.300 lineas), el modal de editar ficha de OP (~2.800), horarios de RRHH, el tablero y varios CSS de caja y work-pool. Las rutas del staff estan casi todas en un solo archivo (StaffAppHost, ~1.500 lineas y ~100 rutas).'
)

para(
  'Eso hace lento cualquier arreglo: para tocar un detalle de facturas o de ventas hay que navegar un archivo enorme, con riesgo de romper otra cosa. El proyecto de refactorizacion apunta a partir ese monolito en dominios, copiando un modelo que ya funciona en el repo: Control de Cajas y Plot Design / Bolsa (carpetas features/ con su propia logica y, en caja, tests).'
)

h3('2.2 Alcance acordado')

para(
  'Se acuerdo un eje solo de ingenieria: extraer y ordenar, sin cambiar URLs, pantallas, RPCs de base de datos ni reglas de negocio. Lo que el usuario hace hoy tiene que seguir igual. Quedo fuera de este proyecto (se puede retomar despues): endurecer seguridad RLS, poner en marcha la facturacion electronica en produccion, migraciones SQL formales, y el sitio publico phi (otro repositorio).'
)

h3('2.3 Como se va a hacer (fases)')

para(
  'La idea es un dominio por pull request, con el build de TypeScript en verde en cada paso. El import apiService desde las pantallas no se cambia al principio: api.ts queda como fachada que reune los pedazos.'
)

bullet('Fase 0 — Red de seguridad: listar los metodos publicos del servicio API, extraer helpers (usuario actual, RPCs de ventas/cobros) a un nucleo chico, y usar npm run build como control de cada PR.')
bullet('Fase 1 — Partir api.ts: mover metodos por dominio (etiquetas y galeria primero, porque estan poco acoplados; ordenes de trabajo al final, porque es el tablero vivo). El archivo original deberia quedar en unas 300-500 lineas de ensamblado.')
bullet('Fase 2 — Partir tipos: src/types/api.ts (~2.000 lineas) en archivos por dominio, reexportando desde el mismo lugar para no romper imports.')
bullet('Fase 3 — Partir rutas staff: StaffAppHost se queda como cascara (sesion y layout); las rutas de tablero, mostrador, compras, RRHH y ERP salen a archivos, igual que ya esta hecho el portal de clientes.')
bullet('Fase 4 — Paginas y modales grandes: CRM Ventas, editar ficha, tablero, horarios RRHH y venta rapida pasan a features/, dejando la pagina como reexport para no tocar rutas.')
bullet('Fase 5 — Codigo duplicado del servidor: api/_lib y lib/api tienen los mismos helpers (JWT, CORS, Mercado Pago). Queda una sola fuente y la otra solo reexporta.')

h3('2.4 Stack sobre el que se refactoriza')

para(
  'No se cambia de tecnologia. Plot Lab sigue siendo React 19, Vite 7, TypeScript 5.9, React Router 7 y Node 22, hospedado en Vercel, con datos en Supabase (PostgreSQL, Storage, Realtime). Las APIs van en funciones serverless. Integraciones que ya estan: Gemini (Plot AI), Mercado Pago, AFIP, Resend, Telegram y ElevenLabs. El refactor ordena ese codigo; no introduce un backend nuevo ni otra base de datos.'
)

para(
  'Estado al cierre de la jornada: el plan esta definido y priorizado. Todavia no se empezo a mover codigo. El primer trabajo concreto seria la fase 0 mas el dominio mas chico de api.ts (etiquetas / galeria), para validar el patron y repetirlo.'
)

h2('3. Menu diario / comida')

para(
  'Ademas del trabajo tecnico, se pidio la comida del dia a traves del menu diario de Plot Lab (el modulo de almuerzo del equipo). Queda registrado en este informe como parte de la jornada.'
)

h2('Cierre')

para(
  'En el dia se dejo documentada la logica de facturacion de Plot Lab: el PDF comercial que sale de la venta, el comprobante fiscal del ERP (borrador, emision, cobro y CAE), y como se atan venta, OP y factura. En paralelo se armo el proyecto de refactorizacion para partir el monolito de codigo sin cambiar el producto. El siguiente paso, cuando se decida ejecutar, es el primer PR de extraccion en api.ts.'
)

y += 28
ensure(130)
doc.setFont(FONT, 'normal')
doc.setFontSize(10)
doc.setTextColor(MUTED.r, MUTED.g, MUTED.b)
doc.text(pdfText('San Juan, 18 de septiembre de 2026'), margin, y)
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
