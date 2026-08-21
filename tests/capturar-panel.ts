import { chromium, devices } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';

/**
 * Capturas del panel administrativo y del CMS, en modo demostración.
 *
 * Existe para poder ENSEÑAR el panel. Sin base de datos conectada no hay forma
 * de entrar —no hay a quién autenticar—, así que hasta ahora las dieciocho
 * pantallas construidas no se le podían mostrar a nadie. El modo demostración
 * las hace navegables y esto las deja en imágenes.
 *
 *   pnpm --filter @nebula/tests exec tsx capturar-panel.ts
 *
 * Requiere el panel levantado y SIN Supabase configurado:
 *
 *   NEXT_PUBLIC_SUPABASE_URL= NEXT_PUBLIC_SUPABASE_ANON_KEY= \
 *     pnpm --filter @nebula/admin exec next start --port 4400
 */
const BASE_URL = process.env.PANEL_BASE_URL ?? 'http://127.0.0.1:4400';
const OUT = join(
  dirname(new URL(import.meta.url).pathname),
  '..',
  'docs',
  'previsualizacion',
  'panel',
);

/** Los ids salen de `apps/admin/src/lib/demo-data.ts`, que son deterministas. */
const ID = (sufijo: string) => `00000000-0000-4000-8000-${sufijo.padStart(12, '0')}`;

const TAMANOS = [
  { nombre: 'escritorio', viewport: { width: 1440, height: 900 }, mobile: false },
  { nombre: 'movil', ...devices['Pixel 7'] },
] as const;

const PANTALLAS = [
  { nombre: '01-dashboard', ruta: '/' },
  { nombre: '02-pedidos', ruta: '/pedidos' },
  { nombre: '03-pedido-detalle', ruta: `/pedidos/${ID('o1')}` },
  { nombre: '04-clientes', ruta: '/clientes' },
  { nombre: '05-cliente-detalle', ruta: `/clientes/${ID('u1')}` },
  { nombre: '06-catalogo', ruta: '/catalogo' },
  { nombre: '07-producto-editar', ruta: `/catalogo/${ID('p1')}` },
  { nombre: '08-producto-nuevo', ruta: '/catalogo/nuevo' },
  { nombre: '09-categorias', ruta: '/catalogo/categorias' },
  { nombre: '10-inventario', ruta: '/catalogo/inventario' },
  { nombre: '11-descuentos', ruta: '/descuentos' },
  { nombre: '12-cms-banners', ruta: '/contenido/banners' },
  { nombre: '13-cms-paginas', ruta: '/contenido/paginas' },
  { nombre: '14-cms-pagina-editar', ruta: `/contenido/paginas/${ID('g1')}` },
  { nombre: '15-reportes', ruta: '/reportes' },
  { nombre: '16-usuarios', ruta: '/usuarios' },
  { nombre: '17-integraciones', ruta: '/configuracion' },
  { nombre: '18-acceso', ruta: '/entrar' },
] as const;

async function main() {
  await mkdir(OUT, { recursive: true });

  const browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined,
  });

  let fallos = 0;

  for (const tamano of TAMANOS) {
    const context = await browser.newContext({
      ...tamano,
      locale: 'es-PA',
      deviceScaleFactor: 2,
    });
    const page = await context.newPage();

    for (const pantalla of PANTALLAS) {
      const respuesta = await page.goto(`${BASE_URL}${pantalla.ruta}`, {
        waitUntil: 'networkidle',
      });

      // Una pantalla que responde 500 no puede colarse como captura en blanco:
      // el motivo de que esto exista es que antes TODAS respondían 500.
      const estado = respuesta?.status() ?? 0;
      if (estado !== 200) {
        console.error(`✗ ${pantalla.nombre} · ${tamano.nombre} → HTTP ${estado}`);
        fallos += 1;
        continue;
      }

      await page.waitForTimeout(300);
      await page.screenshot({
        path: join(OUT, `${pantalla.nombre}-${tamano.nombre}.png`),
        fullPage: true,
      });
      console.log(`✓ ${pantalla.nombre} · ${tamano.nombre}`);
    }

    await context.close();
  }

  await browser.close();

  if (fallos > 0) {
    console.error(`\n${fallos} pantallas no se pudieron capturar.`);
    process.exitCode = 1;
    return;
  }

  console.log(`\nCapturas del panel en ${OUT}`);
}

void main();
