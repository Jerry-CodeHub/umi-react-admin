// stylelint 17。规则集移植自 @umijs/lint 的 stylelint 预设（原经 @umijs/max/stylelint 继承，锁在 stylelint 14）；
// stylelint-config-prettier 不再需要：16 起已移除全部格式类规则
/** @type {import('stylelint').Config} */
export default {
  extends: ['stylelint-config-standard', 'stylelint-config-css-modules'],
  plugins: ['stylelint-declaration-block-no-ignored-properties'],
  rules: {
    'no-descending-specificity': null,
    'function-url-quotes': 'always',
    'selector-attribute-quotes': 'always',
    'font-family-no-missing-generic-family-keyword': null,
    // iconfont
    'plugin/declaration-block-no-ignored-properties': true,
    'unit-no-unknown': [true, { ignoreUnits: ['rpx'] }],
    // webcomponent
    'selector-type-no-unknown': null,
    'value-keyword-case': ['lower', { ignoreProperties: ['composes'] }],
    'selector-class-pattern': [
      '^([a-z][a-z0-9]*(-[a-z0-9]+)*|[a-z][a-zA-Z0-9]+)$',
      { message: 'Expected class selector to be kebab-case or lowerCamelCase' },
    ],
    // 与 less 的 { math: always } 冲突
    'color-function-notation': null,
    // 单独的 PingFangSC 字体多是从 Sketch 无意复制，缺字体的设备会渲染错字体（umijs/umi#11001）
    'declaration-property-value-disallowed-list': [
      { 'font-family': `/^('|")?PingFangSC(-(Regular|Medium|Semibold|Bold))?\\1$/` },
      {
        message:
          'Unexpected value for property "font-family", which will cause some devices to render the wrong font, please delete this "font-family" css rule, see also: https://github.com/umijs/umi/pull/11001',
      },
    ],
    // Tailwind v4 的 CSS 指令（tailwind.css）
    'at-rule-no-unknown': [
      true,
      { ignoreAtRules: ['theme', 'source', 'utility', 'variant', 'custom-variant', 'reference', 'layer', 'apply'] },
    ],
    'function-no-unknown': [true, { ignoreFunctions: ['theme', 'screen'] }],
    // Tailwind v4 只按字符串形式解析 @import（standard 默认要求 url()）
    'import-notation': 'string',
  },
  overrides: [
    {
      files: ['**/*.less'],
      customSyntax: 'postcss-less',
      // umi 构建链内置的 Less 解析不了媒体查询范围语法（(width <= 768px) 报 Missing closing ')'）
      rules: { 'media-feature-range-notation': 'prefix' },
    },
  ],
};
