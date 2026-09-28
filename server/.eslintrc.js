module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: 'tsconfig.json',
    tsconfigRootDir: __dirname,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint/eslint-plugin', 'import'],
  extends: [
    'plugin:@typescript-eslint/recommended',
    'plugin:import/recommended',
    "plugin:import/typescript",
  ],
  root: true,
  env: {
    node: true,
    jest: true,
  },
  ignorePatterns: ['.eslintrc.js'],
  rules: {
    '@typescript-eslint/interface-name-prefix': 'off',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
    semi: ['warn', 'always'],
    quotes: ['warn', 'single'],
    'eol-last': ['warn', 'always'],
    'import/order': [
      'warn',
      {
        pathGroups: [
          {
            pattern: 'typeorm/**',
            group: 'external',
            position: 'before',
          },
          {
            pattern: '@nestjs/**',
            group: 'builtin',
            position: 'before',
          },
        ],
        groups: [
          'builtin',
          'external',
          'internal',
          'parent',
          'sibling',
          'index',
        ],
        alphabetize: {
          order: 'asc',
          caseInsensitive: true,
        },
        pathGroupsExcludedImportTypes: [],
        'newlines-between': 'always',
      },
    ],
    'import/newline-after-import': ['warn', { count: 1 }],
    'max-statements-per-line': ['warn', { max: 1 }],
  },
};
