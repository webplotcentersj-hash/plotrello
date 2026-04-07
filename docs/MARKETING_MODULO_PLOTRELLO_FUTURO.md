# Módulo Marketing (Plotrello) — especificación para implementación futura

Documento de referencia: alcance acordado en conversación (uso interno, admin + diseño, foco web Plot / marketing digital, proyectos y campañas).

## Objetivo

Sección interna en Plotrello con **herramientas de marketing digital** y **estrategia para la web de Plot**, con volumen de contenido operativo: **proyectos**, **campañas** y capas de apoyo (calendario, biblioteca, UTM, activos).

## Audiencia y acceso

- **Quién lo ve**: administración (`admin` / flujo `isAdmin`) y rol **diseño** (`diseno` / `isDiseno`), alineado al patrón ya usado (ej. briefs: `isAdmin || isDiseno`).
- **Alcance**: solo **interno**; sin exposición en rutas de cliente ni APIs públicas.
- **Ruta sugerida**: `/diseno/marketing` o `/marketing` con el mismo guard de permisos que otras pantallas restringidas.

## Arquitectura funcional (tabs o sidebar)

1. **Proyectos de marketing**  
   Iniciativas grandes (ej. relanzamiento web, campaña estacional, contenidos trimestrales).  
   Campos típicos: nombre, objetivo, fechas, responsable, estado (borrador / en curso / pausado / cerrado), presupuesto interno opcional, notas.

2. **Campañas**  
   Unidad operativa de difusión/conversión (redes, email, ads, landings).  
   Pueden **pertenecer a un proyecto** o existir sueltas.  
   Campos típicos: nombre, proyecto padre (opcional), canales, fechas, público, mensaje clave, KPIs, enlaces UTM, creatividades (Drive/Storage), checklist o subtareas.

3. **Calendario editorial**  
   Qué publicar y cuándo; vinculado a campaña o proyecto.

4. **Biblioteca de estrategia**  
   Pilares de mensaje, tono, audiencias, objeciones, documentación corta editable.

5. **Herramientas**  
   Generador **UTM**, listado de **URLs críticas** del sitio, checklist **SEO** por página.

6. **Activos de marca**  
   Logos, paleta, tipografías, plantillas de texto; enlaces a archivos.

## Modelo de datos (borrador Supabase)

Tablas orientativas (nombres ajustables):

- `marketing_proyectos`
- `marketing_campañas` (FK opcional a proyecto)
- `marketing_calendario_items` (FK a campaña y/o proyecto)
- Notas/biblioteca: tabla dedicada o `metadata` JSON en proyectos/campañas en un MVP.

**RLS**: lectura/escritura solo para roles acordados (mínimo `administracion`, `gerencia` si se desea lectura, `diseno`; definir política explícita).

## Fases de implementación sugeridas

1. **Proyectos + campañas** (CRUD, relación, filtros y vistas lista/detalle).  
2. **Calendario** ligado a campañas/proyectos.  
3. **Biblioteca + UTM + enlaces** del sitio y checklist SEO.  
4. Opcional: integraciones externas (email, analytics) solo como enlaces o fase posterior.

## Decisión pendiente

- **Campañas siempre bajo proyecto** vs **campañas independientes con etiqueta/proyecto opcional** (la segunda suele ser más rápida en un primer sprint).

## Referencias en código

- Roles: `UserRole` en `src/types/api.ts` (`diseno`, `administracion`, etc.).  
- Auth: `useAuth()` → `isAdmin`, `isDiseno`.  
- Patrón de pantalla restringida: ej. `BriefsPendientesPage.tsx` (`!isAdmin && !isDiseno` → redirección o mensaje).  
- Rutas: `src/App.tsx` (`AppRoutes`).

---

*Última actualización: especificación acordada para uso futuro; no implica que el módulo esté implementado.*
