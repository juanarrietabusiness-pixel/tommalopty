'use server';

import { revalidatePath } from 'next/cache';
import { analizar, type Mapeo, type ProductoImportado } from '@nebula/domain';
import { slugify } from '@nebula/ui';
import { getSupabaseServerClient } from '@/lib/supabase';
import { requireAdmin } from '@/lib/auth';
import { bloqueadoEnDemostracion, failure, success, type ActionResult } from './result';

/**
 * Importar productos desde una hoja de cálculo.
 *
 * Todo lo que decide qué entra es puro y vive en `@nebula/domain`. Aquí solo
 * queda escribir, que es lo que no se puede probar sin base de datos.
 */

/** Un tope alto, pero tope. Sin él, un fichero equivocado escribe hasta que algo revienta. */
const MAXIMO_POR_IMPORTACION = 500;

/**
 * El slug tiene que ser único y el título no lo es: dos «Camisa blanca» son
 * normales en un catálogo. Se numera desde el segundo.
 *
 * Se comprueba contra lo que ya hay en la base **y** contra lo que va en este
 * mismo lote: dos filas iguales dentro del fichero chocarían entre ellas, y ese
 * choque no lo ve una consulta hecha antes de empezar.
 */
function slugUnico(titulo: string, ocupados: Set<string>): string {
  const base = slugify(titulo) || 'producto';

  if (!ocupados.has(base)) {
    ocupados.add(base);
    return base;
  }

  for (let n = 2; n < 1000; n += 1) {
    const candidato = `${base}-${n}`;
    if (!ocupados.has(candidato)) {
      ocupados.add(candidato);
      return candidato;
    }
  }

  // Con mil productos que se llaman igual, el problema es otro.
  const ultimo = `${base}-${Date.now()}`;
  ocupados.add(ultimo);
  return ultimo;
}

export interface ResultadoDeImportacion extends ActionResult {
  importados?: number;
  fallidos?: { fila: number; titulo: string; motivo: string }[];
}

export async function importarProductos(
  _previous: ResultadoDeImportacion,
  formData: FormData,
): Promise<ResultadoDeImportacion> {
  await requireAdmin();

  const demo = bloqueadoEnDemostracion();
  if (demo) return demo;

  const texto = formData.get('csv');
  if (typeof texto !== 'string' || texto.trim() === '') {
    return failure('No llegó ningún fichero.');
  }

  // El mapeo viaja desde la pantalla porque quien importa pudo corregirlo: lo
  // que se guarda tiene que ser lo que revisó, no lo que se adivinó otra vez.
  const mapeoBruto = formData.get('mapeo');
  let mapeo: Mapeo | undefined;

  if (typeof mapeoBruto === 'string' && mapeoBruto !== '') {
    try {
      mapeo = JSON.parse(mapeoBruto) as Mapeo;
    } catch {
      return failure('El mapeo de columnas llegó corrupto. Vuelve a cargar el fichero.');
    }
  }

  const analisis = analizar(texto, mapeo);

  if (analisis.faltanCampos.length > 0) {
    return failure(`Faltan columnas obligatorias: ${analisis.faltanCampos.join(', ')}.`);
  }

  if (analisis.productos.length === 0) {
    return failure('No hay ninguna fila que se pueda importar.');
  }

  if (analisis.productos.length > MAXIMO_POR_IMPORTACION) {
    return failure(
      `El fichero trae ${analisis.productos.length} productos y el máximo por importación es ${MAXIMO_POR_IMPORTACION}. ` +
        'Pártelo en varios.',
    );
  }

  const supabase = await getSupabaseServerClient();

  const { data: existentes } = await supabase.from('products').select('slug');
  const ocupados = new Set((existentes ?? []).map((p) => p.slug));

  const fallidos: { fila: number; titulo: string; motivo: string }[] = [];
  let importados = 0;

  for (const producto of analisis.productos) {
    const error = await insertarUno(supabase, producto, ocupados);

    if (error) fallidos.push({ fila: producto.fila, titulo: producto.titulo, motivo: error });
    else importados += 1;
  }

  revalidatePath('/catalogo');

  if (importados === 0) {
    return { ...failure('No se pudo importar ninguno.'), fallidos };
  }

  const rechazadas = analisis.rechazadas.length;

  const mensaje = [
    `${importados} producto${importados === 1 ? '' : 's'} importado${importados === 1 ? '' : 's'} como borrador.`,
    fallidos.length > 0 ? `${fallidos.length} falló al guardar.` : '',
    rechazadas > 0
      ? `${rechazadas} fila${rechazadas === 1 ? '' : 's'} se descartó antes de empezar.`
      : '',
  ]
    .filter(Boolean)
    .join(' ');

  return { ...success(mensaje), importados, fallidos };
}

/**
 * Inserta un producto con su variante por defecto.
 *
 * **Nace como borrador, siempre.** Un fichero de proveedor trae descripciones
 * ajenas, precios sin margen y fotos que no son suyas; publicarlo automáticamente
 * pondría todo eso en la tienda de cara al público en el mismo segundo. Que haya
 * que activarlos es el paso donde alguien los mira.
 */
async function insertarUno(
  supabase: Awaited<ReturnType<typeof getSupabaseServerClient>>,
  producto: ProductoImportado,
  ocupados: Set<string>,
): Promise<string | null> {
  const { data: creado, error } = await supabase
    .from('products')
    .insert({
      title: producto.titulo,
      slug: slugUnico(producto.titulo, ocupados),
      description: producto.descripcion,
      brand: producto.marca,
      status: 'draft',
      is_featured: false,
      tags: [],
      published_at: null,
    })
    .select('id')
    .single();

  if (error || !creado) return error?.message ?? 'no se pudo crear';

  const { error: errorVariante } = await supabase.from('product_variants').insert({
    product_id: creado.id,
    title: 'Estándar',
    price: producto.precio,
    compare_at_price: producto.precioComparar,
    sku: producto.sku,
    is_default: true,
  });

  if (errorVariante) {
    // Un producto sin variante no se puede vender ni editar bien: mejor que no
    // exista a que quede a medias esperando a que alguien lo descubra.
    await supabase.from('products').delete().eq('id', creado.id);
    return `la variante falló (${errorVariante.message})`;
  }

  return null;
}
