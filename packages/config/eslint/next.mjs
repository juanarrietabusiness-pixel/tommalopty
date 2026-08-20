import base from './base.mjs';

/**
 * Configuración para las apps Next.js.
 *
 * `eslint-config-next` todavía se distribuye como config "eslintrc"; se carga con
 * FlatCompat en el eslint.config.mjs de cada app para no acoplar este paquete a la
 * resolución de rutas de cada workspace.
 */
export default [
  ...base,
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      // En Server Components de Next las funciones async son habituales dentro de JSX.
      '@typescript-eslint/no-misused-promises': 'off',
    },
  },
];
