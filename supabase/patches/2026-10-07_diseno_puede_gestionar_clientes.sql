-- Diseño opera el circuito comercial de mostrador (vender, facturar, alta de clientes).
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
      AND u.rol IN ('administracion', 'gerencia', 'mostrador', 'caja', 'presupuestos', 'diseno')
  );
$$;

REVOKE ALL ON FUNCTION public.actor_puede_gestionar_clientes(integer) FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.actor_puede_gestionar_clientes(integer) IS
  'Alta/edición de clientes. Roles = canAccessMostradorViews: admin, gerencia, mostrador, caja, presupuestos, diseño.';
