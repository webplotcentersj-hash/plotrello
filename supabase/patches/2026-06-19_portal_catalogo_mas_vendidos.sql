-- Top artículos vendidos en pedidos portal (para filtro "Más vendidos")

CREATE OR REPLACE FUNCTION public.obtener_articulos_mas_vendidos_portal(p_limite integer DEFAULT 24)
RETURNS TABLE (id_articulo integer, total_vendido bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    i.id_articulo,
    SUM(i.cantidad)::bigint AS total_vendido
  FROM public.pedidos_clientes_items i
  INNER JOIN public.pedidos_clientes p ON p.id = i.id_pedido
  INNER JOIN public.articulos_empresa ae ON ae.id = i.id_articulo
  WHERE ae.activo = true
    AND COALESCE(ae.visible_portal, ae.visible_clientes, false) = true
    AND p.estado NOT IN ('cancelado', 'rechazado')
  GROUP BY i.id_articulo
  ORDER BY total_vendido DESC, i.id_articulo ASC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limite, 24), 100));
$$;

COMMENT ON FUNCTION public.obtener_articulos_mas_vendidos_portal IS
  'IDs de artículos más vendidos en pedidos web para filtro del catálogo portal.';

GRANT EXECUTE ON FUNCTION public.obtener_articulos_mas_vendidos_portal(integer) TO anon, authenticated;
