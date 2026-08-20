import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

/**
 * Configuración base de ESLint (flat config) para todo el monorepo.
 * Las apps Next.js extienden esta configuración desde ./next.mjs.
 */
export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/.next/**',
      '**/.turbo/**',
      // Salida del adaptador de Cloudflare: código generado, no se linta.
      '**/.open-next/**',
      '**/.wrangler/**',
      '**/dist/**',
      '**/coverage/**',
      '**/generated/**',
      'docs/design-reference/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      // `consistent-type-imports` no se activa aquí: exige type-aware linting
      // (lento y frágil con el parser de Next) y `verbatimModuleSyntax` del
      // tsconfig ya obliga a usar `import type` en el compilador.
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'smart'],
    },
  },
  prettier,
);
