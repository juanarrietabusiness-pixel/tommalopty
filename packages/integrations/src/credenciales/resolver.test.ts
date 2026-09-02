import { describe, expect, it } from 'vitest';
import { cifrar, generarClaveMaestra, importarClaveMaestra } from './cifrado';
import { clavesConValor, resolverCredenciales } from './resolver';

async function guardar(claveMaestra: string, pares: Record<string, string>) {
  const clave = await importarClaveMaestra(claveMaestra);

  return Promise.all(
    Object.entries(pares).map(async ([k, v]) => ({
      clave: k,
      valorCifrado: await cifrar(v, clave),
    })),
  );
}

describe('resolverCredenciales', () => {
  it('descifra lo guardado en la bóveda', async () => {
    const maestra = generarClaveMaestra();
    const guardadas = await guardar(maestra, { YAPPY_SECRET_KEY: 'secreto-de-yappy' });

    const resueltas = await resolverCredenciales({ guardadas, claveMaestra: maestra, entorno: {} });

    expect(resueltas.get('YAPPY_SECRET_KEY')).toBe('secreto-de-yappy');
  });

  it('lee del entorno lo que no esté en la bóveda', async () => {
    const resueltas = await resolverCredenciales({
      guardadas: [],
      entorno: { PAYPAL_CLIENT_ID: 'del-entorno' },
    });

    expect(resueltas.get('PAYPAL_CLIENT_ID')).toBe('del-entorno');
  });

  // Lo que evita el síntoma «cambié la clave en el panel y no pasó nada»: una
  // variable vieja que alguien dejó puesta en el hosting no puede ganar.
  it('la bóveda manda sobre el entorno', async () => {
    const maestra = generarClaveMaestra();
    const guardadas = await guardar(maestra, { YAPPY_SECRET_KEY: 'la-nueva' });

    const resueltas = await resolverCredenciales({
      guardadas,
      claveMaestra: maestra,
      entorno: { YAPPY_SECRET_KEY: 'la-vieja-del-hosting' },
    });

    expect(resueltas.get('YAPPY_SECRET_KEY')).toBe('la-nueva');
  });

  it('una variable de entorno vacía no cuenta como valor', async () => {
    const resueltas = await resolverCredenciales({
      guardadas: [],
      entorno: { RESEND_API_KEY: '', EMAIL_FROM: '   ' },
    });

    expect(resueltas.has('RESEND_API_KEY')).toBe(false);
    expect(resueltas.has('EMAIL_FROM')).toBe(false);
  });

  // Un error de configuración no puede convertirse en una caída de la tienda.
  it('sin clave maestra sigue funcionando con el entorno', async () => {
    const maestra = generarClaveMaestra();
    const guardadas = await guardar(maestra, { YAPPY_SECRET_KEY: 'inalcanzable' });

    const resueltas = await resolverCredenciales({
      guardadas,
      claveMaestra: undefined,
      entorno: { PAYPAL_CLIENT_ID: 'sigo-aqui' },
    });

    expect(resueltas.has('YAPPY_SECRET_KEY')).toBe(false);
    expect(resueltas.get('PAYPAL_CLIENT_ID')).toBe('sigo-aqui');
  });

  it('con la clave maestra equivocada cae al entorno en vez de reventar', async () => {
    const guardadas = await guardar(generarClaveMaestra(), { YAPPY_SECRET_KEY: 'inalcanzable' });

    const resueltas = await resolverCredenciales({
      guardadas,
      claveMaestra: generarClaveMaestra(),
      entorno: { YAPPY_SECRET_KEY: 'la-del-hosting' },
    });

    expect(resueltas.get('YAPPY_SECRET_KEY')).toBe('la-del-hosting');
  });

  it('con la clave maestra ilegible tampoco revienta', async () => {
    const resueltas = await resolverCredenciales({
      guardadas: [{ clave: 'X', valorCifrado: 'v1.a.b' }],
      claveMaestra: 'esto no es una clave',
      entorno: { PAYPAL_CLIENT_ID: 'sigo-aqui' },
    });

    expect(resueltas.get('PAYPAL_CLIENT_ID')).toBe('sigo-aqui');
  });

  // Una credencial rota no puede llevarse por delante a las que sí sirven.
  it('una credencial dañada no impide descifrar las demás', async () => {
    const maestra = generarClaveMaestra();
    const buenas = await guardar(maestra, { BUENA_UNO: 'uno', BUENA_DOS: 'dos' });

    const resueltas = await resolverCredenciales({
      guardadas: [...buenas, { clave: 'ROTA', valorCifrado: 'v1.zzz.zzz' }],
      claveMaestra: maestra,
      entorno: {},
    });

    expect(resueltas.get('BUENA_UNO')).toBe('uno');
    expect(resueltas.get('BUENA_DOS')).toBe('dos');
    expect(resueltas.has('ROTA')).toBe(false);
  });
});

describe('clavesConValor', () => {
  it('cuenta las de la bóveda sin descifrar nada', () => {
    const conValor = clavesConValor([{ clave: 'YAPPY_SECRET_KEY' }], ['YAPPY_SECRET_KEY'], {});
    expect(conValor.has('YAPPY_SECRET_KEY')).toBe(true);
  });

  it('cuenta también las del entorno', () => {
    const conValor = clavesConValor([], ['PAYPAL_CLIENT_ID'], { PAYPAL_CLIENT_ID: 'x' });
    expect(conValor.has('PAYPAL_CLIENT_ID')).toBe(true);
  });

  it('no cuenta una variable de entorno vacía', () => {
    const conValor = clavesConValor([], ['RESEND_API_KEY'], { RESEND_API_KEY: '' });
    expect(conValor.has('RESEND_API_KEY')).toBe(false);
  });

  it('no inventa claves que no se le preguntaron', () => {
    const conValor = clavesConValor([], ['PAYPAL_CLIENT_ID'], { OTRA_COSA: 'x' });
    expect(conValor.has('OTRA_COSA')).toBe(false);
  });
});
