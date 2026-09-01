import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { clienteYappy, YappyError, type ConfiguracionYappy } from './cliente';

/**
 * El cliente contra un Yappy de mentira que habla como el de verdad.
 *
 * No es una comprobación de que Yappy responda: eso solo lo dice
 * `pnpm yappy:validar` con credenciales reales. Lo que se prueba aquí es lo que
 * sí está bajo nuestro control y se rompe en silencio: que las cabeceras salgan,
 * que el token de la sesión se use en las llamadas siguientes, que el sobre
 * `{ body, status }` se lea bien y que un código de error se convierta en una
 * excepción y no en una lista vacía.
 *
 * Un servidor de verdad y no un `fetch` falseado: así también se prueba que el
 * cuerpo que se envía es JSON válido y que las cabeceras llegan como cabeceras.
 */

interface PeticionVista {
  ruta: string;
  metodo: string;
  cabeceras: Record<string, string | string[] | undefined>;
  cuerpo: unknown;
}

const OK = {
  code: 'YP-0000',
  description: 'Se ha realizado la ejecución del servicio correctamente',
};

let servidor: Server | null = null;

async function levantar(
  responder: (peticion: PeticionVista) => { estado?: number; json: unknown },
): Promise<{ config: ConfiguracionYappy; vistas: PeticionVista[] }> {
  const vistas: PeticionVista[] = [];

  servidor = createServer((req, res) => {
    const trozos: Buffer[] = [];
    req.on('data', (trozo: Buffer) => trozos.push(trozo));
    req.on('end', () => {
      const crudo = Buffer.concat(trozos).toString('utf8');
      const peticion: PeticionVista = {
        ruta: req.url ?? '',
        metodo: req.method ?? '',
        cabeceras: req.headers,
        cuerpo: crudo ? JSON.parse(crudo) : undefined,
      };
      vistas.push(peticion);

      const { estado = 200, json } = responder(peticion);
      res.writeHead(estado, { 'content-type': 'application/json' });
      res.end(JSON.stringify(json));
    });
  });

  await new Promise<void>((listo) => servidor?.listen(0, '127.0.0.1', listo));
  const puerto = (servidor.address() as AddressInfo).port;

  return {
    config: {
      apiUrl: `http://127.0.0.1:${puerto}`,
      apiKey: 'ABCDE-7645X',
      secretKey: 'secreta',
    },
    vistas,
  };
}

afterEach(async () => {
  await new Promise<void>((listo) => (servidor ? servidor.close(() => listo()) : listo()));
  servidor = null;
});

function yappyNormal(peticion: PeticionVista): { estado?: number; json: unknown } {
  if (peticion.ruta === '/v1/session/login') {
    return { json: { body: { token: { token: 'token-de-sesion' }, state: 'OPEN' }, status: OK } };
  }

  if (peticion.ruta === '/v1/movement/history') {
    return {
      json: {
        body: {
          pagination: { has_next_page: false, limit: 10 },
          transactions: [{ id: 'ABCDE-76456', type: 'TXN-COM', role: 'CREDIT' }],
        },
        status: OK,
      },
    };
  }

  if (peticion.ruta === '/v1/collection-method') {
    return {
      json: { body: { collections: [{ alias: 'boton01', type: 'BOTON_DE_PAGO' }] }, status: OK },
    };
  }

  return { json: { status: OK } };
}

