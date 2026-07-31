import globals from 'globals';

export default [
  {
    files: ['**/*.js'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.es2022,
      },
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
  },
];
