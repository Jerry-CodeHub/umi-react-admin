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
        // antd5 主题算法（app.tsx 已开 cssVar）注入 :root 的 CSS 变量桥接：
        // 切换暗色时 antd 重算变量，以下 token 类自动跟随，替代硬编码色板
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
