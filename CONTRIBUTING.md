# 贡献指南

感谢关注 umi-react-admin！

## 环境准备

- Node.js 24 LTS（见 `.nvmrc`，推荐 nvm / fnm）；最低 22.22.2
- pnpm 11（`packageManager` 字段钉住版本，pnpm 10 与 corepack 会自动切换）；配置在 `pnpm-workspace.yaml`，`.npmrc` 只放鉴权与 registry。从 pnpm 10 首次切换时 node_modules 需重建（非交互终端加 `--config.confirm-modules-purge=false`）

```bash
pnpm install
cp .env.example .env.local   # 按需填写
pnpm start
```

## 开发流程

1. fork 并从 `master` 切出短命特性分支（如 `feat/xxx`、`fix/xxx`）
2. 提交信息使用约定式前缀（`feat:` / `fix:` / `chore:` / `perf:` / `refactor:` / `test:` / `docs:`）——commit-msg 钩子会校验
3. 提交前本地跑 `pnpm check`（typecheck + 严格 lint + vitest）；改动页面时跑 `pnpm e2e:build`（浏览器冒烟）；涉及构建配置时另跑 `pnpm size`（体积预算门禁）
4. 发起 PR，CI 会执行完整质量门禁（含构建冒烟、Playwright 与产物秘钥扫描）

## 约定

- 命名：组件 PascalCase、工具函数 camelCase、组件目录 PascalCase；路由路径小写 kebab-case（改路径时在 `config/routes.ts` 的 `LEGACY_REDIRECTS` 登记旧地址）
- 禁止 `console.log`（warn/error 允许）；强制 `===`；避免显式 `any`
- 界面文案一律走 `src/locales`（中英键集一致，测试把关）；代码里直接写中文会被 `local/no-cjk-literal` 规则拦下（演示数据 `src/demo` 除外）
- 样式：antd token + Tailwind；第三方组件皮肤用按根类名隔离的普通 CSS。不再引入 styled-components / Less / CSS Modules
- 新页面用 `DemoPage` 外壳（说明 + 查看源码），数据走 `src/services` 与演示后端（`src/demo/server/routes.ts`），不要在页面里写死示例数据
- 新增 public 资源需在 [THIRD-PARTY-NOTICES.md](./THIRD-PARTY-NOTICES.md) 登记来源与许可

## 测试

- 单元测试：`src/**/*.test.ts`（vitest）——演示数据合理性、演示后端接口、请求层、地理计算、导入导出
- 仓库级：`scripts/*.test.ts`——仓库卫生、CSP 三产线一致、路由表（组件存在、旧路径可达、菜单双语）
- 浏览器：`e2e/`（Playwright）——每个页面无异常 / 无 CSP 违规、英文界面无遗漏中文、关键业务流程；`@smoke` 标签的用例在部署后对线上地址再跑一遍
- 覆盖率：`pnpm test:coverage`（起步集见 `vitest.config.ts`）
