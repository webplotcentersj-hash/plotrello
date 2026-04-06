/*
  SUPABASE SQL EDITOR — cómo ejecutar sin error 42601

  • Copiá SOLO lo que está en este archivo (comentarios empiezan con --).
  • NO pegues líneas que empiecen con un guion solo "-" (listas Markdown);
    Postgres las interpreta como SQL y da: syntax error at or near "-".
  • Si la columna visible_en_tablero no existe aún, la consulta (2) fallará:
    aplicá antes el patch 2026-01-30_visible_en_tablero_sin_delete_fusion.sql
*/

-- Ejecutar en Supabase SQL Editor (solo lectura / verificación).
-- Comprueba columnas, función de unificación y ordenes_trabajo.

-- 1) Columna visible_en_tablero (fusión sin DELETE en app + trigger nuevo)
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'ordenes_trabajo'
  AND column_name = 'visible_en_tablero';

-- 2) Cuántas fichas ocultas hay (deberían ser 0 hasta que haya fusiones con el nuevo flujo)
SELECT
  COUNT(*) FILTER (WHERE visible_en_tablero = false) AS ocultas,
  COUNT(*) FILTER (WHERE visible_en_tablero IS DISTINCT FROM false) AS visibles_o_null,
  COUNT(*) AS total
FROM public.ordenes_trabajo;

-- 3) Trigger de unificación al pasar a Finalizado en Taller
SELECT t.tgname AS trigger_name,
       p.proname AS function_name
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE t.tgrelid = 'public.ordenes_trabajo'::regclass
  AND NOT t.tgisinternal
  AND (p.proname ILIKE '%unificar%' OR t.tgname ILIKE '%unificar%');

-- 4) Cuerpo de la función: NO debe contener "DELETE FROM public.ordenes_trabajo" dentro del bloque de unificación
--    (con el patch 2026-01-30 debe usar UPDATE ... visible_en_tablero = false)
SELECT pg_get_functiondef(p.oid) AS definicion
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname = 'unificar_fichas_completadas';

-- 5) FK id_orden_original → si es ON DELETE CASCADE, al borrar la ficha madre se borran duplicados en BD
SELECT
  tc.constraint_name,
  rc.delete_rule
FROM information_schema.table_constraints tc
JOIN information_schema.referential_constraints rc
  ON tc.constraint_name = rc.constraint_name
  AND tc.constraint_schema = rc.constraint_schema
WHERE tc.table_schema = 'public'
  AND tc.table_name = 'ordenes_trabajo'
  AND tc.constraint_type = 'FOREIGN KEY'
  AND tc.constraint_name ILIKE '%orden_original%';

-- 6) Índice único OP + sector (colisiones al mover)
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'ordenes_trabajo'
  AND indexdef ILIKE '%numero_op%'
  AND indexdef ILIKE '%sector%';

-- 7) RPC create_orden_with_contact (debe existir si la app crea OP con contacto / varios sectores)
SELECT p.proname,
       pg_get_function_identity_arguments(p.oid) AS args
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname = 'create_orden_with_contact';

-- 8) RPC sync_op_grupo_sectores_y_fichas (tras editar sectores[] en modal; parche 2026-04-01)
SELECT p.proname,
       pg_get_function_identity_arguments(p.oid) AS args
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname = 'sync_op_grupo_sectores_y_fichas';