describe('clienteYappy', () => {
  it('manda las dos cabeceras de credenciales y el código en el cuerpo', async () => {
    const { config, vistas } = await levantar(yappyNormal);

    await clienteYappy(config).abrirSesion('2025-01-01');

    const login = vistas[0];
    expect(login?.ruta).toBe('/v1/session/login');
    expect(login?.metodo).toBe('POST');
    expect(login?.cabeceras['api-key']).toBe('ABCDE-7645X');
    expect(login?.cabeceras['secret-key']).toBe('secreta');
    expect(login?.cuerpo).toEqual({ body: { code: expect.stringMatching(/^[0-9a-f]{64}$/) } });
  });

  /*
   * El token de la sesión es lo único que se guarda entre llamadas, y olvidarlo
   * no da un error claro: Yappy responde que faltan cabeceras y parece un
   * problema de credenciales.
   */
  it('usa el token de la sesión en las llamadas siguientes', async () => {
    const { config, vistas } = await levantar(yappyNormal);
    const cliente = clienteYappy(config);

    await cliente.abrirSesion('2025-01-01');
    await cliente.metodosDeCobro();

    expect(vistas[1]?.cabeceras.authorization).toBe('Bearer token-de-sesion');
  });

  it('se niega a consultar sin sesión abierta, en vez de mandar una petición inválida', async () => {
    const { config, vistas } = await levantar(yappyNormal);

    await expect(clienteYappy(config).metodosDeCobro()).rejects.toThrow(YappyError);
    expect(vistas).toHaveLength(0);
  });

  it('manda el rango y el límite tal como los pide la especificación', async () => {
    const { config, vistas } = await levantar(yappyNormal);
    const cliente = clienteYappy(config);

    await cliente.abrirSesion('2025-01-01');
    await cliente.historial({
      desde: '2026-08-01',
      hasta: '2026-08-31',
      limite: 10,
      filtros: [{ id: 'COLLECTION_ALIAS', value: 'boton01' }],
    });

    expect(vistas[1]?.cuerpo).toEqual({
      body: {
        pagination: { start_date: '2026-08-01', end_date: '2026-08-31', limit: 10 },
        filter: [{ id: 'COLLECTION_ALIAS', value: 'boton01' }],
      },
    });
  });

  it('convierte un código de error en excepción, con el código dentro del mensaje', async () => {
    const { config } = await levantar((peticion) =>
      peticion.ruta === '/v1/session/login'
        ? { json: { status: { code: 'YP-0006', description: 'Error' } } }
        : yappyNormal(peticion),
    );

    await expect(clienteYappy(config).abrirSesion('2025-01-01')).rejects.toThrow(/YP-0006/);
  });

  /*
   * `YP-0001` es «todo bien, no hay datos». Tratarlo como error haría que una
   * conciliación de un día tranquilo pareciera una integración rota.
   */
  it('trata «sin datos» como una consulta vacía y no como un fallo', async () => {
    const { config } = await levantar((peticion) =>
      peticion.ruta === '/v1/session/login'
        ? yappyNormal(peticion)
        : { json: { status: { code: 'YP-0001', description: 'Sin datos' } } },
    );

    const cliente = clienteYappy(config);
    await cliente.abrirSesion('2025-01-01');

    await expect(cliente.historial({ desde: '2026-08-01', hasta: '2026-08-31' })).resolves.toEqual({
      transacciones: [],
      siguiente: null,
    });
  });

  it('distingue un rechazo de credenciales de un error de la API', async () => {
    const { config } = await levantar(() => ({ estado: 401, json: { message: 'no' } }));

    await expect(clienteYappy(config).abrirSesion('2025-01-01')).rejects.toThrow(/credenciales/i);
  });

  it('dice qué URL falló cuando el host no responde', async () => {
    const cliente = clienteYappy({
      // Puerto cerrado a propósito: es el error de dedo en YAPPY_API_URL.
      apiUrl: 'http://127.0.0.1:1',
      apiKey: 'k',
      secretKey: 's',
    });

    await expect(cliente.abrirSesion('2025-01-01')).rejects.toThrow(/YAPPY_API_URL/);
  });

  it('recorre las páginas hasta que Yappy dice que no hay más', async () => {
    let pagina = 0;

    const { config } = await levantar((peticion) => {
      if (peticion.ruta === '/v1/session/login') return yappyNormal(peticion);

      pagina += 1;
      return {
        json: {
          body: {
            pagination: pagina < 3 ? { has_next_page: true, token: `cursor-${pagina}` } : {},
            transactions: [{ id: `T${pagina}`, type: 'TXN-COM' }],
          },
          status: OK,
        },
      };
    });

    const cliente = clienteYappy(config);
    await cliente.abrirSesion('2025-01-01');

    const todas = await cliente.historialCompleto({ desde: '2026-08-01', hasta: '2026-08-31' });
    expect(todas.map((t) => t.id)).toEqual(['T1', 'T2', 'T3']);
  });

  /*
   * Si Yappy devolviera `has_next_page` para siempre, sin tope esto no
   * terminaría nunca y se llevaría por delante el tiempo de CPU del Worker.
   */
  it('para de paginar al llegar al tope, en vez de girar sin fin', async () => {
    const { config } = await levantar((peticion) =>
      peticion.ruta === '/v1/session/login'
        ? yappyNormal(peticion)
        : {
            json: {
              body: {
                pagination: { has_next_page: true, token: 'siempre-hay-mas' },
                transactions: [{ id: 'T', type: 'TXN-COM' }],
              },
              status: OK,
            },
          },
    );

    const cliente = clienteYappy(config);
    await cliente.abrirSesion('2025-01-01');

    const todas = await cliente.historialCompleto({ desde: '2026-08-01', hasta: '2026-08-31' }, 3);
    expect(todas).toHaveLength(3);
  });

  it('cerrar la sesión no lanza aunque Yappy falle', async () => {
    const { config } = await levantar((peticion) =>
      peticion.ruta === '/v1/session/login'
        ? yappyNormal(peticion)
        : { estado: 500, json: { status: { code: 'YP-9999', description: 'timeout' } } },
    );

    const cliente = clienteYappy(config);
    await cliente.abrirSesion('2025-01-01');

    await expect(cliente.cerrarSesion()).resolves.toBeUndefined();
  });
});
