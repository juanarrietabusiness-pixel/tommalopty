import { storage } from '@nebula/integrations';
import { requireStaff } from '@/lib/auth';
import { esModoDemostracion } from '@/lib/demo-mode';
import { getSupabaseServerClient, isSupabaseConfigured } from '@/lib/supabase';
import { getBucketPrivado } from '@/lib/media-privada';

/**
 * Servir un fichero del bucket privado.
 *
 * LA CLAVE DEL OBJETO NO VIAJA EN LA URL, Y ESO ES TODO EL DISEÑO
 *
 * Se pide **la cosa que documenta** —un envío, un pago— y no el fichero. La ruta
 * lee la fila con el cliente de sesión, así que **quien decide si se puede ver es
 * RLS**, la misma que decide todo lo demás. Si la fila no se puede leer, no hay
 * clave; si no hay clave, no hay bytes.
 *
 * La alternativa —`/privado/<clave>` con un `if` de permisos escrito aquí— tiene
 * dos problemas que este diseño no tiene: la clave acabaría en registros de
 * acceso, historiales y capturas; y el `if` sería una segunda copia de las
 * reglas de permiso, que es la que se queda desactualizada.
 *
 * NO SE CACHEA NADA, EN NINGÚN SITIO
 *
 * Las cabeceras las pone `cabecerasDeObjetoPrivado`. Entre este Worker y quien
 * mira hay proxies, antivirus corporativos y el caché del navegador, y una foto
 * de la puerta de un cliente no debe quedarse en ninguno.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TIPOS = ['entrega', 'abono'] as const;
type Tipo = (typeof TIPOS)[number];

function esTipo(valor: string): valor is Tipo {
  return (TIPOS as readonly string[]).includes(valor);
}

/** Cuerpo vacío y sin detalle: no se distingue «no existe» de «no puedes». */
function nada(status: number): Response {
  return new Response(null, { status });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ tipo: string; id: string }> },
) {
  const { tipo, id } = await params;

  if (!esTipo(tipo)) return nada(404);
  if (!/^[0-9a-f-]{36}$/i.test(id)) return nada(404);

  // `requireStaff` redirige, y una redirección con HTML dentro de un `<img>` es
  // una imagen rota sin explicación. Aquí se comprueba y se responde 403.
  const sesion = await requireStaff();
  if (!sesion) return nada(403);

  if (esModoDemostracion() || !isSupabaseConfigured()) return nada(404);

  const supabase = await getSupabaseServerClient();

  const { data, error } =
    tipo === 'entrega'
      ? await supabase
          .from('shipments')
          .select('delivery_proof_key, tracking_number')
          .eq('id', id)
          .maybeSingle()
      : await supabase.from('payments').select('receipt_key, order_id').eq('id', id).maybeSingle();

  if (error || !data) return nada(404);

  const clave = 'delivery_proof_key' in data ? data.delivery_proof_key : (data.receipt_key ?? null);

  if (!clave) return nada(404);

  const bucket = getBucketPrivado();
  if (!bucket) return nada(503);

  const objeto = await bucket.get(clave);
  if (!objeto) return nada(404);

  const nombre =
    'tracking_number' in data ? `entrega-${data.tracking_number}` : `comprobante-${id.slice(0, 8)}`;

  const extension = clave.split('.').pop() ?? 'bin';

  return new Response(objeto.body, {
    headers: storage.cabecerasDeObjetoPrivado({
      contentType: objeto.httpMetadata?.contentType ?? 'application/octet-stream',
      nombreVisible: `${nombre}.${extension}`,
    }),
  });
}
