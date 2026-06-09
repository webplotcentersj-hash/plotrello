-- Descuentos por pedido de menú con pérdida del beneficio de comida ($7.000 c/u, acumulativos).

CREATE TABLE IF NOT EXISTS public.menu_descuentos_beneficio_comida (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_usuario integer NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  id_menu integer NOT NULL REFERENCES public.menus_diarios(id) ON DELETE CASCADE,
  id_seleccion bigint REFERENCES public.menu_selecciones(id) ON DELETE SET NULL,
  id_novedad bigint REFERENCES public.rrhh_novedades(id) ON DELETE SET NULL,
  fecha date NOT NULL,
  monto integer NOT NULL DEFAULT 7000 CHECK (monto > 0),
  nombre_plato text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_menu_desc_beneficio_seleccion
  ON public.menu_descuentos_beneficio_comida (id_seleccion)
  WHERE id_seleccion IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_menu_desc_beneficio_usuario_fecha
  ON public.menu_descuentos_beneficio_comida (id_usuario, fecha DESC);

CREATE INDEX IF NOT EXISTS idx_menu_desc_beneficio_novedad
  ON public.menu_descuentos_beneficio_comida (id_novedad);

COMMENT ON TABLE public.menu_descuentos_beneficio_comida IS
  'Descuentos acumulativos cuando un empleado pide menú teniendo pérdida del beneficio de comida (RRHH Novedades).';

ALTER TABLE public.menu_descuentos_beneficio_comida ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "menu_desc_beneficio_select" ON public.menu_descuentos_beneficio_comida;
DROP POLICY IF EXISTS "menu_desc_beneficio_insert" ON public.menu_descuentos_beneficio_comida;
DROP POLICY IF EXISTS "menu_desc_beneficio_delete" ON public.menu_descuentos_beneficio_comida;

-- Plotrello usa rol anon (login RPC); mismas políticas abiertas que rrhh_novedades.
CREATE POLICY "menu_desc_beneficio_select" ON public.menu_descuentos_beneficio_comida
  FOR SELECT USING (true);

CREATE POLICY "menu_desc_beneficio_insert" ON public.menu_descuentos_beneficio_comida
  FOR INSERT WITH CHECK (true);

CREATE POLICY "menu_desc_beneficio_delete" ON public.menu_descuentos_beneficio_comida
  FOR DELETE USING (true);

GRANT SELECT, INSERT, DELETE ON public.menu_descuentos_beneficio_comida TO anon, authenticated, service_role;
