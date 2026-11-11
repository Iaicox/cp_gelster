import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'legacy', 'node_modules', 'data-runtime'] },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
  {
    files: ['server/**/*.ts', 'tests/**/*.ts', '*.{js,ts}'],
    languageOptions: { globals: globals.node },
  },
);
