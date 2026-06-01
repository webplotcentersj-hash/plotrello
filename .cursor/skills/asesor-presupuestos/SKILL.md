---
name: ASESOR-PRESUPUESTOS
description: >-
  Mantiene el tablero /asesor-presupuestos (fichas No OP, kanban Asesor Técnico →
  Presupuestos → Finalizado). Usar al crear/editar/eliminar fichas, filtrar tarjetas,
  sincronizar tasks tras guardar, o depurar fichas eliminadas que aparecen en columnas.
---

# Asesor / Presupuestos

## Rutas y archivos clave

| Pieza | Ubicación |
|-------|-----------|
| Página | `src/pages/AsesorPresupuestosPage.tsx` |
| Columnas kanban | `src/data/asesorPresupuestosColumns.ts` |
| Modal ficha No OP | `src/components/FichaNoOPModal.tsx` |
| Tablero general (referencia filtros) | `src/pages/BoardPage.tsx` |
| Sync local + otras pestañas | `src/utils/ordenLocalSync.ts`, `src/utils/ordenesBroadcast.ts` |
| Estado global `tasks` | `src/App.tsx` (`loadRemoteData`, realtime, `plotrello-orden-upsert`) |

## Reglas de negocio

1. **Solo fichas del flujo** — El kanban filtra por sector/status (`Asesor Técnico`, `Presupuestos`, `Armados/Enviados`, estados `asesor-tecnico`, `presupuestos`, etc.). No es el tablero de OPs productivas.
2. **Eliminadas fuera del kanban** — Usar `isTaskHiddenFromKanban(task)` en `AsesorPresupuestosPage`, `excludeHiddenFromKanban` en `Board`, y `isOrdenVisibleOnTablero` en `getOrdenes`/caché. `isOrdenMarcadaEliminada` cubre `eliminada`, estado `ELIMINADA` y motivo/fecha de borrado.
3. **Finalizado** — Al mover a `finalizado-asesor-presupuestos`, una ficha No OP puede transformarse en OP (`transformarFichaNoOPAOP`).
4. **Normalización de columna** — `normalizeTaskForAsesorKanban()` alinea `task.status` con el sector si el estado legacy no coincide.

## Sincronización tras crear/editar/eliminar

- **Problema habitual**: `BroadcastChannel` no notifica la misma pestaña que emitió; el usuario ve la ficha tarde si solo depende del refetch al cerrar el QR.
- **Solución**: Tras `createOrden` / `updateOrden` / borrado lógico, llamar `notifyOrdenChangedLocally(orden)` desde `FichaNoOPModal` → evento `plotrello-orden-upsert` → `upsertTaskFromOrden` en `App.tsx`.
- **Refetch**: `onReloadData({ silent: true })` en `onSuccess` del modal; otras pestañas usan `broadcastOrdenesChanged` + debounce 220 ms en `App.tsx`.
- **Polling**: `AsesorPresupuestosPage` refetch silencioso cada 40 s y al volver visible (fallback si realtime falla).

## Checklist al tocar este módulo

- [ ] ¿Los filtros del kanban excluyen `ordenEliminada` y `visibleEnTablero === false`?
- [ ] ¿Tras guardar en modal se llama `notifyOrdenChangedLocally` con la orden devuelta?
- [ ] ¿No se rompe el flujo QR (crear → imprimir QR → cerrar → `onSuccess`)?
- [ ] ¿Drag entre columnas persiste con `apiService.updateOrden` y estados de `mapStatusToEstado`?

## Depuración rápida

| Síntoma | Revisar |
|---------|---------|
| Tarjeta “ELIMINADA” en columna | Falta filtro en `AsesorPresupuestosPage.filteredTasks`; orden con `eliminada=true` en BD |
| Ficha nueva no aparece hasta F5 | Falta `notifyOrdenChangedLocally`; realtime RLS; esperar cierre de QR sin upsert local |
| Ficha en columna equivocada | `normalizeTaskForAsesorKanban`, `sector` / `sectores` en payload de creación |
