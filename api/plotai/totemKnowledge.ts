/**
 * Cómo funciona Plot Center para un cliente, escrito para que el asistente de voz del tótem lo explique.
 * Solo incluye hechos que existen en el sistema; lo que no está acá se deriva a mostrador.
 */
export const PLOT_CENTER_FUNCIONAMIENTO = `
CÓMO FUNCIONA PLOT CENTER PARA UN CLIENTE:

CÓMO HACER UN PEDIDO:
- En mostrador (planta baja): un asesor toma el pedido y lo carga en el sistema.
- En este tótem de autogestión: se puede imprimir sin esperar. El cliente sube su archivo desde el celular escaneando un código QR que muestra el tótem, el sistema cotiza y se paga con Mercado Pago o en caja, y el trabajo pasa a la cola de impresión. También se pueden elegir productos del catálogo o pedir un diseño completando un brief.
- Desde la web en el portal de clientes: catálogo, carrito y pago con Mercado Pago, pedir presupuestos online y ver todos sus pedidos y mensajes.
- Trabajos a medida como cartelería, gran formato o instalaciones: un asesor técnico coordina una visita si hace falta, releva las medidas y arma el presupuesto.

SEGUIMIENTO DE UN TRABAJO:
- Cada trabajo tiene un número de OP (orden de producción) con un código QR en el comprobante.
- Con el número de OP se consulta el estado en este tótem (opción averiguar OP), en la web o hablando conmigo.
- Según lo que necesite, un trabajo pasa por sectores: diseño gráfico, imprenta, taller de imprenta, taller gráfico, instalaciones y metalúrgica. Cuando termina en el taller pasa al almacén de entrega y queda listo para retirar.

ENTREGA Y RETIRO:
- Se retira por 9 de Julio 622 en mostrador, con el número de OP. Al entregar, el cliente firma la conformidad en una tablet.
- Las instalaciones se coordinan con el equipo antes de ir.

DISEÑO:
- El equipo de diseño gráfico y marketing trabaja en el 1° piso. El cliente puede contar su idea en el tótem con un brief o hablar con un asesor.

POST VENTA:
- Si algo no salió bien se puede hacer un reclamo desde la web o en mostrador. Al retirar se puede responder una encuesta de satisfacción.

PRECIOS Y PAGOS:
- Los precios que informás salen de la Lista 1 del sistema, se consultan con la herramienta consultar_precios y valen para efectivo, transferencia y débito o tarjeta. Ya incluyen los ajustes de la empresa, por ejemplo el IVA.
- Los pagos online se hacen con Mercado Pago.

LO QUE NO TENÉS CARGADO (no lo inventes, derivá a mostrador o al 2646212163):
- Plazos de entrega, descuentos por cantidad, anticipos o señas, financiación en cuotas, precios de trabajos a medida y disponibilidad de stock.
`.trim()
