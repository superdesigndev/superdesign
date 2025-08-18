import typescriptEslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import unusedImports from 'eslint-plugin-unused-imports';
import prettierConfig from 'eslint-config-prettier';

export default [
    // Global ignores
    {
        ignores: [
            '**/node_modules/**',
            '**/dist/**',
            '**/out/**',
            '**/coverage/**',
            '**/*.d.ts',
            '**/esbuild.js',
        ],
    },

    // TypeScript files configuration
    {
        files: ['**/*.ts', '**/*.tsx'],
        plugins: {
            '@typescript-eslint': typescriptEslint,
            'unused-imports': unusedImports,
        },
        languageOptions: {
            parser: tsParser,
            ecmaVersion: 2022,
            sourceType: 'module',
            parserOptions: {
                project: './tsconfig.json',
                tsconfigRootDir: import.meta.dirname,
                ecmaFeatures: {
                    jsx: true,
                },
            },
        },
        rules: {
            // TypeScript-specific rules
            ...typescriptEslint.configs.recommended.rules,
            ...typescriptEslint.configs['recommended-type-checked'].rules,

            // Enhanced naming conventions
            '@typescript-eslint/naming-convention': [
                'error',
                {
                    selector: 'variableLike',
                    format: ['camelCase', 'UPPER_CASE', 'PascalCase'],
                    leadingUnderscore: 'allow',
                },
                {
                    selector: 'typeLike',
                    format: ['PascalCase'],
                },
                {
                    selector: 'interface',
                    format: ['PascalCase'],
                    custom: {
                        regex: '^I[A-Z]',
                        match: false,
                    },
                },
                {
                    selector: 'enumMember',
                    format: ['PascalCase', 'UPPER_CASE'],
                },
                {
                    selector: 'function',
                    format: ['camelCase', 'PascalCase'],
                },
            ],

            // Type safety
            '@typescript-eslint/no-explicit-any': 'error',
            '@typescript-eslint/no-non-null-assertion': 'error',
            '@typescript-eslint/prefer-nullish-coalescing': 'error',
            '@typescript-eslint/prefer-optional-chain': 'error',
            '@typescript-eslint/strict-boolean-expressions': 'error',
            '@typescript-eslint/switch-exhaustiveness-check': 'error',

            // Code quality - use unused-imports instead of @typescript-eslint/no-unused-vars
            '@typescript-eslint/no-unused-vars': 'off',
            'unused-imports/no-unused-imports': 'error',
            'unused-imports/no-unused-vars': [
                'error',
                {
                    vars: 'all',
                    varsIgnorePattern: '^_',
                    args: 'after-used',
                    argsIgnorePattern: '^_',
                },
            ],
            '@typescript-eslint/no-floating-promises': 'error',
            '@typescript-eslint/require-await': 'error',
            '@typescript-eslint/await-thenable': 'error',
            '@typescript-eslint/no-misused-promises': 'error',

            // Performance and best practices
            '@typescript-eslint/prefer-readonly': 'error',
            '@typescript-eslint/prefer-for-of': 'error',
            '@typescript-eslint/prefer-includes': 'error',
            '@typescript-eslint/prefer-string-starts-ends-with': 'error',

            // Consistency
            '@typescript-eslint/consistent-type-definitions': ['error', 'interface'],
            '@typescript-eslint/consistent-type-imports': [
                'error',
                {
                    prefer: 'type-imports',
                },
            ],
            '@typescript-eslint/member-ordering': 'error',

            // JavaScript base rules (enhanced) - Prettier handles formatting
            curly: ['error', 'all'],
            eqeqeq: ['error', 'always'],
            'no-throw-literal': 'error',

            // Code quality rules
            'no-console': ['warn', { allow: ['warn', 'error'] }],
            'no-debugger': 'error',
            'no-duplicate-imports': 'error',
            'no-eval': 'error',
            'no-implied-eval': 'error',
            'no-new-func': 'error',
            'no-var': 'error',
            'prefer-const': 'error',
            'prefer-template': 'error',

            // Error prevention
            'no-unreachable': 'error',
            'no-unused-expressions': 'error',
            'no-useless-constructor': 'error',
            'no-useless-return': 'error',
            'no-unused-private-class-members': 'error',
            'require-atomic-updates': 'error',

            // VS Code extension specific
            'no-restricted-globals': ['error', 'window', 'document'],
            'no-restricted-syntax': [
                'error',
                {
                    selector: "CallExpression[callee.name='require']",
                    message: 'Use ES6 imports instead of require()',
                },
            ],
        },
    },

    // JavaScript files (if any)
    {
        files: ['**/*.js', '**/*.mjs'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
        },
        rules: {
            curly: ['error', 'all'],
            eqeqeq: ['error', 'always'],
            'no-throw-literal': 'error',
            semi: ['error', 'always'],
            'no-var': 'error',
            'prefer-const': 'error',
        },
    },

    // React/JSX files in webview
    {
        files: ['**/webview/**/*.tsx', '**/webview/**/*.jsx'],
        plugins: {
            '@typescript-eslint': typescriptEslint,
            react: react,
            'react-hooks': reactHooks,
            'jsx-a11y': jsxA11y,
            'unused-imports': unusedImports,
        },
        languageOptions: {
            parser: tsParser,
            ecmaVersion: 2022,
            sourceType: 'module',
            parserOptions: {
                project: './tsconfig.json',
                tsconfigRootDir: import.meta.dirname,
                ecmaFeatures: {
                    jsx: true,
                },
            },
        },
        settings: {
            react: {
                version: 'detect',
            },
        },
        rules: {
            // Include base TypeScript rules
            ...typescriptEslint.configs.recommended.rules,
            ...typescriptEslint.configs['recommended-type-checked'].rules,

            // React specific rules
            ...react.configs.recommended.rules,
            ...react.configs['jsx-runtime'].rules,
            ...reactHooks.configs.recommended.rules,

            // Accessibility rules
            'jsx-a11y/alt-text': 'error',
            'jsx-a11y/aria-props': 'error',
            'jsx-a11y/aria-proptypes': 'error',
            'jsx-a11y/aria-unsupported-elements': 'error',
            'jsx-a11y/role-has-required-aria-props': 'error',
            'jsx-a11y/role-supports-aria-props': 'error',

            // React performance
            'react/jsx-key': 'error',
            'react/no-array-index-key': 'warn',
            'react/no-unused-prop-types': 'error',
            'react/no-unused-state': 'error',
            'react/prefer-stateless-function': 'warn',

            // React consistency
            'react/jsx-boolean-value': ['error', 'never'],
            'react/jsx-curly-brace-presence': ['error', { props: 'never', children: 'never' }],
            'react/jsx-pascal-case': 'error',
            'react/self-closing-comp': 'error',

            // Hooks rules
            'react-hooks/rules-of-hooks': 'error',
            'react-hooks/exhaustive-deps': 'error',

            // Unused imports for React files
            '@typescript-eslint/no-unused-vars': 'off',
            'unused-imports/no-unused-imports': 'error',
            'unused-imports/no-unused-vars': [
                'error',
                {
                    vars: 'all',
                    varsIgnorePattern: '^_',
                    args: 'after-used',
                    argsIgnorePattern: '^_',
                },
            ],

            // Relaxed rules for React components
            '@typescript-eslint/no-explicit-any': 'warn',
            '@typescript-eslint/strict-boolean-expressions': 'warn',
            'no-restricted-globals': 'off', // React needs window, document
        },
    },

    // Test files - more lenient rules
    {
        files: ['**/*.test.ts', '**/test/**/*.ts', '**/*.spec.ts'],
        rules: {
            '@typescript-eslint/no-explicit-any': 'warn',
            '@typescript-eslint/no-non-null-assertion': 'warn',
            '@typescript-eslint/strict-boolean-expressions': 'off',
            'no-console': 'off',
        },
    },
    {
        files: ['src/tools/*.ts'],
        rules: {
            '@typescript-eslint/naming-convention': 'off',
            '@typescript-eslint/require-await': 'off',
        },
    },
    // Gradual migration - temporary overrides
    {
        files: ['src/**/*.ts', 'src/**/*.tsx'],
        rules: {
            // Reduce severity during migration
            '@typescript-eslint/member-ordering': 'warn',
            '@typescript-eslint/no-explicit-any': 'warn',
            '@typescript-eslint/no-non-null-assertion': 'warn',
            '@typescript-eslint/no-unsafe-argument': 'warn',
            '@typescript-eslint/no-unsafe-assignment': 'warn',
            '@typescript-eslint/no-unsafe-call': 'warn',
            '@typescript-eslint/no-unsafe-member-access': 'warn',
            '@typescript-eslint/no-unsafe-return': 'warn',
            '@typescript-eslint/no-unused-vars': 'off',
            'unused-imports/no-unused-imports': 'error',
            'unused-imports/no-unused-vars': [
                'error',
                {
                    vars: 'all',
                    varsIgnorePattern: '^_',
                    args: 'after-used',
                    argsIgnorePattern: '^_',
                },
            ],
            '@typescript-eslint/prefer-nullish-coalescing': 'error',
            '@typescript-eslint/restrict-template-expressions': 'warn',
            '@typescript-eslint/strict-boolean-expressions': 'warn',
            '@typescript-eslint/switch-exhaustiveness-check': 'error',
            'no-restricted-globals': 'warn',
            'prefer-template': 'warn',
        },
    },

    // Prettier integration - disable conflicting formatting rules
    prettierConfig,
];
