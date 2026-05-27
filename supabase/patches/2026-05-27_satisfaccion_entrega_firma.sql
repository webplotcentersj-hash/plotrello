-- Encuesta de satisfacción post-entrega (página /firma-cliente) → panel Atención al público.

CREATE TABLE IF NOT EXISTS public.atencion_satisfaccion_entrega (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  numero_op text NOT NULL,
  orden_id bigint,
  cliente_nombre text,
  rating smallint NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comentario varchar(500),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT atencion_satisfaccion_entrega_numero_op_key UNIQUE (numero_op)
);

CREATE INDEX IF NOT EXISTS idx_atencion_satisfaccion_entrega_created_at
  ON public.atencion_satisfaccion_entrega (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_atencion_satisfaccion_entrega_rating
  ON public.atencion_satisfaccion_entrega (rating);

ALTER TABLE public.atencion_satisfaccion_entrega ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "atencion_satisfaccion_entrega_select" ON public.atencion_satisfaccion_entrega;

CREATE POLICY "atencion_satisfaccion_entrega_select"
  ON public.atencion_satisfaccion_entrega
  FOR SELECT
  TO anon, authenticated
  USING (true);

COMMENT ON TABLE public.atencion_satisfaccion_entrega IS 'Encuesta emoji post-entrega desde /firma-cliente; insert vía RPC.';

CREATE OR REPLACE FUNCTION public.registrar_satisfaccion_entrega_public(
  p_numero_op text,
  p_rating smallint,
  p_comentario text DEFAULT NULL,
  p_cliente_nombre text DEFAULT NULL,
  p_orden_id bigint DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id bigint;
  v_op text;
  v_com text;
  v_cliente text;
BEGIN
  v_op := trim(both from coalesce(p_numero_op, ''));
  IF length(v_op) < 1 OR length(v_op) > 40 THEN
    RAISE EXCEPTION 'numero_op inválido';
  END IF;
  IF p_rating IS NULL OR p_rating < 1 OR p_rating > 5 THEN
    RAISE EXCEPTION 'rating inválido';
  END IF;

  v_com := nullif(trim(both from coalesce(p_comentario, '')), '');
  IF v_com IS NOT NULL AND length(v_com) > 500 THEN
    RAISE EXCEPTION 'comentario demasiado largo';
  END IF;

  v_cliente := nullif(trim(both from coalesce(p_cliente_nombre, '')), '');
  IF v_cliente IS NOT NULL AND length(v_cliente) > 200 THEN
    v_cliente := left(v_cliente, 200);
  END IF;

  INSERT INTO public.atencion_satisfaccion_entrega (
    numero_op, orden_id, cliente_nombre, rating, comentario, updated_at
  ) VALUES (
    v_op, p_orden_id, v_cliente, p_rating, v_com, now()
  )
  ON CONFLICT (numero_op) DO UPDATE SET
    rating = EXCLUDED.rating,
    comentario = EXCLUDED.comentario,
    cliente_nombre = COALESCE(EXCLUDED.cliente_nombre, atencion_satisfaccion_entrega.cliente_nombre),
    orden_id = COALESCE(EXCLUDED.orden_id, atencion_satisfaccion_entrega.orden_id),
    updated_at = now()
  RETURNING id INTO v_id;

  RETURN json_build_object('id', v_id);
END;
$$;

REVOKE ALL ON FUNCTION public.registrar_satisfaccion_entrega_public(text, smallint, text, text, bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.registrar_satisfaccion_entrega_public(text, smallint, text, text, bigint) TO anon, authenticated;

GRANT SELECT ON TABLE public.atencion_satisfaccion_entrega TO anon, authenticated;
