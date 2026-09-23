module.exports = {
  extends: require.resolve('@umijs/max/stylelint'),
  // Tailwind v4 的 CSS 指令（tailwind.css）
  rules: {
    'at-rule-no-unknown': [
      true,
      {
        ignoreAtRules: ['theme', 'source', 'utility', 'variant', 'custom-variant', 'reference', 'layer', 'apply'],
      },
    ],
    'function-no-unknown': [
      true,
      {
        ignoreFunctions: ['theme', 'screen'],
      },
    ],
  },
};
