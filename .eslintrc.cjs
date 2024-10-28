module.exports = {
  parserOptions: {
    extraFileExtensions: ['.svelte'],
  },
  extends: ['eslint:recommended', 'plugin:svelte/recommended', 'plugin:storybook/recommended'],
  overrides: [
    {
      files: ['*.svelte'],
      parser: 'svelte-eslint-parser',
      parserOptions: {
        parser: '@typescript-eslint/parser',
      },
    },
  ],
  rules: {},
}
