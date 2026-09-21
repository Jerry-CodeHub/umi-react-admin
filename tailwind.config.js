module.exports = {
  // 负向排除 Umi 生成物，避免误扫；放宽到全部 src，消除 .ts 与 app 级文件的静默 purge 盲区
  content: ['./src/**/*.{ts,tsx}', '!./src/.umi/**', '!./src/.umi-production/**'],
  // preflight 关闭：基础 reset 交给 antd 的 vendor-antd reset 独占，避免压平全局标题样式。
  // 需要 important 覆盖 AntD 的场景请用 ! 前缀按需开启（如 !p-0），不再全局生成 !important。
  corePlugins: {
    preflight: false,
  },
  // D3 等代码里以字符串字面量出现的词会被误判为类名（曾产出 .visible/.table 等死规则），直接拦截
  blocklist: ['visible', 'table', 'italic', 'outline', 'resize'],
  theme: {
    extend: {
      colors: {
        // antd5 CSS 变量桥接（app.tsx 已开 cssVar）：变量不在 :root 上，而是挂在 antd 组件根的
        // .css-var-* 作用域内（umi 用 antd <App> 包裹整个应用，其容器也带该类，弹层根节点各自带）。
        // 所以这些 token 类只在 antd 组件树内生效；切换暗色时 antd 重算变量，token 类自动跟随
        text: 'var(--ant-color-text)',
        'text-tertiary': 'var(--ant-color-text-tertiary)',
        'fill-tertiary': 'var(--ant-color-fill-tertiary)',
        success: 'var(--ant-color-success)',
        warning: 'var(--ant-color-warning)',
        error: 'var(--ant-color-error)',
        'bg-container': 'var(--ant-color-bg-container)',
        'bg-layout': 'var(--ant-color-bg-layout)',
      },
    },
  },
};
