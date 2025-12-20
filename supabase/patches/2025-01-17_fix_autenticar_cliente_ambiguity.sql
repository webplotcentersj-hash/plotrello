-- Fix: Resolver ambigüedad en función autenticar_cliente
-- Problema: Existían dos versiones de la función con diferentes tipos de p_password
-- Solución: Eliminar ambas y crear una sola versión con p_password text

-- Eliminar todas las versiones existentes
DROP FUNCTION IF EXISTS public.autenticar_cliente(character varying, text);
DROP FUNCTION IF EXISTS public.autenticar_cliente(character varying, character varying);

-- Crear una sola versión con p_password text que retorne todos los campos necesarios
CREATE OR REPLACE FUNCTION public.autenticar_cliente(
  p_usuario varchar(100),
  p_password text
)
RETURNS TABLE (
  id integer,
  usuario varchar,
  nombre varchar,
  apellido varchar,
  empresa varchar,
  email varchar,
  telefono varchar
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  cliente_id integer;
  cliente_usuario varchar;
  cliente_nombre varchar;
  cliente_apellido varchar;
  cliente_empresa varchar;
  cliente_email varchar;
  cliente_telefono varchar;
  cliente_password_hash text;
  password_match boolean;
BEGIN
  -- Buscar cliente por usuario con es_cliente_web = true y activo = true
  SELECT 
    c.id,
    c.usuario,
    c.nombre,
    c.apellido,
    c.empresa,
    c.email,
    c.telefono,
    c.password_hash
  INTO 
    cliente_id,
    cliente_usuario,
    cliente_nombre,
    cliente_apellido,
    cliente_empresa,
    cliente_email,
    cliente_telefono,
    cliente_password_hash
  FROM public.clientes c
  WHERE c.usuario = p_usuario 
    AND c.es_cliente_web = true 
    AND c.activo = true;

  IF cliente_id IS NULL THEN
    RAISE EXCEPTION 'Usuario o contraseña incorrectos';
  END IF;

  -- Verificar contraseña
  password_match := (cliente_password_hash = crypt(p_password, cliente_password_hash));

  IF NOT password_match THEN
    RAISE EXCEPTION 'Usuario o contraseña incorrectos';
  END IF;

  -- Retornar datos del cliente
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

