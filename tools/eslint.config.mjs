import base from '@nebula/config/eslint/base';

/**
 * Estas herramientas son scripts de Node que se ejecutan en la terminal, no
 * código de navegador: `console` y `process` son su interfaz, no un descuido.
 * El `base` del proyecto no declara los globales de Node porque el resto del
 * monorepo corre en un Worker o en el navegador.
 */
export default [
  ...base,
  {
    files: ['**/*.mjs'],
    languageOptions: {
      globals: { console: 'readonly', process: 'readonly' },
    },
    rules: { 'no-console': 'off' },
  },
];
