-- Descuento comida: sincronizar automáticamente al guardar/cancelar selección de menú.
-- Evita depender solo del cliente y rellena pedidos históricos con novedad activa.

CREATE OR REPLACE FUNCTION public.trg_menu_seleccion_sync_descuento_beneficio()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fecha date;
  v_novedad_id bigint;
  v_plato_nombre text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.menu_descuentos_beneficio_comida
    WHERE id_seleccion = OLD.id;
    RETURN OLD;
  END IF;

  SELECT m.fecha INTO v_fecha
  FROM public.menus_diarios m
  WHERE m.id = NEW.id_menu;

  IF v_fecha IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT n.id INTO v_novedad_id
  FROM public.rrhh_novedades n
  WHERE n.id_usuario = NEW.id_usuario
    AND n.grupo = 'beneficio_comida'
    AND n.codigo = 'perdida_beneficio_comida'
    AND n.fecha_desde <= v_fecha
    AND n.fecha_hasta >= v_fecha
  ORDER BY n.fecha_desde DESC
  LIMIT 1;

  IF v_novedad_id IS NULL THEN
    DELETE FROM public.menu_descuentos_beneficio_comida
    WHERE id_seleccion = NEW.id;
    RETURN NEW;
  END IF;

  SELECT mp.nombre_plato INTO v_plato_nombre
  FROM public.menu_platos mp
  WHERE mp.id = NEW.id_plato;

  INSERT INTO public.menu_descuentos_beneficio_comida (
    id_usuario, id_menu, id_seleccion, id_novedad, fecha, monto, nombre_plato
  ) VALUES (
    NEW.id_usuario, NEW.id_menu, NEW.id, v_novedad_id, v_fecha, 7000, v_plato_nombre
  )
  ON CONFLICT (id_seleccion) WHERE id_seleccion IS NOT NULL
  DO UPDATE SET
    id_novedad = EXCLUDED.id_novedad,
    fecha = EXCLUDED.fecha,
    monto = EXCLUDED.monto,
    nombre_plato = EXCLUDED.nombre_plato;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_menu_seleccion_descuento_beneficio ON public.menu_selecciones;
CREATE TRIGGER trg_menu_seleccion_descuento_beneficio
  AFTER INSERT OR UPDATE ON public.menu_selecciones
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_menu_seleccion_sync_descuento_beneficio();

DROP TRIGGER IF EXISTS trg_menu_seleccion_descuento_beneficio_del ON public.menu_selecciones;
CREATE TRIGGER trg_menu_seleccion_descuento_beneficio_del
  BEFORE DELETE ON public.menu_selecciones
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_menu_seleccion_sync_descuento_beneficio();

-- Pedidos ya hechos con novedad activa sin descuento registrado
INSERT INTO public.menu_descuentos_beneficio_comida (
  id_usuario, id_menu, id_seleccion, id_novedad, fecha, monto, nombre_plato
)
SELECT
  ms.id_usuario,
  ms.id_menu,
  ms.id,
  n.id,
  m.fecha,
  7000,
  mp.nombre_plato
FROM public.menu_selecciones ms
JOIN public.menus_diarios m ON m.id = ms.id_menu
LEFT JOIN public.menu_platos mp ON mp.id = ms.id_plato
JOIN public.rrhh_novedades n ON n.id_usuario = ms.id_usuario
  AND n.grupo = 'beneficio_comida'
  AND n.codigo = 'perdida_beneficio_comida'
  AND n.fecha_desde <= m.fecha
  AND n.fecha_hasta >= m.fecha
ON CONFLICT (id_seleccion) WHERE id_seleccion IS NOT NULL DO NOTHING;
