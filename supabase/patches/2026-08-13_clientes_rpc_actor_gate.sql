-- Paso 9: gate actor en RPCs de portal/ficha (no buscar_o_crear: lo usa tótem y OP).
-- Roles = canAccessMostradorViews: admin, gerencia, mostrador, caja, presupuestos.
-- p_actor_id DEFAULT NULL: front viejo recibe "No autorizado" hasta el deploy.

CREATE OR REPLACE FUNCTION public.actor_puede_gestionar_clientes(p_actor_id integer)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.usuarios u
    WHERE u.id = p_actor_id
      AND COALESCE(u.activo, true) = true
      AND u.rol IN ('administracion', 'gerencia', 'mostrador', 'caja', 'presupuestos')
  );
$$;

REVOKE ALL ON FUNCTION public.actor_puede_gestionar_clientes(integer) FROM PUBLIC, anon, authenticated;

DROP FUNCTION IF EXISTS public.crear_cliente(
  character varying, text, character varying, character varying, character varying,
  character varying, character varying, character varying, text
);

CREATE FUNCTION public.crear_cliente(
  p_usuario character varying,
  p_password text,
  p_nombre character varying,
  p_apellido character varying DEFAULT NULL,
  p_empresa character varying DEFAULT NULL,
  p_telefono character varying DEFAULT NULL,
  p_email character varying DEFAULT NULL,
  p_dni_cuit character varying DEFAULT NULL,
  p_direccion text DEFAULT NULL,
  p_actor_id integer DEFAULT NULL
)
RETURNS TABLE(id integer, usuario character varying, nombre character varying, email character varying)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  password_hash text;
  nuevo_cliente_id integer;
BEGIN
  IF p_actor_id IS NULL OR NOT public.actor_puede_gestionar_clientes(p_actor_id) THEN
    RAISE EXCEPTION 'No autorizado para gestionar clientes';
  END IF;

  IF p_usuario IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.clientes c WHERE c.usuario = p_usuario
  ) THEN
    RAISE EXCEPTION 'El usuario "%" ya existe', p_usuario;
  END IF;

  IF p_email IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.clientes c WHERE c.email = p_email
  ) THEN
    RAISE EXCEPTION 'El email "%" ya está registrado', p_email;
  END IF;

  IF length(p_password) < 6 THEN
    RAISE EXCEPTION 'La contraseña debe tener al menos 6 caracteres';
  END IF;

  password_hash := crypt(p_password, gen_salt('bf'));

  INSERT INTO public.clientes (
    usuario, password_hash, nombre, apellido, empresa,
    telefono, email, dni_cuit, direccion, es_cliente_web, activo
  ) VALUES (
    p_usuario, password_hash, p_nombre, p_apellido, p_empresa,
    p_telefono, p_email, p_dni_cuit, p_direccion, true, true
  )
  RETURNING public.clientes.id INTO nuevo_cliente_id;

  RETURN QUERY
  SELECT c.id, c.usuario, c.nombre, c.email
  FROM public.clientes c
  WHERE c.id = nuevo_cliente_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.crear_cliente(
  character varying, text, character varying, character varying, character varying,
  character varying, character varying, character varying, text, integer
) TO anon, authenticated;

DROP FUNCTION IF EXISTS public.crear_cliente_sin_acceso(
  character varying, character varying, character varying, character varying,
  character varying, character varying, text
);

