import next from 'eslint-config-next';
import prettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

/**
 * ESLint 9 flat config. `eslint-config-next` 16 exports a native flat-config
 * array (core-web-vitals + typescript rules), so no FlatCompat shim is needed.
 * `eslint-config-prettier` is last to disable formatting rules Prettier owns.
 */
const config = [
  ...next,
  prettier,
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { '@typescript-eslint': tseslint.plugin },
    rules: {
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    /**
     * Architecture guardrail: Axios is a client-only transport. It cannot run in
     * edge middleware, and in RSC/route handlers it bypasses Next's fetch cache
     * and the BFF's server-side auth. Restrict it to client components; core/,
     * middleware, and route handlers must use `fetch` / `serverFetch`.
     */
    files: [
      'src/core/**/*.{ts,tsx}',
      'src/middleware.ts',
      'src/app/**/route.ts',
      'src/app/**/layout.tsx',
      'src/app/**/page.tsx',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'axios',
              message:
                'Axios is client-only. Use fetch / serverFetch in server code (core, middleware, route handlers, RSC).',
            },
          ],
        },
      ],
    },
  },
  {
    ignores: ['.next/**', 'node_modules/**', 'build-artifact/**', 'coverage/**', 'next-env.d.ts'],
  },
];

export default config;
