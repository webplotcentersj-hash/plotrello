-- ============================================
-- Mejoras para el sistema de chat interno
-- ============================================

-- Función para marcar usuario como en línea
CREATE OR REPLACE FUNCTION public.marcar_usuario_online(p_user_id integer, p_user_nombre text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.online_users (user_id, user_nombre, last_seen)
  VALUES (p_user_id, p_user_nombre, now())
  ON CONFLICT (user_id) 
  DO UPDATE SET 
    user_nombre = p_user_nombre,
    last_seen = now();
END;
$$;

-- Función para obtener usuarios en línea (últimos 5 minutos)
CREATE OR REPLACE FUNCTION public.obtener_usuarios_online()
RETURNS TABLE (
  user_id integer,
  user_nombre text,
  last_seen timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ou.user_id,
    ou.user_nombre::text,
    ou.last_seen
  FROM public.online_users ou
  WHERE ou.last_seen > now() - INTERVAL '5 minutes'
  ORDER BY ou.last_seen DESC;
END;
$$;

-- Función para obtener contador de mensajes por canal
CREATE OR REPLACE FUNCTION public.contar_mensajes_canal(p_room_id integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count integer;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM public.chat_messages
  WHERE room_id = p_room_id;
  
  RETURN COALESCE(v_count, 0);
END;
$$;

-- Agregar columna para URLs de archivos en chat_messages si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'chat_messages' 
    AND column_name = 'archivos_urls'
  ) THEN
    ALTER TABLE public.chat_messages 
    ADD COLUMN archivos_urls jsonb DEFAULT '[]'::jsonb;
  END IF;
END $$;

-- Permisos
GRANT EXECUTE ON FUNCTION public.marcar_usuario_online(integer, text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.obtener_usuarios_online() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.contar_mensajes_canal(integer) TO authenticated, anon;

