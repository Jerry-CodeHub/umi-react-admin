# 贡献指南（中文版）

> 英文主文档：[CONTRIBUTING.md](./CONTRIBUTING.md)；本文件为其完整中文副本，两者同步维护。

感谢关注 umi-react-admin！

## 环境准备

- Node.js 24 LTS（见 `.nvmrc`，推荐 nvm / fnm）；最低 22.22.2
- pnpm 11（`packageManager` 字段钉住版本，pnpm 10 与 corepack 会自动切换）；配置在 `pnpm-workspace.yaml`，`.npmrc` 只放鉴权与 registry。从 pnpm 10 首次切换时 node_modules 需重建（非交互终端加 `--config.confirm-modules-purge=false`）

```bash
pnpm install
cp .env.example .env.local   # 按需填写
pnpm start:demo
```

## 开发流程

1. fork 并从 `master` 切出短命特性分支（如 `feat/xxx`、`fix/xxx`）
2. 提交信息使用约定式前缀（`feat:` / `fix:` / `chore:` / `perf:` / `refactor:` / `test:` / `docs:`）——commit-msg 钩子会校验
3. 提交前本地跑 `pnpm check`（typecheck + 严格 lint + vitest）；改动覆盖率选定域内的代码时跑 `pnpm test:coverage`；改动页面时跑 `pnpm e2e:build`（浏览器冒烟）；涉及构建配置时另跑 `pnpm size`（体积预算门禁）
4. 发起 PR，CI 会执行完整质量门禁（typecheck、lint、vitest、覆盖率门禁、构建冒烟、Playwright、产物秘钥扫描与完整性清单往返）

## 约定

- 命名：组件 PascalCase、工具函数 camelCase、组件目录 PascalCase；路由路径小写 kebab-case（改路径时在 `config/routes.ts` 的 `LEGACY_REDIRECTS` 登记旧地址）
- 禁止 `console.log`（warn/error 允许）；强制 `===`；避免显式 `any`
- 界面文案一律走 `src/locales`（中英键集一致，测试把关）；代码里直接写中文会被 `local/no-cjk-literal` 规则拦下（演示数据 `src/demo` 除外）
- 样式：antd token + Tailwind；第三方组件皮肤用按根类名隔离的普通 CSS。不再引入 styled-components / Less / CSS Modules
- 新页面用 `DemoPage` 外壳（说明 + 查看源码），数据走 `src/services` 与演示后端（`src/demo/server/routes.ts`），不要在页面里写死示例数据
- 新增 public 资源需在 [THIRD-PARTY-NOTICES.md](./THIRD-PARTY-NOTICES.zh-CN.md) 登记来源与许可
- 文档双语：`README`、`SECURITY`、`CONTRIBUTING`、`THIRD-PARTY-NOTICES`、`CODE_OF_CONDUCT` 都有一份 `.zh-CN.md` 副本，两者必须**语义完全一致**（Cesium、Tailwind、Vite、AMap、Vercel、Docker、SHA-256、nginx 等技术名词保持英文）。[docs/demo/role-matrix.md](./docs/demo/role-matrix.md) 只有中文，是权限口径的验收基线；`CHANGELOG.md` 是历史记录，不做镜像

## 涉及安全的改动

- **权限点只有一个来源。** 新增权限点要在 `src/constants/permissions.ts` 的 `PERMISSION_TREE` 里登记，并在同一个 PR 内接好：页面用 `config/routes.ts` 的 `access`，按钮用 `src/access.ts`，演示后端路由用 `src/demo/server/routes.ts`，并同步 [docs/demo/role-matrix.md](./docs/demo/role-matrix.md) 的接口 → 权限点对照。角色权限不允许在别处另算一套——矩阵文档逐项复刻 `DEFAULT_ROLE_PERMISSIONS`，必须保持精确一致。
- **绝不把演示模式描述成真实授权。** 浏览器内演示后端演示的是契约；一切校验都在用户自己的浏览器里执行，文档必须始终写明真实后端要自行实现。操作日志、角色分配规则与坐标精度同理。
- **新增构建期凭据。** 要在 `scripts/check-dist-secrets.mjs` 的 `CREDENTIAL_DECLARATIONS` 登记，配一个类型化的 `EXPECTED_*` 声明与形态校验，并在所有注入它的产线里声明（Vercel 环境变量、Cloudflare Pages 环境变量、Docker build-arg、Pages workflow 的扫描步骤）。注入了却没声明会按设计判失败。
- **不得为了合入而放松门禁。** 阈值、白名单、CSP 来源与安全测试都不许放宽；被门禁挡住时请修根因，或在 PR 描述里提出。

