import {
  defineConfig,
  globalIgnores,
} from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
 
const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      semi: ['warn', 'always'],
      quotes: ['warn', 'single'],
      'eol-last': ['warn', 'always'],
      'import/order': [
        'warn',
        {
          pathGroups: [
            {
              pattern: '@/**',
              group: 'external',
              position: 'after',
            },
            {
              pattern: 'lucide-react|next/**',
              group: 'external',
              position: 'before',
            },
            {
              pattern: 'react',
              group: 'builtin',
              position: 'before',
            },
            {
              pattern: '@/components/shadcn/**',
              group: 'internal',
              position: 'before',
            },
          ],
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
          alphabetize: {
            order: 'asc',
            caseInsensitive: true,
          },
          pathGroupsExcludedImportTypes: [],
          'newlines-between': 'always',
        },
      ],
      'import/newline-after-import': [
        'warn',
        {
          count: 1,
        },
      ],
      'object-curly-newline': [
        'warn',
        {
          minProperties: 1,
        },
      ],
      indent: ['warn', 2],
      'max-statements-per-line': [
        'warn',
        {
          max: 1,
        },
      ],
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    // Ignore some scripts and files that uses `require` instead of `import`.
    'tailwind.config.ts',
    'scripts/**',
  ]),
]);
 
export default eslintConfig;
