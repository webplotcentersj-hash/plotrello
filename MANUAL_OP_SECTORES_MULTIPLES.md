# Manual sencillo — Una OP con dos o más sectores (Plotrello)

*Qué ves en el tablero y qué hacer en el día a día.*

---

## De qué se trata

Una **OP** es un solo trabajo (un solo **número de OP**). Si ese trabajo debe pasar por **varios sectores** (por ejemplo Diseño y Taller), en el Kanban pueden aparecer **varias tarjetas con el mismo número de OP**: una por cada sector. Es normal: es **la misma orden**, repartida en columnas según cada sector.

---

## Al crear la ficha

1. Cargá el **número de OP**, **cliente** y el resto de datos.
2. En **sectores**, marcá **todos** los sectores que correspondan.
3. El **primer sector** de la lista es por donde **empieza** la ficha principal; el sistema genera las demás tarjetas para los otros sectores.

Al guardar, puede tardar un instante en verse todas las tarjetas: el sistema las sincroniza con la base de datos.

---

## Uso diario

- Cada tarjeta se puede **mover** por el tablero como siempre.
- Todas las tarjetas del mismo número de OP comparten la misma **lista de sectores** de la orden.

---

## Cuando dos tarjetas de la misma OP caen en la misma columna

Si movés una tarjeta a una columna donde **ya había otra** de la **misma OP** (mismo número):

- Las dos se **unifican en una sola** tarjeta en esa columna (la que vos movés es la que queda a la vista).
- La otra **no se borra** de la base de datos: queda oculta del tablero para no perder historial ni datos adjuntos.
- La tarjeta que queda puede mostrar la etiqueta **NEW** un rato, para indicar que hubo un movimiento o fusión reciente.

Esto puede repetirse si tenías tres o más sectores: seguí moviendo duplicados a la misma columna y se van uniendo de a una.

---

## Agregar sectores después

1. Abrí la ficha y **Editar**.
2. Sumá sectores en la lista y **Guardar**.

El sistema actualiza el grupo y crea las tarjetas que falten para los sectores nuevos (si el servidor tiene aplicados los parches correspondientes).

---

## Si algo no se ve bien

Anotá el **número de OP** y la **columna** donde pasó y avisá a sistemas. No hace falta recordar detalles técnicos de la base de datos.

---

*Plotrello — manual corto OP multi-sector.*
