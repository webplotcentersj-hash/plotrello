import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Manejar CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Obtener variables de entorno
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Configuración de Supabase no encontrada' 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Crear cliente de Supabase con service role key (para poder llamar RPC)
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parsear el body de la petición
    const body = await req.json();
    const { telefono, nombre_cliente, usuario_id } = body;

    // Validar que se recibió al menos el teléfono
    if (!telefono) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'El campo "telefono" es requerido' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Crear el brief público usando la función RPC
    const { data: token, error: rpcError } = await supabase.rpc('crear_brief_publico', {
      p_creado_por: usuario_id || null
    });

    if (rpcError) {
      console.error('Error creando brief público:', rpcError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: rpcError.message 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (!token) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'No se pudo generar el token del brief' 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Si se proporcionó nombre_cliente, actualizar el brief
    if (nombre_cliente) {
      const { error: updateError } = await supabase
        .from('briefs_publicos')
        .update({ 
          cliente_nombre_completo: nombre_cliente,
          telefono_cliente: telefono 
        })
        .eq('token', token);

      if (updateError) {
        console.warn('Advertencia: No se pudo actualizar el nombre del cliente:', updateError);
        // No fallar si esto falla, el brief ya está creado
      }
    } else {
      // Solo actualizar el teléfono si no hay nombre
      const { error: updateError } = await supabase
        .from('briefs_publicos')
        .update({ telefono_cliente: telefono })
        .eq('token', token);

      if (updateError) {
        console.warn('Advertencia: No se pudo actualizar el teléfono:', updateError);
      }
    }

    // Construir la URL del brief
    // Obtener el dominio desde la URL de Supabase o usar una variable de entorno
    const baseUrl = Deno.env.get('BRIEF_BASE_URL') || supabaseUrl.replace('.supabase.co', '.vercel.app');
    const briefUrl = `${baseUrl}/brief/${token}`;

    // Mensaje para WhatsApp
    const mensajeWhatsApp = `Hola${nombre_cliente ? ` ${nombre_cliente}` : ''}! 👋

Te envío el formulario de brief para que puedas completar los detalles de tu proyecto:

${briefUrl}

Por favor completa todos los campos requeridos. Si tienes alguna duda, no dudes en consultarnos.

¡Gracias por confiar en nosotros! 🎨`;

    // Devolver respuesta con el link y el mensaje formateado
    return new Response(
      JSON.stringify({
        success: true,
        data: {
          token,
          brief_url: briefUrl,
          mensaje_whatsapp: mensajeWhatsApp,
          telefono,
          nombre_cliente: nombre_cliente || null
        }
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error en generar-brief-webhook:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Error desconocido' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

