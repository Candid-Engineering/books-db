// @ts-check
import js from '@eslint/js'
import ts from 'typescript-eslint'
import tseslint from 'typescript-eslint'
import svelte from 'eslint-plugin-svelte'
import prettier from 'eslint-config-prettier'
// @ts-expect-error "no types for eslint-plugin-storybook"
import storybook from 'eslint-plugin-storybook'
import globals from 'globals'

export default tseslint.config(
  js.configs.recommended,
  ...ts.configs.recommendedTypeChecked,
  ...svelte.configs['flat/recommended'],
  prettier,
  ...svelte.configs['flat/prettier'],
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
  ...storybook.configs['flat/recommended'],
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
        extraFileExtensions: ['svelte'],
      },
    },
  },
  {
    files: ['**/*.svelte'],
    languageOptions: {
      parserOptions: {
        parser: ts.parser,
      },
    },
  },
  {
    ignores: [
      'build/',
      '.svelte-kit/',
      'dist/',
      'node_modules/',
      'out/',
      '.gitignore',
      'src-ui/stories/',
      'src-ui/lib/generated/',
      '!.storybook',
    ],
  },
  {
    rules: {
      'require-await': 'off',
      '@typescript-eslint/require-await': 'error',
    },
  }
)
