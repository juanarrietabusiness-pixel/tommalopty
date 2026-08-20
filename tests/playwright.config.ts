import { defineConfig, devices } from '@playwright/test';

/**
 * Configuración de los tests end-to-end.
 *
 * Se ejecutan contra la tienda en modo demostración (sin Supabase), lo que
 * permite verificar el flujo de compra completo en CI sin levantar base de
 * datos. Los caminos que sí necesitan datos reales se prueban en los tests de
 * RLS de `packages/db`.
 */
const PORT = Number(process.env.E2E_PORT ?? 4321);
const BASE_URL = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],

  use: {
    baseURL: BASE_URL,
    // Permite apuntar a un Chromium ya instalado (contenedores de CI o sandboxes
    // que lo traen preinstalado). Sin la variable, Playwright usa el suyo.
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
      : {},
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    locale: 'es-PA',
    timezoneId: 'America/Panama',
  },

  // Los tres tamaños que importan: la mayoría del tráfico de e-commerce en
  // Latinoamérica es móvil, así que no es un caso secundario.
  projects: [
    { name: 'escritorio', use: { ...devices['Desktop Chrome'] } },
    { name: 'movil', use: { ...devices['Pixel 7'] } },
    {
      // Tablet sobre Chromium a propósito: el perfil de iPad usa WebKit, que
      // obligaría a instalar un segundo navegador en CI para verificar un
      // layout que ya cubre el breakpoint de 980px.
      name: 'tablet',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 834, height: 1112 },
        isMobile: false,
      },
    },
  ],

  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `pnpm --filter @nebula/storefront exec next start --port ${PORT}`,
        url: BASE_URL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        cwd: '..',
      },
});
