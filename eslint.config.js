// One ESLint config for the whole workspace. The rules below enforce the boundaries in CLAUDE.md;
// apps/web/lint/rules.test.ts and apps/api/test/boundaries.test.ts check that they still fire.
import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// ING-1: only the worker calls upstream.
const ONLY_WORKER = 'Only apps/worker calls upstream sources. The API reads our database (ING-1).';
const NETWORK_MODULES = ['node:http', 'node:https', 'http', 'https', 'node:net', 'undici', 'node-fetch', 'axios', 'got'];

// FND-6: apps/api and apps/worker never import each other.
const NOT_WORKER = { group: ['@parking/worker', '@parking/worker/**', '**/worker/src/**'], message: 'apps/api never imports apps/worker. Shared code goes in packages/ (FND-6).' };
const NOT_API = { group: ['@parking/api', '@parking/api/**', '**/api/src/**'], message: 'apps/worker never imports apps/api. Shared code goes in packages/ (FND-6).' };

// WEB-1: text people see or hear comes from the message catalog.
const VISIBLE_TEXT_PROPS = '/^(alt|title|placeholder|label|aria-label|aria-description|aria-placeholder|aria-roledescription|aria-valuetext)$/';
const FROM_CATALOG = 'Text people see comes from the message catalog, through react-intl (WEB-1).';
const visibleTextRules = [
  // An empty string isn't text: alt="" marks an image as decorative.
  { selector: `JSXAttribute[name.name=${VISIBLE_TEXT_PROPS}] > Literal[value!='']`, message: FROM_CATALOG },
  { selector: `JSXAttribute[name.name=${VISIBLE_TEXT_PROPS}] > JSXExpressionContainer > Literal[value!='']`, message: FROM_CATALOG },
  { selector: `JSXAttribute[name.name=${VISIBLE_TEXT_PROPS}] > JSXExpressionContainer > TemplateLiteral`, message: FROM_CATALOG },
];

// WEB-3: components → hooks → services → packages/api-client. Only services call the network.
const ONLY_SERVICES = 'Only src/services calls the API. Use a hook that calls a service (WEB-3).';
const API_CLIENT = [
  { name: '@parking/api-client', message: ONLY_SERVICES, allowTypeImports: true },
  { name: 'openapi-fetch', message: ONLY_SERVICES },
];

export default defineConfig(
  { ignores: ['**/node_modules/', '**/dist/', '**/coverage/', 'packages/api-client/src/generated/'] },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    files: ['**/*.{js,mjs,ts,tsx}'],
    languageOptions: { globals: globals.node },
    rules: {
      // Handlers and overrides keep the parameters of the signature they implement.
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      // `declare global { namespace … }` is how libraries such as react-intl take type augmentations.
      '@typescript-eslint/no-namespace': ['error', { allowDeclarations: true }],
    },
  },
  {
    files: ['apps/api/src/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        { paths: NETWORK_MODULES.map((name) => ({ name, message: ONLY_WORKER })), patterns: [NOT_WORKER] },
      ],
      'no-restricted-globals': ['error', { name: 'fetch', message: ONLY_WORKER }],
      'no-restricted-properties': ['error', { object: 'globalThis', property: 'fetch', message: ONLY_WORKER }],
    },
  },
  {
    files: ['apps/api/test/**/*.ts'],
    rules: { 'no-restricted-imports': ['error', { patterns: [NOT_WORKER] }] },
  },
  {
    files: ['apps/worker/**/*.ts'],
    rules: { 'no-restricted-imports': ['error', { patterns: [NOT_API] }] },
  },
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
  {
    files: ['apps/web/src/**/*.tsx'],
    ...jsxA11y.flatConfigs.recommended,
  },
  {
    files: ['apps/web/src/**/*.{ts,tsx}'],
    ignores: ['apps/web/src/**/*.test.{ts,tsx}', 'apps/web/src/test/**'],
    plugins: { react },
    settings: { react: { version: '19' } },
    rules: {
      'react/jsx-no-literals': ['error', { noStrings: true, ignoreProps: true, allowedStrings: [] }],
      'no-restricted-syntax': ['error', ...visibleTextRules],
      'no-restricted-imports': ['error', { paths: API_CLIENT }],
      'no-restricted-globals': ['error', { name: 'fetch', message: ONLY_SERVICES }],
      'no-restricted-properties': [
        'error',
        { object: 'window', property: 'fetch', message: ONLY_SERVICES },
        { object: 'globalThis', property: 'fetch', message: ONLY_SERVICES },
      ],
    },
  },
  {
    files: ['apps/web/src/services/**/*.ts'],
    ignores: ['apps/web/src/**/*.test.ts'],
    rules: {
      'no-restricted-imports': 'off',
      'no-restricted-globals': 'off',
      'no-restricted-properties': 'off',
    },
  },
);
