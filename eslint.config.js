const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: {
        ...globals.node,
        ...globals.es2021,
      },
    },
    rules: {
      'no-unused-vars': 'warn',
      'no-console': 'off',
    },
    ignores: ['node_modules/', 'dist/', 'build/'],
  },
  {
    files: ['layer-7-presentation/dashboard/**/*.{js,jsx,ts,tsx}'],
    languageOptions: {
      sourceType: 'module',
      ecmaVersion: 2022,
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
  },
];