CREATE FUNCTION public.crear_cliente_sin_acceso(
  p_nombre character varying,
  p_apellido character varying DEFAULT NULL,
  p_empresa character varying DEFAULT NULL,
  p_telefono character varying DEFAULT NULL,
  p_email character varying DEFAULT NULL,
  p_dni_cuit character varying DEFAULT NULL,
  p_direccion text DEFAULT NULL,
  p_actor_id integer DEFAULT NULL
)
RETURNS TABLE(id integer, nombre character varying)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id integer;
BEGIN
  IF p_actor_id IS NULL OR NOT public.actor_puede_gestionar_clientes(p_actor_id) THEN
    RAISE EXCEPTION 'No autorizado para gestionar clientes';
  END IF;

  IF p_nombre IS NULL OR trim(p_nombre) = '' THEN
    RAISE EXCEPTION 'El nombre es requerido';
  END IF;

  IF p_email IS NOT NULL AND trim(p_email) != '' AND EXISTS (
    SELECT 1 FROM public.clientes c WHERE c.email = trim(p_email)
  ) THEN
    RAISE EXCEPTION 'El email "%" ya está registrado', p_email;
  END IF;

  INSERT INTO public.clientes (
    nombre, apellido, empresa, telefono, email, dni_cuit, direccion,
    es_cliente_web, activo
  ) VALUES (
    trim(p_nombre), NULLIF(trim(p_apellido), ''), NULLIF(trim(p_empresa), ''),
    NULLIF(trim(p_telefono), ''), NULLIF(trim(p_email), ''), NULLIF(trim(p_dni_cuit), ''),
    NULLIF(trim(p_direccion), ''), false, true
  )
  RETURNING clientes.id INTO v_id;

  RETURN QUERY SELECT c.id, c.nombre::varchar FROM public.clientes c WHERE c.id = v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.crear_cliente_sin_acceso(
  character varying, character varying, character varying, character varying,
  character varying, character varying, text, integer
) TO anon, authenticated;

DROP FUNCTION IF EXISTS public.habilitar_acceso_cliente(integer, character varying, text);

CREATE FUNCTION public.habilitar_acceso_cliente(
  p_id integer,
  p_usuario character varying,
  p_password text,
  p_actor_id integer DEFAULT NULL
)
RETURNS TABLE(id integer, usuario character varying, nombre character varying)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF p_actor_id IS NULL OR NOT public.actor_puede_gestionar_clientes(p_actor_id) THEN
    RAISE EXCEPTION 'No autorizado para gestionar clientes';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.clientes WHERE clientes.id = p_id) THEN
    RAISE EXCEPTION 'Cliente no encontrado';
  END IF;

  IF p_usuario IS NULL OR trim(p_usuario) = '' THEN
    RAISE EXCEPTION 'El usuario es requerido';
  END IF;

  IF EXISTS (SELECT 1 FROM public.clientes c WHERE c.usuario = p_usuario AND c.id != p_id) THEN
    RAISE EXCEPTION 'El usuario "%" ya existe', p_usuario;
  END IF;

  IF length(p_password) < 6 THEN
    RAISE EXCEPTION 'La contraseña debe tener al menos 6 caracteres';
  END IF;

  UPDATE public.clientes
  SET
    usuario = trim(p_usuario),
    password_hash = crypt(p_password, gen_salt('bf')),
    es_cliente_web = true,
    activo = true,
    updated_at = now()
  WHERE clientes.id = p_id;

  RETURN QUERY
  SELECT c.id, c.usuario::varchar, c.nombre::varchar
  FROM public.clientes c
  WHERE c.id = p_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.habilitar_acceso_cliente(integer, character varying, text, integer)
  TO anon, authenticated;

DROP FUNCTION IF EXISTS public.quitar_acceso_cliente(integer);

