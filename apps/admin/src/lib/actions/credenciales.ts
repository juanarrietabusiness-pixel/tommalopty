'use server';

import { revalidatePath } from 'next/cache';
import { credenciales as cred } from '@nebula/integrations';
import { deleteCredencial, upsertCredenciales, type CredencialAGuardar } from '@nebula/db';
import { requireAdmin } from '@/lib/auth';
import { bloqueadoEnDemostracion, failure, success, type ActionResult } from './result';

/**
 * Guardar y revocar credenciales.
 *
 * Cuatro reglas gobiernan todo lo de aquí, y las cuatro son de seguridad:
 *
 * 1. **Solo superadministrador.** Un `operator` no tiene por qué poder cambiar
 *    con qué cuenta cobra la tienda.
 * 2. **Un campo vacío no borra.** Es lo que permite reenviar el formulario para
 *    tocar un solo campo sin tener que volver a pegar los otros tres. Para
 *    quitar una credencial está su propio botón, que dice lo que hace.
 * 3. **El valor nunca sale de aquí.** Se cifra, se guarda, y lo único que se
 *    devuelve al navegador es la pista.
 * 4. **Nunca se registra un valor en un log**, ni siquiera al fallar. Un
 *    `console.error(formData)` en un mal día publica la clave de Yappy en los
 *    registros de Cloudflare.
 */

function claveMaestra(): string | null {
  const clave = process.env.CREDENCIALES_CLAVE_MAESTRA;
  return clave && clave.trim() !== '' ? clave : null;
}

export async function guardarCredenciales(
  proveedor: string,
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const session = await requireAdmin();

  const demo = bloqueadoEnDemostracion();
  if (demo) return demo;

  if (session.role !== 'superadmin') {
    return failure('Solo un superadministrador puede guardar credenciales.');
  }

  const integracion = cred.integracionPorProveedor(proveedor);
  if (!integracion) return failure(`No conozco la integración «${proveedor}».`);

  const maestra = claveMaestra();
  if (!maestra) {
    return failure(
      'Falta la clave maestra del hosting (CREDENCIALES_CLAVE_MAESTRA). ' +
        'Sin ella no se puede cifrar nada, y guardar sin cifrar no es una opción.',
    );
  }

  let clave: CryptoKey;
  try {
    clave = await cred.importarClaveMaestra(maestra);
  } catch {
    return failure('La clave maestra del hosting no es válida. Tiene que ser 32 bytes en base64.');
  }

  const aGuardar: CredencialAGuardar[] = [];

  for (const campo of integracion.campos) {
    const valor = formData.get(campo.clave);
    if (typeof valor !== 'string') continue;

    const limpio = valor.trim();

    // Vacío significa «no lo toques», no «bórralo». Ver la regla 2.
    if (limpio === '') continue;

    aGuardar.push({
      clave: campo.clave,
      proveedor,
      valorCifrado: await cred.cifrar(limpio, clave),
      esSecreto: campo.secreto,
      pista: campo.secreto ? cred.enmascarar(limpio) : limpio,
    });
  }

  if (aGuardar.length === 0) {
    return failure('No escribiste ningún valor nuevo, así que no hay nada que guardar.');
  }

  const { error } = await upsertCredenciales(aGuardar, session.userId);

  if (error) {
    // El mensaje de la base sí se puede enseñar; los valores no llegan hasta aquí.
    return failure(`No se pudo guardar: ${error}`);
  }

  revalidatePath('/configuracion');

  const cuantas = aGuardar.length;
  return success(
    cuantas === 1
      ? 'Credencial guardada y cifrada.'
      : `${cuantas} credenciales guardadas y cifradas.`,
  );
}

export async function revocarCredencial(
  clave: string,
  _previous: ActionResult,
  _formData: FormData,
): Promise<ActionResult> {
  const session = await requireAdmin();

  const demo = bloqueadoEnDemostracion();
  if (demo) return demo;

  if (session.role !== 'superadmin') {
    return failure('Solo un superadministrador puede revocar credenciales.');
  }

  // Solo claves que alguna integración declara. Sin esto, la ruta acepta
  // cualquier cadena y se convierte en un borrado arbitrario de la tabla.
  if (!cred.clavesConocidas().has(clave)) {
    return failure(`«${clave}» no es una credencial de ninguna integración conocida.`);
  }

  const { error } = await deleteCredencial(clave);
  if (error) return failure(`No se pudo revocar: ${error}`);

  revalidatePath('/configuracion');

  return success(
    'Credencial revocada. Si había una variable de entorno con el mismo nombre, vuelve a mandar ella.',
  );
}
