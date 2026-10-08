-- Auditoría de presupuestos presenciales: quién lo creó y cada cambio de estado.
-- El listado es compartido; cualquier staff puede cambiar estado / aprobar / generar venta.

CREATE TABLE IF NOT EXISTS public.presupuestos_ventas_auditoria (
  id serial PRIMARY KEY,
  id_presupuesto integer NOT NULL REFERENCES public.presupuestos_ventas(id) ON DELETE CASCADE,
  accion text NOT NULL,
  motivo text,
  actor_id integer,
  actor_nombre text,
  detalle jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS presupuestos_ventas_auditoria_idx
  ON public.presupuestos_ventas_auditoria (id_presupuesto, created_at DESC);

ALTER TABLE public.presupuestos_ventas_auditoria ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS presupuestos_ventas_auditoria_select ON public.presupuestos_ventas_auditoria;
CREATE POLICY presupuestos_ventas_auditoria_select ON public.presupuestos_ventas_auditoria
  FOR SELECT USING (true);

GRANT SELECT ON public.presupuestos_ventas_auditoria TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.presupuestos_ventas_auditoria_id_seq TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.registrar_auditoria_presupuesto_venta(
  p_id_presupuesto integer,
  p_accion text,
  p_actor_id integer DEFAULT NULL,
  p_actor_nombre text DEFAULT NULL,
  p_motivo text DEFAULT NULL,
  p_detalle jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.presupuestos_ventas_auditoria (
    id_presupuesto, accion, actor_id, actor_nombre, motivo, detalle
  ) VALUES (
    p_id_presupuesto,
    p_accion,
    p_actor_id,
    NULLIF(btrim(COALESCE(p_actor_nombre, '')), ''),
    NULLIF(btrim(COALESCE(p_motivo, '')), ''),
    p_detalle
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.registrar_auditoria_presupuesto_venta(integer, text, integer, text, text, jsonb)
  TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.trg_presupuestos_ventas_auditoria_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.presupuestos_ventas_auditoria (
    id_presupuesto, accion, actor_id, actor_nombre, detalle, created_at
  ) VALUES (
    NEW.id,
    'creado',
    NEW.id_vendedor,
    COALESCE(NULLIF(btrim(COALESCE(NEW.nombre_vendedor, '')), ''), 'Sistema'),
    jsonb_build_object(
      'estado', NEW.estado,
      'precio_total', NEW.precio_total,
      'numero_presupuesto', NEW.numero_presupuesto
    ),
    COALESCE(NEW.fecha_creacion, now())
  );
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_presupuestos_ventas_auditoria_insert ON public.presupuestos_ventas;
CREATE TRIGGER trg_presupuestos_ventas_auditoria_insert
  AFTER INSERT ON public.presupuestos_ventas
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_presupuestos_ventas_auditoria_insert();

DROP FUNCTION IF EXISTS public.actualizar_estado_presupuesto_venta(integer, character varying, text);

CREATE OR REPLACE FUNCTION public.actualizar_estado_presupuesto_venta(
  p_id_presupuesto integer,
  p_estado character varying,
  p_observaciones_internas text DEFAULT NULL,
  p_actor_id integer DEFAULT NULL,
  p_actor_nombre text DEFAULT NULL,
  p_motivo text DEFAULT NULL
)
RETURNS TABLE(id integer, numero_presupuesto character varying, estado character varying)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  presupuesto_record RECORD;
  estado_previo character varying;
BEGIN
  IF p_estado NOT IN ('borrador', 'enviado', 'aceptado', 'rechazado', 'cancelado', 'convertido') THEN
    RAISE EXCEPTION 'Estado inválido: %', p_estado;
  END IF;

  SELECT pv.estado INTO estado_previo
  FROM public.presupuestos_ventas AS pv
  WHERE pv.id = p_id_presupuesto;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Presupuesto no encontrado';
  END IF;

  UPDATE public.presupuestos_ventas AS pv
  SET
    estado = p_estado,
    observaciones_internas = COALESCE(p_observaciones_internas, pv.observaciones_internas),
    fecha_envio = CASE
      WHEN p_estado = 'enviado' AND pv.fecha_envio IS NULL THEN NOW()
      ELSE pv.fecha_envio
    END,
    fecha_respuesta = CASE
      WHEN p_estado IN ('aceptado', 'rechazado') THEN NOW()
      ELSE pv.fecha_respuesta
    END,
    updated_at = NOW()
  WHERE pv.id = p_id_presupuesto
  RETURNING * INTO presupuesto_record;

  IF estado_previo IS DISTINCT FROM p_estado THEN
    INSERT INTO public.presupuestos_ventas_auditoria (
      id_presupuesto, accion, actor_id, actor_nombre, motivo, detalle
    ) VALUES (
      p_id_presupuesto,
      'estado',
      p_actor_id,
      NULLIF(btrim(COALESCE(p_actor_nombre, '')), ''),
      NULLIF(btrim(COALESCE(p_motivo, '')), ''),
      jsonb_build_object('desde', estado_previo, 'hasta', p_estado)
    );
  END IF;

  RETURN QUERY
  SELECT
    presupuesto_record.id,
    presupuesto_record.numero_presupuesto,
    presupuesto_record.estado;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.actualizar_estado_presupuesto_venta(integer, character varying, text, integer, text, text)
  TO anon, authenticated;

INSERT INTO public.presupuestos_ventas_auditoria (
  id_presupuesto, accion, actor_id, actor_nombre, detalle, created_at
)
SELECT
  pv.id,
  'creado',
  pv.id_vendedor,
  COALESCE(NULLIF(btrim(COALESCE(pv.nombre_vendedor, '')), ''), 'Sistema'),
  jsonb_build_object(
    'estado', pv.estado,
    'precio_total', pv.precio_total,
    'numero_presupuesto', pv.numero_presupuesto,
    'backfill', true
  ),
  COALESCE(pv.fecha_creacion, pv.created_at, now())
FROM public.presupuestos_ventas pv
WHERE NOT EXISTS (
  SELECT 1
  FROM public.presupuestos_ventas_auditoria a
  WHERE a.id_presupuesto = pv.id
    AND a.accion = 'creado'
);
