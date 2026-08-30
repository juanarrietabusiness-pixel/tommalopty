import { NextResponse } from 'next/server';
import { storage } from '@nebula/integrations';
import { readWriteSession } from '@/lib/auth';
import { esModoDemostracion } from '@/lib/demo-mode';
import { storeMedia } from '@/lib/storage';

/**
 * Subida de imágenes al almacenamiento.
 *
 * Es una ruta de API y no una Server Action porque quien llama necesita la URL
 * de vuelta para pintar la vista previa y rellenar el campo del formulario,
 * antes de que se guarde nada en la base de datos.
 *
 * Todo lo que decide si un fichero se acepta está en el servidor. Lo que el
 * formulario limita con `accept` y `max` es comodidad para quien sube, no una
 * defensa: cualquiera puede llamar a esta ruta directamente.
 */

export const runtime = 'nodejs';

const KINDS: readonly storage.MediaKind[] = ['producto', 'cms'];

function isKind(value: string): value is storage.MediaKind {
  return (KINDS as readonly string[]).includes(value);
}

export async function POST(request: Request) {
  const session = await readWriteSession();

  if (!session) {
    return NextResponse.json(
      { error: 'Tu sesión no tiene permiso para subir imágenes.' },
      { status: 403 },
    );
  }

  if (esModoDemostracion()) {
    return NextResponse.json(
      {
        error:
          'Esto es un recorrido de demostración: se puede navegar todo el panel, pero no se guarda nada.',
      },
      { status: 403 },
    );
  }

  const formData = await request.formData().catch(() => null);

  if (!formData) {
    return NextResponse.json({ error: 'No se recibió ningún archivo.' }, { status: 400 });
  }

  const file = formData.get('file');
  const kind = String(formData.get('kind') ?? '');

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No se recibió ningún archivo.' }, { status: 400 });
  }

  if (!isKind(kind)) {
    return NextResponse.json({ error: 'Destino de la imagen no válido.' }, { status: 400 });
  }

  const result = await storeMedia({ file, kind });

  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: 400 });
  }

  return NextResponse.json({ url: result.url, key: result.key });
}
