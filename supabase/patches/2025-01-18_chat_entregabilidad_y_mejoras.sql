-- ============================================
-- Mejoras de chat: entregabilidad, lecturas, hilos y reacciones
-- ============================================

-- Columnas nuevas en chat_messages
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'chat_messages' AND column_name = 'reply_to_id'
  ) THEN
    ALTER TABLE public.chat_messages
    ADD COLUMN reply_to_id bigint REFERENCES public.chat_messages(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'chat_messages' AND column_name = 'reacciones'
  ) THEN
    ALTER TABLE public.chat_messages
    ADD COLUMN reacciones jsonb NOT NULL DEFAULT '{}'::jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'chat_messages' AND column_name = 'estado_entrega'
  ) THEN
    ALTER TABLE public.chat_messages
    ADD COLUMN estado_entrega text NOT NULL DEFAULT 'sent';
  END IF;
END$$;

-- Tabla para última lectura por usuario/canal
CREATE TABLE IF NOT EXISTS public.chat_last_seen (
  user_id integer NOT NULL,
  room_id integer NOT NULL,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, room_id)
);

-- Actualiza la última lectura de un usuario en un canal
CREATE OR REPLACE FUNCTION public.chat_marcar_leido(
  p_user_id integer,
  p_room_id integer
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.chat_last_seen(user_id, room_id, last_seen_at)
  VALUES (p_user_id, p_room_id, now())
  ON CONFLICT (user_id, room_id) DO UPDATE
    SET last_seen_at = EXCLUDED.last_seen_at;
END;
$$;

-- Última lectura de otros usuarios en el canal (para estado "leído")
CREATE OR REPLACE FUNCTION public.chat_last_seen_otros(
  p_room_id integer,
  p_user_id integer
) RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_last timestamptz;
BEGIN
  SELECT MAX(last_seen_at) INTO v_last
  FROM public.chat_last_seen
  WHERE room_id = p_room_id
    AND user_id <> p_user_id;

  RETURN v_last;
END;
$$;

-- Alternar reacción de un usuario a un mensaje
CREATE OR REPLACE FUNCTION public.chat_toggle_reaccion(
  p_room_id integer,
  p_message_id bigint,
  p_user_id integer,
  p_emoji text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_reacciones jsonb;
  v_key text := COALESCE(NULLIF(TRIM(p_emoji), ''), '👍');
  v_array jsonb;
BEGIN
  SELECT reacciones INTO v_reacciones
  FROM public.chat_messages
  WHERE id = p_message_id AND room_id = p_room_id
  FOR UPDATE;

  IF v_reacciones IS NULL THEN
    v_reacciones := '{}'::jsonb;
  END IF;

  v_array := v_reacciones -> v_key;

  IF v_array IS NULL OR jsonb_typeof(v_array) <> 'array' THEN
    v_array := '[]'::jsonb;
  END IF;

  IF EXISTS (SELECT 1 FROM jsonb_array_elements_text(v_array) AS elem WHERE elem::int = p_user_id) THEN
    -- Quitar reacción
    v_array := (
      SELECT jsonb_agg(elem)
      FROM jsonb_array_elements_text(v_array) AS elem
      WHERE elem::int <> p_user_id
    );
    IF v_array IS NULL THEN
      v_array := '[]'::jsonb;
    END IF;
  ELSE
    -- Agregar reacción
    v_array := v_array || to_jsonb(p_user_id);
  END IF;

  v_reacciones := v_reacciones || jsonb_build_object(v_key, v_array);

  UPDATE public.chat_messages
  SET reacciones = v_reacciones
  WHERE id = p_message_id;

  RETURN v_reacciones;
END;
$$;

GRANT EXECUTE ON FUNCTION public.chat_marcar_leido(integer, integer) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.chat_last_seen_otros(integer, integer) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.chat_toggle_reaccion(integer, bigint, integer, text) TO authenticated, anon;