CREATE FUNCTION public.quitar_acceso_cliente(
  p_id integer,
  p_actor_id integer DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_actor_id IS NULL OR NOT public.actor_puede_gestionar_clientes(p_actor_id) THEN
    RAISE EXCEPTION 'No autorizado para gestionar clientes';
  END IF;

  UPDATE public.clientes
  SET usuario = NULL, password_hash = NULL, es_cliente_web = false, updated_at = now()
  WHERE clientes.id = p_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.quitar_acceso_cliente(integer, integer) TO anon, authenticated;

DROP FUNCTION IF EXISTS public.actualizar_cliente(
  integer, character varying, character varying, character varying, character varying,
  character varying, character varying, character varying, character varying, text, boolean
);

DROP FUNCTION IF EXISTS public.actualizar_cliente(
  integer, text, character varying, character varying, character varying,
  character varying, character varying, character varying, text, boolean
);

CREATE FUNCTION public.actualizar_cliente(
  p_id integer,
  p_password text DEFAULT NULL,
  p_nombre character varying DEFAULT NULL,
  p_apellido character varying DEFAULT NULL,
  p_empresa character varying DEFAULT NULL,
  p_telefono character varying DEFAULT NULL,
  p_email character varying DEFAULT NULL,
  p_dni_cuit character varying DEFAULT NULL,
  p_direccion text DEFAULT NULL,
  p_activo boolean DEFAULT NULL,
  p_actor_id integer DEFAULT NULL
)
RETURNS TABLE(
  id integer,
  usuario character varying,
  nombre character varying,
  apellido character varying,
  empresa character varying,
  email character varying,
  telefono character varying
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  cliente_id integer;
  cliente_usuario varchar;
  cliente_nombre varchar;
  cliente_apellido varchar;
  cliente_empresa varchar;
  cliente_email varchar;
  cliente_telefono varchar;
  v_password_hash text;
BEGIN
  IF p_actor_id IS NULL OR NOT public.actor_puede_gestionar_clientes(p_actor_id) THEN
    RAISE EXCEPTION 'No autorizado para gestionar clientes';
  END IF;

  SELECT c.id, c.usuario INTO cliente_id, cliente_usuario
  FROM public.clientes c
  WHERE c.id = p_id AND c.es_cliente_web = true;

  IF cliente_id IS NULL THEN
    RAISE EXCEPTION 'Cliente web no encontrado';
  END IF;

  IF p_email IS NOT NULL AND p_email IS DISTINCT FROM (SELECT c2.email FROM public.clientes c2 WHERE c2.id = p_id) THEN
    IF EXISTS (SELECT 1 FROM public.clientes c3 WHERE c3.email = p_email AND c3.id != p_id) THEN
      RAISE EXCEPTION 'El email "%" ya está registrado', p_email;
    END IF;
  END IF;

  IF p_password IS NOT NULL AND length(p_password) > 0 THEN
    IF length(p_password) < 6 THEN
      RAISE EXCEPTION 'La contraseña debe tener al menos 6 caracteres';
    END IF;
    v_password_hash := crypt(p_password, gen_salt('bf'));
  END IF;

  UPDATE public.clientes
  SET
    password_hash = COALESCE(v_password_hash, clientes.password_hash),
    nombre = COALESCE(p_nombre, clientes.nombre),
    apellido = COALESCE(p_apellido, clientes.apellido),
    empresa = COALESCE(p_empresa, clientes.empresa),
    telefono = COALESCE(p_telefono, clientes.telefono),
    email = COALESCE(p_email, clientes.email),
    dni_cuit = COALESCE(p_dni_cuit, clientes.dni_cuit),
    direccion = COALESCE(p_direccion, clientes.direccion),
    activo = COALESCE(p_activo, clientes.activo),
    updated_at = now()
  WHERE clientes.id = p_id;

  SELECT
    c.id, c.usuario, c.nombre, c.apellido, c.empresa, c.email, c.telefono
  INTO
    cliente_id, cliente_usuario, cliente_nombre, cliente_apellido,
    cliente_empresa, cliente_email, cliente_telefono
  FROM public.clientes c
  WHERE c.id = p_id;

  RETURN QUERY
  SELECT
    cliente_id,
    cliente_usuario,
    cliente_nombre,
    cliente_apellido,
    cliente_empresa,
    cliente_email,
    cliente_telefono;
END;
$$;

GRANT EXECUTE ON FUNCTION public.actualizar_cliente(
  integer, text, character varying, character varying, character varying,
  character varying, character varying, character varying, text, boolean, integer
) TO anon, authenticated;

COMMENT ON FUNCTION public.actor_puede_gestionar_clientes(integer) IS
  'Staff mostrador/caja/presupuestos/admin/gerencia activo. Uso interno RPCs clientes.';
COMMENT ON FUNCTION public.crear_cliente IS
  'Alta portal. Requiere p_actor_id con rol mostrador/caja/presupuestos/admin/gerencia.';
