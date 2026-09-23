# 贡献指南

感谢关注 umi-react-admin！

## 环境准备

- Node.js 24 LTS（见 `.nvmrc`，推荐 nvm / fnm）；最低 22.22.2
- pnpm 10+（`packageManager` 字段钉住版本，corepack 可自动启用）

```bash
pnpm install
cp .env.example .env.local   # 按需填写
pnpm start
```

## 开发流程

1. fork 并从 `master` 切出短命特性分支（如 `feat/xxx`、`fix/xxx`）
2. 提交信息使用约定式前缀（`feat:` / `fix:` / `chore:` / `perf:` / `refactor:` / `test:` / `docs:`）——commit-msg 钩子会校验
3. 提交前本地跑 `pnpm check`（typecheck + 严格 lint + vitest）；涉及构建配置时另跑 `pnpm size`（体积预算门禁）
4. 发起 PR，CI 会执行完整质量门禁（含构建冒烟与产物秘钥扫描）

## 约定

- 命名：组件 PascalCase、工具函数 camelCase、组件目录 PascalCase、样式辅助文件 `Xxx.style.ts`
- 禁止 `console.log`（warn/error 允许）；强制 `===`；避免显式 `any`
- 新增 public 资源需在 [THIRD-PARTY-NOTICES.md](./THIRD-PARTY-NOTICES.md) 登记来源与许可
- 框架层页面（登录/错误页/全局提示）文案走 intl 双语；功能演示页可用中文示例文案

## 测试

- 纯函数与请求层契约测试：`src/**/*.test.ts`（vitest）
- 仓库卫生门禁：`scripts/repo-hygiene.test.ts`
- 覆盖率：`pnpm test:coverage`（起步集见 `vitest.config.ts`）