## 测试

- 单元测试：`src/**/*.test.ts`（vitest）——演示数据合理性、演示后端接口、请求层、地理计算、导入导出
- 仓库级：`scripts/*.test.ts`——仓库卫生、CSP 与安全响应头在 Vercel / nginx / Cloudflare Pages 三处一致、高德加载器主机固定、路由表（组件存在、旧路径可达、菜单双语）、部署路由闭合失败行为、Dockerfile frontend 固定、完整性清单
- 浏览器：`e2e/`（Playwright，当前按新契约全绿 112 例）——每个页面无异常 / 无 CSP 违规、英文界面无遗漏中文、关键业务流程；`@smoke` 标签的用例在部署后对线上地址再跑一遍
- 无障碍：`e2e/a11y.spec.ts` 从既有传递依赖注入 axe-core（不新增依赖；因为 CSP 没有 `unsafe-inline`，改为同源 URL 注入），共跑 **27 例**，分三组——11 条路由 × 浅色（冷启动）、11 条路由 × realDark（冷启动）、以及 5 条路由（`/login`、`/`、`/ops/devices`、`/ops/alarms`、`/ops/tickets`）× realDark 且经**点击顶栏主题开关**到达。切换组存在的原因：umi 的 `setAntdConfig` 是深合并，而此前浅色与暗色 token 键集不对称，热切换会残留浅色种子值；现在两套键集都是同样的 13 个键，且实测切换路径与冷启动暗色在 17 个 CSS 变量上逐字节一致。命令 `pnpm exec playwright test e2e/a11y.spec.ts --workers=1`；门禁要求**全部用例 critical 与 serious 均为 0**，排除清单为空（没有排除任何规则、没有放宽阈值、没有重新分级）。这不等于「axe 无告警」：moderate / minor 结果照常输出但不作为门禁——ProLayout 头部的 `landmark-no-duplicate-banner`、`landmark-unique`（moderate，每路由 2 个），Calendar 的 `heading-order`（moderate），FullCalendar 内部的 `empty-table-header`（minor ×7），以及切换用例里 antd 在开关 tooltip 打开时创建的空 portal `<div>` 上的 `region`（moderate，仅切换组）。新出现的 critical / serious 一律按回归修复，不允许加进排除清单。
- 覆盖率：`pnpm test:coverage`——百分比统计的是 `vitest.config.ts` 的**选定域**（`src/utils`、`src/services`、`src/demo`、`src/pages/Login`、`src/pages/System/Users`、`src/pages/System/Roles`），不是全项目口径；阈值（statements 60 / branches 50 / functions 60 / lines 60）在 CI 上只对域内生效，不得下调。最终本机数字：54 个文件上 statements 79.38% / branches 74.48% / functions 75.55% / lines 81.51%（644 passed、5 skipped，skip 全部来自 `scripts/real-mode-artifact.test.ts` 的模式分支），同口径全项目 `src/**` 约 statements 47.87%
- Lint：`react-hooks/exhaustive-deps` 已提到 error，未使用 disable 的上报已开启。disable 行必须在本行或上一行写明具体理由；`src/` 内现存 6 处 `exhaustive-deps` disable（`src/hooks/useApi.ts` 与五个 Cesium 场景页的时钟/纯函数 effect），理由均已写在同一行。
