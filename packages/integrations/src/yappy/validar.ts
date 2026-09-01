/**
 * Comprobar credenciales de Yappy sin tocar la tienda.
 *
 *   YAPPY_API_URL=... YAPPY_API_KEY=... YAPPY_API_SECRET_KEY=... \
 *     pnpm --filter @nebula/integrations yappy:validar
 *
 * POR QUÉ EXISTE
 *
 * Toda la integración depende de un hash que se calcula a ciegas: si está mal,
 * Yappy responde «YP-0006, error al procesar los datos» y no dice nada más. Sin
 * una forma de probarlo aparte, ese fallo se descubre dentro del checkout, con
 * un pedido real de por medio, y no hay manera de saber si el problema es la
 * clave, la fecha, el host o la cabecera.
 *
 * Esto hace las tres llamadas en orden y dice cuál fue la primera que falló.
 * Es lo que convierte «no funciona» en «la sesión abre pero el historial da
 * YP-0010», que ya es un problema con arreglo.
 *
 * No escribe nada: solo lee. Se puede ejecutar contra producción sin miedo.
 */

/*
 * Es una herramienta de línea de comandos: su salida ES el resultado, y `warn`
 * o `error` la mandarían a stderr, donde no se lee igual. La regla vale para el
 * código que corre en servidor —ahí un `console.log` es ruido en los registros—
 * y no para esto.
 */
/* eslint-disable no-console */
import { clienteYappy, configuracionDeEntorno, YappyError } from './cliente';
import { fechaEnPanama } from './codigo';

function linea(estado: 'ok' | 'fallo' | 'info', texto: string): void {
  const marca = estado === 'ok' ? '✓' : estado === 'fallo' ? '✗' : '·';
  console.log(`${marca} ${texto}`);
}

/** Nunca imprime una clave entera: los registros de consola se comparten. */
function recortada(valor: string): string {
  return valor.length <= 8 ? '········' : `${valor.slice(0, 4)}…${valor.slice(-2)}`;
}

export async function validar(): Promise<boolean> {
  const config = configuracionDeEntorno();

  if (!config) {
    linea('fallo', 'Faltan credenciales.');
    console.log(
      '\n  Hacen falta las tres, y ninguna puede ir vacía:\n' +
        '    YAPPY_API_URL          host de la API, el que da Yappy al habilitar el comercio\n' +
        '    YAPPY_API_KEY          «API Key» del portal, Integraciones → Generar credenciales\n' +
        '    YAPPY_API_SECRET_KEY   «Secret Key» del mismo sitio\n',
    );
    return false;
  }

  linea('info', `Host: ${config.apiUrl}`);
  linea('info', `API Key: ${recortada(config.apiKey)}`);
  linea('info', `Fecha del hash (huso de Panamá): ${fechaEnPanama()}`);
  console.log('');

  const cliente = clienteYappy(config);

  try {
    await cliente.abrirSesion();
    linea('ok', 'Sesión abierta. El hash, la API Key y la Secret Key son correctos.');
  } catch (error) {
    linea('fallo', `No se pudo abrir la sesión: ${mensaje(error)}`);
    return false;
  }

  try {
    const metodos = await cliente.metodosDeCobro();
    const cobros = metodos?.collections ?? [];

    linea('ok', `Métodos de cobro: ${cobros.length}`);

    // Los alias son lo que hace falta para filtrar el historial más adelante,
    // así que se imprimen: es el dato que habría que ir a buscar al portal.
    for (const cobro of cobros) {
      linea('info', `    ${cobro.alias ?? '(sin alias)'} — ${cobro.type ?? 'tipo desconocido'}`);
    }
  } catch (error) {
    linea('fallo', `La sesión abrió pero los métodos de cobro fallaron: ${mensaje(error)}`);
    await cliente.cerrarSesion();
    return false;
  }

  try {
    // Una semana hacia atrás: suficiente para que un comercio activo tenga
    // algo, y corto para no pedirle a Yappy un histórico entero solo por probar.
    const hasta = fechaEnPanama();
    const desde = fechaEnPanama(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));

    const { transacciones } = await cliente.historial({ desde, hasta, limite: 10 });
    linea('ok', `Historial de ${desde} a ${hasta}: ${transacciones.length} movimientos.`);

    if (transacciones.length === 0) {
      linea('info', 'Sin movimientos en la última semana. No es un fallo: la consulta funcionó.');
    }
  } catch (error) {
    linea('fallo', `La sesión abrió pero el historial falló: ${mensaje(error)}`);
    await cliente.cerrarSesion();
    return false;
  }

  await cliente.cerrarSesion();
  console.log('\nTodo correcto. Estas credenciales sirven para la conciliación.');
  return true;
}

function mensaje(error: unknown): string {
  if (error instanceof YappyError) return error.message;
  return error instanceof Error ? error.message : 'error desconocido';
}

// Se ejecuta solo cuando el archivo es el punto de entrada, no al importarlo:
// así los tests pueden usar `validar()` sin que se dispare sola.
if (process.argv[1]?.includes('validar')) {
  validar()
    .then((correcto) => {
      process.exitCode = correcto ? 0 : 1;
    })
    .catch((error: unknown) => {
      console.error('Fallo inesperado:', error);
      process.exitCode = 1;
    });
}
