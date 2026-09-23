/**
 * Informe de trabajo 22 sep 2026 → docs/INFORME_TRABAJO_22_SEPTIEMBRE_2026.pdf
 * Uso: node scripts/informe-trabajo-22-sep-pdf.mjs
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { jsPDF } from 'jspdf'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outPath = join(__dirname, '..', 'docs', 'INFORME_TRABAJO_22_SEPTIEMBRE_2026.pdf')

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
    doc.text(pdfText('Plot Lab  ·  Informe de trabajo  ·  22 de septiembre de 2026'), margin, 28)
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
title('22 de septiembre de 2026', 14)
y += 4
doc.setDrawColor(ACCENT.r, ACCENT.g, ACCENT.b)
doc.setLineWidth(1.5)
doc.line(margin, y, margin + 72, y)
y += 22

para(
  'Este informe resume el trabajo del martes 22 de septiembre de 2026 sobre Plot Lab, el sistema operativo interno de Plot Center. La jornada se uso para revisar la logica y la seguridad de los modulos de facturacion, ventas, caja y CRM, y para estudiar la IA JEV (TypeSafe) aplicada a clasificacion de ventas y entregas. Ademas se pidio la comida del equipo por el menu diario.'
)

h2('1. Facturacion')

para(
  'Se reviso el circuito de facturacion electronica de punta a punta: como se numera un comprobante, que pasa cuando AFIP autoriza, y que efectos contables quedan del lado del servidor. El criterio es que una factura emitida no se arma ni se corrige desde el navegador.'
)

h3('1.1 Logica de emision')

bullet('El numero definitivo lo asigna AFIP al autorizar. El numero del borrador es provisorio y va por tipo de comprobante: factura, nota de credito y nota de debito no comparten contador.')
bullet('Si la respuesta de AFIP se corta, se guarda el numero del intento y se consulta el comprobante para recuperar el CAE, en vez de autorizar otro igual.')
bullet('Despues de autorizar, el servidor aplica los efectos: cuenta corriente del cliente (descontando lo ya cobrado en la venta), ajuste de esa cuenta si es nota de credito, y asiento contable. Esos efectos se marcan una sola vez.')
bullet('El concepto AFIP (productos, servicios, o ambos) y el periodo del servicio quedan en la factura. Servicios informan periodo y vencimiento de pago.')
bullet('Se corrigio el plan de cuentas: IVA Debito Fiscal es pasivo e IVA Credito Fiscal es activo.')

h3('1.2 Seguridad')

bullet('La emision y los datos de AFIP los escribe solo el servidor. El frente no puede inventar un CAE ni cambiar una factura ya emitida.')
bullet('Una factura emitida no se edita ni se borra desde la pantalla.')
bullet('Generar el asiento a mano ("Sincronizar asientos") pide un usuario autorizado. La funcion que aplica cuenta corriente y asiento al autorizar queda solo para el servidor.')
bullet('La numeracion ya no se apoya en que el navegador lea la configuracion de AFIP.')

h2('2. Ventas')

para(
  'Se reviso como se crea una venta, como se agregan los items y como eso toca el stock. El hallazgo de seguridad es el que ordeno el resto del dia comercial.'
)

h3('2.1 Quien puede escribir una venta')

para(
  'Las funciones que crean ventas, agregan o sacan items, arman una venta desde una oportunidad o desde un pedido de cliente, y las de oportunidades y seguimientos, corrian sin preguntar quien las llamaba. Con la clave publica del sitio se podia crear una venta, cambiar importes y, por ese camino, fabricar comisiones.'
)

para(
  'Hoy cada una de esas funciones tiene un envoltorio que exige un usuario con permiso comercial. Las originales quedaron cerradas al publico. El CRM y el mostrador mandan el usuario que esta operando. El parche se aplica antes de publicar el frente que llama a los nombres nuevos.'
)

h3('2.2 Venta e items juntos')

para(
  'Antes el mostrador guardaba la venta con el total y despues cargaba los items de a uno. Si un item fallaba a mitad, quedaba una venta con menos importe del que se habia cobrado, porque el total se recalcula como suma de items. Ahora la venta y sus items se guardan en una sola operacion: o entra todo, o no entra nada. Si hay items, el total es la suma; si no hay, vale el monto cargado a mano.'
)

h3('2.3 Stock')

para(
  'Agregar un item descontaba stock sin dejar atado que item lo desconto. Un doble clic descontaba dos veces, y borrar el item no devolvia nada. Ahora el movimiento de venta queda unico por item: reintentar no vuelve a descontar. Al eliminar el item se registra la devolucion.'
)

h3('2.4 Comisiones')

para(
  'Sobre la misma revision de ventas se dejo el modulo de comisiones. La base es configurable (por defecto, sobre el neto y en proporcion a lo cobrado), con un porcentaje general y otro por vendedor. El flujo es recalcular, armar la liquidacion del mes en borrador, aprobar y marcar pagada. Una venta cancelada o con nota de credito baja lo devengado; si ya se habia pagado, la diferencia sale como ajuste en la liquidacion siguiente. Las tablas no se tocan desde el frente: todo pasa por funciones con usuario de administracion o gerencia.'
)

h2('3. Caja')

para(
  'Se reviso la logica y la seguridad de caja junto con el resto del circuito comercial, para que un cobro no quede despegado de quien lo hace.'
)

bullet('Una caja operativa es el usuario titular. Cobros, egresos, arqueos y movimientos se hacen en la caja propia. Elegir la caja de otro para operar no es un flujo valido.')
bullet('Solo el titular, o un rol de administracion o gerencia, escribe en esa caja. Un traspaso de fondo hacia otra caja sale siempre de la caja propia.')
bullet('El fondo de caja es opcional y lo carga quien corresponde. Una caja nueva arranca en cero: el sistema no asigna un fondo fijo por su cuenta ni bloquea un cierre por un minimo que nadie configuro.')
bullet('La revision de ventas y facturacion no mueve la caja de otro usuario. El cobro sigue atado a quien esta operando.')

h2('4. CRM')

para(
  'El CRM de ventas usa las mismas funciones que se cerraron en el punto de ventas: crear y actualizar una oportunidad, cargar un seguimiento y pasar una oportunidad a venta. Antes esas funciones tambien se podian llamar sin identificar al usuario.'
)

para(
  'La pantalla del CRM ahora envia el usuario que esta logueado en cada alta y cada cambio. Sin permiso comercial, la operacion no se guarda. La regla de negocio de la oportunidad (etapas, probabilidad, pasaje a venta) no se reescribio: se le puso el mismo control de actor que al resto del circuito comercial.'
)

h2('5. IA JEV')

para(
  'Se estudio JEV, el modelo de TypeSafe (jev-latest), para clasificar registros que hoy no tienen categoria cerrada. El uso concreto en Plot Lab es de apoyo a estadisticas, no de calculo de plata.'
)

h3('5.1 Para que se usa')

bullet('Rubro de un item de venta cuando el articulo no trae categoria del catalogo (Flexxus). La IA elige entre los mismos rubros del catalogo, con ejemplos de productos, para que lo clasificado a mano y lo clasificado por IA caigan en la misma lista.')
bullet('Motivo de insatisfaccion en una entrega, a partir del comentario de la encuesta: demora, calidad de impresion, error de diseno o de pedido, atencion, precio, instalacion, u otro.')
bullet('Si la encuesta no tiene comentario, no se llama a la IA: queda una regla fija.')

h3('5.2 Como se la dejo acotada')

para(
  'JEV solo elige una opcion de una lista cerrada. No calcula montos, no arma el KPI y no escribe en la base por su cuenta. Los numeros de las estadisticas salen de SQL sobre la tabla de clasificaciones.'
)

bullet('Cada registro se clasifica una sola vez. La fuente queda marcada: catalogo, regla, IA o correccion manual.')
bullet('Si la confianza es baja, el registro se muestra como "sin clasificar" hasta que alguien lo revise.')
bullet('La clave de TypeSafe vive solo en el servidor. La tabla de clasificaciones no la lee el navegador: la usa un endpoint de staff con rol de administracion.')
bullet('Si la clave no esta, o TypeSafe rechaza el pedido, no se reintenta a ciegas. Cortes de red o sobrecarga si se reintentan, con un tope de tiempo para no pasar el limite del servidor.')

h2('6. Menu diario / comida')

para(
  'Ademas del trabajo tecnico, se pidio la comida del dia para el equipo a traves del menu diario de Plot Lab. Queda registrado en este informe como parte de la jornada.'
)

h2('Cierre')

para(
  'En el dia se reviso la logica y la seguridad de facturacion, ventas, caja y CRM. En facturacion, la emision queda atada a AFIP y los efectos contables los aplica el servidor. En ventas y CRM, escribir dejo de ser una funcion abierta: pide un usuario autorizado, la venta entra entera con sus items y el stock se descuenta una sola vez. En caja se confirmo que cada caja es su usuario, con fondo opcional. En paralelo se estudio la IA JEV y se la dejo limitada a clasificar rubros y motivos de entrega, sin tocar importes. El siguiente paso es aplicar estos parches en la base antes de publicar el frente que los usa.'
)

y += 28
ensure(130)
doc.setFont(FONT, 'normal')
doc.setFontSize(10)
doc.setTextColor(MUTED.r, MUTED.g, MUTED.b)
doc.text(pdfText('San Juan, 22 de septiembre de 2026'), margin, y)
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
