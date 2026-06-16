# Manual de proceso — Reclamo en ficha (Plotrello)

Guía operativa para registrar, identificar y cerrar un **reclamo** sobre una orden de producción en el tablero.

---

## 1. Qué es un reclamo en el sistema

Un **reclamo** indica que el trabajo asociado a una **ficha** debe **rehacerse** o revisarse por un problema de calidad, error, cambio no acordado u otro motivo operativo.

Al marcarlo, el sistema:

- Guarda la marca **`en_reclamo`** en la base de datos.
- Opcionalmente guarda el **motivo** en **`reclamo_motivo`** (texto libre).
- Agrega un **comentario** en la ficha con el prefijo `[RECLAMO]`.
- Registra el evento en **historial de movimientos** (trazabilidad interna).

No reemplaza la comunicación verbal con el cliente ni el taller; **documenta** el estado y lo hace **visible** para todo el equipo en el tablero.

---

## 2. Requisitos previos (administración / TI)

Para que la función exista en producción deben estar aplicados en Supabase, en este orden:

1. **`supabase/patches/2026-04-07_ordenes_en_reclamo.sql`** — columna `en_reclamo` (boolean).
2. **`supabase/patches/2026-04-08_ordenes_reclamo_motivo.sql`** — columna `reclamo_motivo` (texto).

Sin la primera columna, la app mostrará error al intentar marcar. Sin la segunda, el reclamo funciona pero el **motivo no queda guardado en la ficha** (solo en el comentario si el flujo lo genera).

---

## 3. Quién puede hacer qué

| Acción | Quién |
|--------|--------|
| **Marcar reclamo** | Usuario con acceso al tablero y botones de la ficha. Si la OP está **trabada** (`op_bloqueada`), solo **administración** o **gerencia** pueden marcar (misma regla que para editar la ficha). |
| **Quitar la marca de reclamo** | Solo **administración** o **gerencia** (botón de confirmación con ícono de tilde verde). |
| **Ver motivo y estado** | Cualquiera con acceso a la ficha en tablero o a la **vista expandida solo lectura** (clic en la tarjeta). |

---

## 4. Proceso: marcar un reclamo

1. Ubicá la **ficha** correcta en el tablero (columna / sector).
2. Asegurate de que la ficha **no esté minimizada** (si está compacta, expandila con un clic para ver la barra de acciones).
3. Pasá el mouse sobre la ficha para ver las **acciones secundarias** (iconos pequeños). El botón de reclamo es el **triángulo de alerta** (naranja).
4. Clic en el **triángulo de alerta**.
5. Confirmá en el cuadro del navegador: *¿Marcar RECLAMO?…*
6. En el siguiente paso podés escribir un **motivo o detalle** (recomendado para trazabilidad). Podés dejarlo vacío y aceptar; el sistema igual registrará el reclamo.
7. Si todo es correcto, la ficha se actualiza en segundos (también vía tiempo real si está activo).

**Buenas prácticas**

- Escribí un motivo **concreto** (qué falló, qué hay que rehacer, referencia a muestra o sector).
- Si hay varias fichas con el mismo número de OP (multi-sector), el reclamo queda **por ficha** (`id_orden`); marcá la que corresponda o las que correspondan.

---

## 5. Cómo se ve un reclamo activo

- **Bordes** de la tarjeta en **naranja fuerte** (izquierda y derecha).
- **Ícono de triángulo** en la ficha expandida (esquina superior) y también en la **vista minimizada** si la ficha está compacta.
- En la **vista expandida solo lectura** (clic en la tarjeta): banner naranja con título *Reclamo — el trabajo debe rehacerse* y el **texto del motivo** si fue cargado.
- Chip **Reclamo** en la zona de resumen del modal.

---

## 6. Proceso: quitar la marca (cierre administrativo)

Cuando el trabajo fue rehecho o el reclamo quedó resuelto:

1. Ingresá con usuario de **administración** o **gerencia**.
2. En la misma ficha, con reclamo activo, aparece el botón para **quitar reclamo** (tilde en verde, en la barra de acciones secundarias; visible al pasar el mouse sobre la ficha).
3. Confirmá *¿Quitar la marca de reclamo de esta ficha?*

El sistema:

- Pone **`en_reclamo`** en falso y limpia **`reclamo_motivo`**.
- Agrega un comentario indicando que la marca fue quitada y por quién.
- Registra el evento en historial (tipo de acción de cierre de reclamo).

---

## 7. Trazabilidad y auditoría

- **Comentarios de la orden:** buscar líneas que empiecen con `[RECLAMO]`.
- **Historial de movimientos:** eventos asociados a la acción de reclamo (alta y baja de marca).
- **Auditoría en tarjeta:** botón de historial/auditoría (según configuración del tablero) para ver movimientos recientes.

Para reclamos ya marcados, **no** se vuelve a mostrar el botón de marcar; hay que quitar la marca antes de un nuevo ciclo formal, o documentar el nuevo problema por otro canal si el proceso interno lo permite.

---

## 8. Problemas frecuentes

| Situación | Qué hacer |
|-----------|-----------|
| Mensaje sobre columna `en_reclamo` o `reclamo_motivo` | Aplicar los parches SQL indicados en la sección 2. |
| No veo el botón de triángulo | Pasá el mouse sobre la ficha (acciones secundarias); verificá que la ficha no esté en modo arrastre global; expandí si está minimizada. |
| No puedo marcar reclamo | La OP puede estar **trabada**: pedí a admin/gerencia o al operario asignado según política de la empresa. |
| “Ya está marcada con reclamo” | Solo un reclamo activo por ficha a la vez; para cerrar usá **quitar reclamo** (admin/gerencia). |

---

## 9. Referencia rápida (técnica)

- **Tabla:** `ordenes_trabajo`  
- **Campos:** `en_reclamo` (boolean), `reclamo_motivo` (text, nullable)  
- **UI principal:** `TaskCard` (tablero), `TaskViewModal` (solo lectura)  
- **API (cliente):** `marcarReclamoOrden`, `desmarcarReclamoOrden` en `src/services/api.ts`

---

*Documento alineado al comportamiento del código en Plotrello. Actualizar si cambian reglas de negocio o permisos.*
