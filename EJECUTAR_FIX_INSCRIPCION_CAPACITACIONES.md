# ⚠️ EJECUTAR ESTO EN LA BASE DE DATOS PRINCIPAL

**Base de datos:** https://bwdtrzcdzbzrtykjzber.supabase.co

## Fix: Corregir función de inscripción a capacitaciones

### Problema
La función `inscribirse_capacitacion` tenía un error de sintaxis y no permitía inscribirse correctamente.

### Solución

1. Ve a: https://bwdtrzcdzbzrtykjzber.supabase.co
2. Abre el **SQL Editor**
3. Copia y pega el contenido del archivo `supabase/patches/2025-01-20_fix_inscribirse_capacitacion.sql`
4. Haz clic en **RUN** o presiona `Ctrl+Enter`
5. Verifica que no haya errores

### Cambios realizados

- ✅ Corregido error de sintaxis en verificación de fecha límite
- ✅ Agregada verificación de estado de capacitación (debe estar 'abierta', 'planificada' o 'en_curso')
- ✅ Mejorada verificación de inscripciones existentes (excluye canceladas y rechazadas)
- ✅ Frontend actualizado para permitir inscripciones en capacitaciones planificadas

### Después de ejecutar

Una vez ejecutado el fix, los usuarios podrán:
- Inscribirse en capacitaciones con estado 'abierta', 'planificada' o 'en_curso'
- Ver el botón "Inscribirse" en todas las capacitaciones disponibles
- Recibir notificaciones al inscribirse

