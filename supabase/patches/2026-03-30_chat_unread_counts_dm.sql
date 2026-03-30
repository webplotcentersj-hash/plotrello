-- Unread counts por room (sirve para DMs y canales)
-- Requiere tabla chat_last_seen + función chat_marcar_leido (patch 2025-01-18_chat_entregabilidad_y_mejoras.sql)

CREATE OR REPLACE FUNCTION public.chat_contar_no_leidos_por_rooms(
  p_user_id integer,
  p_room_ids integer[]
) RETURNS TABLE(room_id integer, unread_count integer)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH target_rooms AS (
    SELECT unnest(COALESCE(p_room_ids, ARRAY[]::integer[])) AS room_id
  ),
  last_seen AS (
    SELECT
      tr.room_id,
      COALESCE(cls.last_seen_at, 'epoch'::timestamptz) AS last_seen_at
    FROM target_rooms tr
    LEFT JOIN public.chat_last_seen cls
      ON cls.user_id = p_user_id AND cls.room_id = tr.room_id
  )
  SELECT
    ls.room_id,
    COUNT(cm.*)::int AS unread_count
  FROM last_seen ls
  LEFT JOIN public.chat_messages cm
    ON cm.room_id = ls.room_id
   AND cm.id_usuario <> p_user_id
   AND cm."timestamp" > ls.last_seen_at
  GROUP BY ls.room_id
  ORDER BY ls.room_id;
$$;

COMMENT ON FUNCTION public.chat_contar_no_leidos_por_rooms(integer, integer[]) IS
  'Devuelve no leídos por room_id para un usuario (usa chat_last_seen; epoch si nunca abrió).';

GRANT EXECUTE ON FUNCTION public.chat_contar_no_leidos_por_rooms(integer, integer[]) TO anon;
GRANT EXECUTE ON FUNCTION public.chat_contar_no_leidos_por_rooms(integer, integer[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.chat_contar_no_leidos_por_rooms(integer, integer[]) TO service_role;

