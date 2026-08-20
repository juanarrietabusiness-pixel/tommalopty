import base from '@nebula/config/eslint/base';

export default [
  ...base,
  {
    // Los scripts de utilidad de tests informan por consola a propósito: su
    // salida ES el resultado que consume quien los ejecuta.
    files: ['*.ts'],
    rules: { 'no-console': 'off' },
  },
];
