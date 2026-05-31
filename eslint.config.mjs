import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { fixupPluginRules } from '@eslint/compat';
import { FlatCompat } from '@eslint/eslintrc';
import js from '@eslint/js';
import typescriptEslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import _import from 'eslint-plugin-import';
import jsxA11Y from 'eslint-plugin-jsx-a11y';
import onlyWarn from 'eslint-plugin-only-warn';
import prettier from 'eslint-plugin-prettier';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import sortKeysFix from 'eslint-plugin-sort-keys-fix';
// import tailwindcss from 'eslint-plugin-tailwindcss'; // Temporarily disabled due to TailwindCSS v4 compatibility
import testingLibrary from 'eslint-plugin-testing-library';
import unusedImports from 'eslint-plugin-unused-imports';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compat = new FlatCompat({
  allConfig: js.configs.all,
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
});

const config = [
  ...compat.extends(
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:typescript-sort-keys/recommended',
    'plugin:playwright/recommended',
    'plugin:react/recommended',
    // 'plugin:tailwindcss/recommended', // Temporarily disabled
    'next/core-web-vitals',
    'next/typescript',
  ),
  {
    files: ['*.ts', '*.tsx'],
    ignores: ['**/node_modules/*', '**/.next/*', '**/.archives/*'],
  },
  {
    languageOptions: {
      ecmaVersion: 5,
      parser: tsParser,
      parserOptions: { project: ['tsconfig.json'], tsconfigRootDir: __dirname },
      sourceType: 'script',
    },
    plugins: {
      '@typescript-eslint': typescriptEslint,
      __import: fixupPluginRules(_import),
      import: _import,
      'jsx-a11y': jsxA11Y,
      'only-warn': onlyWarn,
      'simple-import-sort': simpleImportSort,
      'sort-keys-fix': sortKeysFix,
      // tailwindcss: tailwindcss, // Temporarily disabled
      'testing-library': testingLibrary,
      'unused-imports': unusedImports,
      // eslint-disable-next-line sort-keys-fix/sort-keys-fix
      prettier,
    },
    rules: {
      '@next/next/no-duplicate-head': 'off',
      '@next/next/no-html-link-for-pages': 'off',
      '@next/next/no-img-element': 'off',
      '@typescript-eslint/member-ordering': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn'],
      camelcase: 'off',
      'import/extensions': [
        'error',
        'never',
        {
          css: 'always',
          jpeg: 'always',
          jpg: 'always',
          json: 'always',
          png: 'always',
          svg: 'always',
        },
      ],
      indent: ['off', 2],
      'jsx-quotes': ['warn', 'prefer-double'],
      'new-cap': 'off',
      'no-multiple-empty-lines': ['warn', { max: 1 }],
      'no-unused-vars': 'off',
      'node/no-deprecated-api': 'off',
      'object-curly-spacing': 'off',
      'operator-linebreak': 'off',
      'react/jsx-filename-extension': [
        'error',
        { extensions: ['.jsx', '.tsx'] },
      ],
      'react/jsx-sort-props': ['warn'],
      'react/self-closing-comp': ['warn'],
      'react/sort-comp': ['warn'],
      semi: ['warn', 'always'],
      'simple-import-sort/exports': 'warn',
      'simple-import-sort/imports': 'warn',
      'sort-keys': 'off',
      'sort-keys-fix/sort-keys-fix': 'warn',
      // 'tailwindcss/classnames-order': [
      //   'warn',
      //   { callees: ['cn'], classRegex: '^class(Name)?$' },
      // ], // Temporarily disabled
      'typescript-sort-keys/interface': 'warn',
      'typescript-sort-keys/string-enum': 'warn',
      'unused-imports/no-unused-imports': 'warn',
      'unused-imports/no-unused-vars': [
        'warn',
        {
          args: 'after-used',
          argsIgnorePattern: '^_',
          vars: 'all',
          varsIgnorePattern: '^_',
        },
      ],
    },
    settings: {
      'import/parsers': { '@typescript-eslint/parser': ['.ts', '.tsx'] },
      'import/resolver': {
        typescript: { alwaysTryTypes: true, project: ['tsconfig.json'] },
      },
    },
  },
];

export default config;

// import { dirname } from "path";
// import { fileURLToPath } from "url";
// import { FlatCompat } from "@eslint/eslintrc";

// const __filename = fileURLToPath(import.meta.url);
// const __dirname = dirname(__filename);

// const compat = new FlatCompat({
//   baseDirectory: __dirname,
// });

// const eslintConfig = [
//   ...compat.extends("next/core-web-vitals", "next/typescript"),
// ];

// export default eslintConfig;
