# Manual de procedimiento — OP con varios sectores (Plotrello)

*Uso interno: crear, mover, fusionar y editar órdenes que recorren más de un sector.*

---

## 1. Objetivo

Definir **qué es una OP**, cómo se refleja en el **tablero** cuando intervienen **varios sectores**, qué pasa cuando **dos fichas de la misma OP coinciden en una columna**, cómo se **unifica** al cerrar taller, y cómo **agregar sectores después** editando la OP.

---

## 2. Conceptos clave

- **OP (orden de trabajo):** un trabajo identificado por su **N° OP** (`numero_op`). Es **una sola orden de negocio**, aunque en el Kanban veas más de una tarjeta.
- **Ficha (en el tablero):** cada **tarjeta** visible en una columna. Con varios sectores puede haber **varias fichas con el mismo N° OP**, una por sector (o una absorbida/oculta).
- **Lista de sectores de la OP (`sectores`):** arreglo en base de datos con **todos los sectores** por los que debe pasar el trabajo. El **primer sector** de la lista define, al crear, en qué columna **arranca** la ficha principal.

---

## 3. Procedimiento: crear una OP con dos o más sectores

1. En el tablero principal, usar **+ Agregar Ficha** (o equivalente).
2. Completar **N° OP**, **Cliente** y demás datos obligatorios.
3. En **Sectores de la OP**, seleccionar **todos los sectores** que aplican (orden importa: el **primero** es el arranque en columna).
4. Confirmar en pantalla que es **una sola OP** con N fichas en tablero (una por sector), mismo número de OP.
5. **Guardar / crear.** El sistema crea el registro principal y, en base de datos, el **trigger** genera las **fichas duplicadas** para los sectores 2, 3, etc. (misma OP, `es_duplicado` y vínculo a la ficha raíz).

**Nota:** Si falta el trigger o hay error al crear, informar a sistemas y revisar parches de Supabase (`crear_fichas_por_sector`).

---

## 4. Trabajo cotidiano: varias fichas, misma OP

- Cada sector puede **mover su ficha** por el tablero de forma independiente.
- Todas las fichas del grupo comparten **mismo N° OP** y la lista `sectores` actualizada.
- **Checklist / subtareas** y otros datos se gestionan según la ficha que estés editando; criterio operativo lo define la empresa (quién carga qué en cada sector).

---

## 5. Procedimiento: dos fichas de la misma OP en la misma columna (absorción)

Cuando **dos instancias** de la misma OP **llegan a la misma columna** (mismo sector/estado visual):

1. El sistema **fusiona a la vista del tablero**: queda **una ficha visible**.
2. La otra fila **no se borra**: queda **oculta del tablero** (`visible_en_tablero`), con trazabilidad en base.
3. Se **reubican** a la ficha visible, entre otros: **historial de movimientos**, **comentarios**, **subtareas**, **adjuntos** y **enlaces**, para no perder auditoría.

**Acción del usuario:** mover con normalidad; si el sistema muestra mensaje de unificación, es esperado. Ante duplicados raros o datos que no se ven, escalar a sistemas con **N° OP** y columna.

---

## 6. Procedimiento: cierre en “Finalizado en Taller” (unificación grupal)

Cuando la OP tenía **más de un sector** y **todas** las fichas del grupo están en **Finalizado en Taller**:

1. El trigger de **unificación** consolida el grupo (según versión desplegada en Supabase): suele dejar **una ficha visible** y **ocultar** las demás **sin DELETE**, manteniendo trazabilidad.
2. No se debe asumir borrado físico: la política del sistema es **preservar filas** para auditoría.

**Acción del usuario:** llevar cada ficha de sector a **Finalizado en Taller** según el flujo real del trabajo; verificar en tablero que quede un solo resultado coherente para esa OP.

---

## 7. Procedimiento: agregar sectores editando la OP

1. Abrir la ficha → **Editar** (modal de edición).
2. En **Sectores de la OP**, **agregar** los sectores nuevos (búsqueda y selección).
3. **Guardar.**

Qué hace el sistema al guardar (con backend actualizado):

1. Se actualiza la fila editada y el payload incluye la nueva lista `sectores`.
2. Si la lista de sectores **cambió**, la aplicación llama al RPC **`sync_op_grupo_sectores_y_fichas`** con el id de la orden editada.
3. Ese RPC **propaga** el mismo array `sectores` a **todas las filas del grupo** (raíz y duplicadas).
4. Para los sectores en posición 2 en adelante, **crea** las fichas duplicadas que **aún no existan** (misma lógica conceptual que al crear la OP).

**Importante para TI:** el RPC debe existir en Supabase (parche SQL `2026-04-01_sync_op_grupo_sectores_y_fichas.sql`). Sin él, el guardado puede funcionar pero **no se crearán** automáticamente las fichas nuevas en tablero hasta aplicar el parche y recargar datos.

**Quitar un sector del listado** en el modal **no elimina** automáticamente una ficha ya creada en base; criterio de limpieza lo define la empresa o sistemas.

---

## 8. Supabase — referencia técnica (sistemas)

| Elemento | Rol |
|----------|-----|
| Trigger `crear_fichas_por_sector` (tras INSERT) | Crea duplicadas al **alta** de OP con `sectores` de longitud mayor a 1. |
| Función `unificar_fichas_completadas` + trigger | Unificación cuando **todas** las del grupo están en **Finalizado en Taller** (según patch vigente). |
| RPC `sync_op_grupo_sectores_y_fichas(p_orden_id)` | Tras **editar** sectores: propaga array y crea duplicadas faltantes. No crea fichas nuevas si la OP está ya en **Finalizado en Taller**. |
| Fusión al mover (`moveOrden` / `fusionarOrdenesDuplicadas` en app) | Misma columna: oculta duplicado y **une** trazabilidad en la ficha visible. |

Diagnóstico sugerido: script `supabase/patches/2026-01-30_diagnostico_supabase_ordenes.sql` (incluye chequeo del RPC de sync).

---

## 9. Responsables

- **Operativo:** uso correcto de sectores al crear y al mover; avisar anomalías con N° OP y captura si hace falta.
- **Sistemas / DBA:** aplicar parches SQL en el orden acordado, verificar triggers y RPC tras deploys, revisar logs de Supabase ante errores de creación o sync.

---

*Documento generado para acompañar el procedimiento de OP multi-sector en Plotrello. Actualizar si cambian triggers o RPCs en producción.*
