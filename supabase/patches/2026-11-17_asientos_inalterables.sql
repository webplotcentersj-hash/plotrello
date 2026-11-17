-- Asientos contables según el Código Civil y Comercial (arts. 320 a 331):
--  * Un asiento CONTABILIZADO no se modifica ni se borra (art. 329: prohibido alterar los registros).
--    Los errores se corrigen con un contraasiento (asiento nuevo con debe y haber invertidos).
--  * Para contabilizar: al menos una cuenta al debe y otra al haber, cada línea en un solo lado,
--    importes no negativos, y la suma de las líneas igual a los totales (partida doble).
--
-- Excepción: dentro de la MISMA transacción en que se creó el asiento se pueden cargar sus líneas
-- (así trabajan crear_asiento_desde_factura y los asientos automáticos de cobros/pagos).
-- Un borrador sigue siendo editable y se puede anular (no entró al Libro Diario).
--
-- Requiere: 2025-01-23_create_erp_sistema_completo.sql. Convive con el bloqueo de períodos
-- cerrados de 2026-10-26_erp_contable_avanzado.sql. Idempotente.

CREATE OR REPLACE FUNCTION public.erp_validar_lineas_asiento(p_id_asiento integer)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_debe numeric;
  v_haber numeric;
  v_lineas integer;
  v_con_debe integer;
  v_con_haber integer;
  v_malas integer;
  v_cab record;
BEGIN
  SELECT total_debe, total_haber INTO v_cab FROM public.asientos_contables WHERE id = p_id_asiento;
  SELECT COALESCE(SUM(debe), 0), COALESCE(SUM(haber), 0), count(*),
         count(*) FILTER (WHERE debe > 0), count(*) FILTER (WHERE haber > 0),
         count(*) FILTER (WHERE debe < 0 OR haber < 0 OR (debe > 0 AND haber > 0))
    INTO v_debe, v_haber, v_lineas, v_con_debe, v_con_haber, v_malas
  FROM public.asientos_detalle WHERE id_asiento = p_id_asiento;

  IF v_lineas < 2 OR v_con_debe = 0 OR v_con_haber = 0 THEN
    RAISE EXCEPTION 'El asiento necesita al menos una cuenta al debe y otra al haber';
  END IF;
  IF v_malas > 0 THEN
    RAISE EXCEPTION 'Hay líneas con importes negativos o con debe y haber a la vez';
  END IF;
  IF abs(v_debe - v_haber) > 0.009 THEN
    RAISE EXCEPTION 'El asiento no cumple la partida doble (debe % / haber %)', v_debe, v_haber;
  END IF;
  IF abs(v_debe - v_cab.total_debe) > 0.009 OR abs(v_haber - v_cab.total_haber) > 0.009 THEN
    RAISE EXCEPTION 'Los totales del asiento no coinciden con sus líneas';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.erp_asiento_inalterable()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.estado = 'Contabilizado' THEN
      RAISE EXCEPTION 'El asiento % está contabilizado: no se puede borrar. Registrá un contraasiento.', OLD.numero_asiento;
    END IF;
    RETURN OLD;
  END IF;

  -- UPDATE
  IF OLD.estado = 'Contabilizado' AND OLD.created_at <> now() THEN
    RAISE EXCEPTION 'El asiento % está contabilizado: no se puede modificar ni anular. Registrá un contraasiento.', OLD.numero_asiento;
  END IF;
  IF OLD.estado = 'Anulado' AND NEW.estado <> 'Anulado' THEN
    RAISE EXCEPTION 'El asiento % está anulado: no se puede volver a usar.', OLD.numero_asiento;
  END IF;
  IF OLD.estado = 'Borrador' AND NEW.estado = 'Contabilizado' THEN
    PERFORM public.erp_validar_lineas_asiento(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_erp_asiento_inalterable ON public.asientos_contables;
CREATE TRIGGER trg_erp_asiento_inalterable
BEFORE UPDATE OR DELETE ON public.asientos_contables
FOR EACH ROW EXECUTE FUNCTION public.erp_asiento_inalterable();

CREATE OR REPLACE FUNCTION public.erp_detalle_asiento_inalterable()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_id integer := CASE WHEN TG_OP = 'DELETE' THEN OLD.id_asiento ELSE NEW.id_asiento END;
  v_estado text;
  v_numero text;
  v_creado timestamptz;
BEGIN
  SELECT estado, numero_asiento, created_at INTO v_estado, v_numero, v_creado
  FROM public.asientos_contables WHERE id = v_id;

  IF v_estado = 'Contabilizado' AND v_creado <> now() THEN
    RAISE EXCEPTION 'El asiento % está contabilizado: sus líneas no se pueden modificar. Registrá un contraasiento.', v_numero;
  END IF;
  IF v_estado = 'Anulado' AND TG_OP <> 'DELETE' THEN
    RAISE EXCEPTION 'El asiento % está anulado.', v_numero;
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_erp_detalle_asiento_inalterable ON public.asientos_detalle;
CREATE TRIGGER trg_erp_detalle_asiento_inalterable
BEFORE INSERT OR UPDATE OR DELETE ON public.asientos_detalle
FOR EACH ROW EXECUTE FUNCTION public.erp_detalle_asiento_inalterable();
