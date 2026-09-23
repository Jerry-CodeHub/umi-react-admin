// ESLint 10 flat config。规则集移植自 @umijs/lint 的 recommended 预设（原 .eslintrc.js 经
// @umijs/max/eslint 继承，锁在 ESLint 8 / typescript-eslint 5），再叠加本项目的覆盖项。
import vitest from '@vitest/eslint-plugin';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/** umi recommended：内置规则 */
const umiCoreRules = {
  // 不需要返回就用 forEach
  'array-callback-return': 'error',
  // eqeq 可能导致潜在的类型转换问题（项目覆盖为 warn，见下）
  eqeqeq: 'error',
  'for-direction': 'error',
  // 不加 hasOwnProperty 判断会多出原型链的内容
  'guard-for-in': 'error',
  'no-async-promise-executor': 'error',
  'no-case-declarations': 'error',
  'no-debugger': 'error',
  'no-delete-var': 'error',
  'no-dupe-else-if': 'error',
  'no-duplicate-case': 'error',
  // eval() 可能导致潜在的安全问题
  'no-eval': 'error',
  'no-ex-assign': 'error',
  // 没必要改 native 变量（umi 预设里的 no-native-reassign 是它的旧名）
  'no-global-assign': 'error',
  'no-invalid-regexp': 'error',
  // 修改对象时，会影响原对象；但是有些场景就是有目的
  'no-param-reassign': 'error',
  // return 值无意义，可能会理解为 resolve
  'no-promise-executor-return': 'error',
  'no-self-assign': 'error',
  'no-self-compare': 'error',
  'no-shadow-restricted-names': 'error',
  'no-sparse-arrays': 'error',
  'no-unsafe-finally': 'error',
  'no-unused-labels': 'error',
  'no-useless-catch': 'error',
  'no-useless-escape': 'error',
  'no-var': 'error',
  'no-with': 'error',
  'require-yield': 'error',
  'use-isnan': 'error',
};

/** umi recommended：React 与 hooks（只开 rules-of-hooks，与原预设一致） */
const umiReactRules = {
  // button 自带 submit 属性
  'react/button-has-type': 'error',
  'react/jsx-key': 'error',
  'react/jsx-no-comment-textnodes': 'error',
  'react/jsx-no-duplicate-props': 'error',
  'react/jsx-no-target-blank': 'error',
  'react/jsx-no-undef': 'error',
  'react/jsx-uses-react': 'error',
  'react/jsx-uses-vars': 'error',
  'react/no-children-prop': 'error',
  'react/no-danger-with-children': 'error',
  'react/no-deprecated': 'error',
  'react/no-direct-mutation-state': 'error',
  'react/no-find-dom-node': 'error',
  'react/no-is-mounted': 'error',
  'react/no-string-refs': 'error',
  'react/no-render-return-value': 'error',
  'react/no-unescaped-entities': 'error',
  'react/no-unknown-property': 'error',
  'react/require-render-return': 'error',
  'react-hooks/rules-of-hooks': 'error',
};

/**
 * umi recommended：TypeScript。typescript-eslint 8 删除了 ban-types、no-empty-interface，
 * 由 no-empty-object-type / no-unsafe-function-type / no-wrapper-object-types 接替。
 */
const umiTypescriptRules = {
  'no-dupe-class-members': 'off',
  'no-invalid-this': 'off',
  'no-loop-func': 'off',
  'no-redeclare': 'off',
  'no-unused-expressions': 'off',
  'no-unused-vars': 'off',
  'no-use-before-define': 'off',
  'no-useless-constructor': 'off',
  '@typescript-eslint/no-confusing-non-null-assertion': 'error',
  '@typescript-eslint/no-dupe-class-members': 'error',
  '@typescript-eslint/no-empty-object-type': 'error',
  '@typescript-eslint/no-invalid-this': 'error',
  '@typescript-eslint/no-loop-func': 'error',
  '@typescript-eslint/no-misused-new': 'error',
  '@typescript-eslint/no-namespace': 'error',
  '@typescript-eslint/no-non-null-asserted-optional-chain': 'error',
  '@typescript-eslint/no-redeclare': 'error',
  '@typescript-eslint/no-this-alias': 'error',
  '@typescript-eslint/no-unsafe-function-type': 'error',
  '@typescript-eslint/no-unused-expressions': 'error',
  '@typescript-eslint/no-unused-vars': 'error',
  '@typescript-eslint/no-use-before-define': 'error',
  '@typescript-eslint/no-useless-constructor': 'error',
  '@typescript-eslint/no-wrapper-object-types': 'error',
  '@typescript-eslint/triple-slash-reference': 'error',
};

/** umi recommended 对测试文件启用的 jest 规则，按 vitest 插件的同名规则移植 */
const umiTestRules = {
  'vitest/no-conditional-expect': 'error',
  'vitest/no-focused-tests': 'error',
  'vitest/no-identical-title': 'error',
  'vitest/no-interpolation-in-snapshots': 'error',
  'vitest/no-mocks-import': 'error',
  'vitest/no-standalone-expect': 'error',
  'vitest/valid-describe-callback': 'error',
  'vitest/valid-expect': 'error',
  'vitest/valid-expect-in-promise': 'error',
  'vitest/valid-title': 'error',
};

export default defineConfig(
  {
    ignores: [
      'public/Cesium/',
      'public/js/',
      'dist/',
      'src/.umi/',
      'src/.umi-production/',
      'coverage/',
      '.claude/',
      '.kilo/',
    ],
  },
  {
    files: ['**/*.{js,jsx,mjs,cjs,ts,tsx}'],
    plugins: { react, 'react-hooks': reactHooks, 'jsx-a11y': jsxA11y },
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser, ...globals.node },
    },
    // React 由 @umijs/max 提供而非项目直接依赖，detect 取不到，显式声明主版本
    settings: { react: { version: '18.3' } },
    linterOptions: { reportUnusedDisableDirectives: 'off' },
    rules: {
      ...umiCoreRules,
      ...umiReactRules,
      // ---- 项目覆盖（原 .eslintrc.js）----
      // 禁止使用 console.log，但允许 warn 和 error
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      // 要求使用 === 和 !==
      eqeqeq: ['warn', 'always'],
      // 禁止在 return、throw、continue 和 break 语句后出现不可达代码
      'no-unreachable': 'warn',
      // a11y 最小集（阶段5）：图片必有 alt、aria 属性合法，不启用大规模规则避免存量误报
      'jsx-a11y/alt-text': 'error',
      'jsx-a11y/aria-props': 'error',
      'jsx-a11y/role-supports-aria-props': 'error',
      'jsx-a11y/anchor-is-valid': 'warn',
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { parser: tseslint.parser },
    plugins: { '@typescript-eslint': tseslint.plugin },
    rules: {
      ...umiTypescriptRules,
      // 禁止未使用的变量（仅警告）
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      // 禁止使用 any 类型（仅警告，避免影响现有代码）
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
  {
    files: ['**/*.{test,spec}.{ts,tsx,js,jsx}'],
    plugins: { vitest },
    rules: umiTestRules,
  },
  {
    // CommonJS 配置文件（.stylelintrc.js 等）
    files: ['**/*.cjs', '.stylelintrc.js'],
    languageOptions: { sourceType: 'commonjs' },
  },
  {
    // 构建与门禁脚本是命令行工具，向终端输出是本职
    files: ['scripts/**/*.{js,mjs,cjs,ts}'],
    rules: { 'no-console': 'off' },
  },
);
