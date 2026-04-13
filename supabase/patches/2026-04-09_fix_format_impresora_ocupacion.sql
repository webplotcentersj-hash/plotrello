-- =============================================================================
-- OBLIGATORIO EN SUPABASE (producción): Dashboard → SQL Editor → pegar → Run
-- Sin esto, al asignar CUALQUIER impresora (Mimaki, etc.) falla con:
--   "unrecognized format() type specifier ".""
-- Causa: format() de PostgreSQL NO acepta %.1f (solo %s, %I, %L, %%).
-- =============================================================================
BEGIN;

CREATE OR REPLACE FUNCTION public.verificar_ocupacion_impresoras()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  impresora_record record;
BEGIN
  FOR impresora_record IN
    SELECT
      id,
      nombre,
      modelo,
      porcentaje_ocupacion_hoy,
      estado_impresora
    FROM public.v_impresoras_ocupacion
    WHERE porcentaje_ocupacion_hoy >= 90
      AND estado_impresora NOT IN ('Mantenimiento', 'Fuera de Servicio')
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.user_notifications
      WHERE title LIKE format('%%%s%%', impresora_record.nombre)
        AND description LIKE '%ocupación%'
        AND timestamp >= CURRENT_DATE
      LIMIT 1
    ) THEN
      PERFORM public.notificar_usuarios_taller_grafico(
        format('🔴 Impresora %s muy ocupada', impresora_record.nombre),
        format(
          'La impresora %s (%s) tiene una ocupación del %s%% hoy. Considera redistribuir trabajos.',
          impresora_record.nombre,
          COALESCE(impresora_record.modelo, 'Sin modelo'),
          round(impresora_record.porcentaje_ocupacion_hoy::numeric, 1)::text
        ),
        'error'
      );
    END IF;
  END LOOP;
END;
$$;

-- Trigger tras INSERT en impresora_uso: si falla la notificación, no bloquear la asignación.
CREATE OR REPLACE FUNCTION public.verificar_ocupacion_despues_uso()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  ocupacion_record record;
BEGIN
  BEGIN
    SELECT porcentaje_ocupacion_hoy, estado_impresora
    INTO ocupacion_record
    FROM public.v_impresoras_ocupacion
    WHERE id = NEW.id_impresora;

    IF ocupacion_record.porcentaje_ocupacion_hoy >= 90
       AND ocupacion_record.estado_impresora NOT IN ('Mantenimiento', 'Fuera de Servicio') THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.user_notifications
        WHERE title LIKE format('%%%s%%', (SELECT nombre FROM public.impresoras WHERE id = NEW.id_impresora))
          AND description LIKE '%ocupación%'
          AND timestamp >= CURRENT_DATE
        LIMIT 1
      ) THEN
        PERFORM public.notificar_usuarios_taller_grafico(
          format('🔴 Impresora %s muy ocupada', (SELECT nombre FROM public.impresoras WHERE id = NEW.id_impresora)),
          format(
            'La impresora %s ha alcanzado una ocupación del %s%%.',
            (SELECT nombre FROM public.impresoras WHERE id = NEW.id_impresora),
            round(ocupacion_record.porcentaje_ocupacion_hoy::numeric, 1)::text
          ),
          'error'
        );
      END IF;
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'verificar_ocupacion_despues_uso (no bloquea asignación): %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;

COMMIT;
