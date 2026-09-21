module.exports = {
  // 负向排除 Umi 生成物，避免误扫；放宽到全部 src，消除 .ts 与 app 级文件的静默 purge 盲区
  content: ['./src/**/*.{ts,tsx}', '!./src/.umi/**', '!./src/.umi-production/**'],
  // preflight 关闭：基础 reset 交给 antd 的 vendor-antd reset 独占，避免压平全局标题样式。
  // 需要 important 覆盖 AntD 的场景请用 ! 前缀按需开启（如 !p-0），不再全局生成 !important。
  corePlugins: {
    preflight: false,
  },
};
