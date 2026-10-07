# CLAUDE.md - umi-react-admin 项目指南

这是 Claude Code 在处理此项目时的上下文文档。

## 项目概述

umi-react-admin 是一个基于 Umi Max 的企业级 React 后台管理系统模板，包含丰富的功能组件展示，如日历、富文本编辑、地图（Cesium/高德/OpenLayers）、播放器、签名等。

## 技术栈

- **框架**: Umi Max 4.x + React 19（项目直接依赖，umi 别名到它）+ TypeScript 6
- **UI**: Ant Design 5 + Ant Design Pro Components
- **样式**: Tailwind CSS 4（CSS 优先配置，工具类不分层，见 tailwind.css 头注释）+ Less
- **状态管理**: Umi initialState（全局用户与主题）+ 组件内 state（未启用 valtio）
- **地图**: Cesium.js、OpenLayers 9、高德地图
- **图表**: Ant Design Charts (plots)、D3.js
- **包管理器**: pnpm

## 常用命令

```bash
pnpm install          # 安装依赖
pnpm start            # 启动开发服务器 (端口 8000)
pnpm build            # 生产构建
pnpm build:github     # GitHub Pages 构建
pnpm preview          # 构建并预览 (端口 8001)
pnpm check            # typecheck + 严格 lint + vitest（提交前必跑）
pnpm test             # vitest 单测（test:watch 监听 / test:coverage 覆盖率）
pnpm e2e              # Playwright 冒烟（先 build:github；e2e:build 一步完成）
pnpm size             # 构建并执行体积预算门禁（size-budget.json）
pnpm analyze          # 构建并生成 bundle 组成分析
pnpm format           # Prettier 格式化代码
```

## 项目结构

```
src/
├── pages/            # 页面（Dashboard / System / Ops / Map / Components / Media / Document / Exception）
├── components/       # DemoPage 外壳、ChartCard、CesiumViewer（useCesiumViewer）、GuideTour、ErrorBoundary
├── demo/             # 浏览器内演示后端：generate（数据）、store（补丁持久化）、server（路由）、adapter
├── services/         # 接口调用；types.ts 是前后端契约
├── hooks/            # useApi / useChartTheme / useEnums / useThemeMode / useResponsiveTable
├── locales/          # zh-CN / en-US，按领域拆分到同名目录
├── constants/        # 枚举顺序、语义色、权限点树
├── utils/            # 请求层、i18n 兜底、格式化、MapCompute（geodesy / geoHash / turf 合并）
├── app.tsx           # 运行时配置（布局、路由守卫、未授权回退、页脚、导览）
└── access.ts         # 权限定义

config/
├── config.ts / config.github.ts   # 主产线与 GitHub Pages 产线
├── routes.ts         # 路由 + LEGACY_REDIRECTS（旧路径重定向）
├── csp.ts            # CSP 单一来源（vercel.json、nginx 副本由测试比对）
├── splitChunks.ts    # 分包（vendor-pro 异步，入口不背 pro-components）
└── buildInfo.ts      # 构建信息与 dist/version.json
```

## 代码规范

### 格式化 (Prettier)

- 行宽: 120 字符
- 单引号
- 尾逗号: always
- 自动排序导入

### ESLint 规则

- 禁止 `console.log` (允许 warn/error)
- 未使用变量警告 (`_` 前缀可忽略)
- 强制使用 `===` 和 `!==`
- 禁止显式 `any` (警告)

### 命名规范

- React 组件: PascalCase (`Home.tsx`)
- 工具函数: camelCase (`format.ts`)
- 组件目录: PascalCase (`FullCalendar/index.tsx`)
- 路由路径: 小写 kebab-case；改路径在 `LEGACY_REDIRECTS` 登记旧地址
- 样式: antd token + Tailwind；第三方组件皮肤用根类名隔离的普通 CSS（已不再使用 styled-components / Less）

## Git 工作流

- **pre-commit**: 自动运行 lint-staged (ESLint + Prettier)
- **commit-msg**: 验证 commit 消息格式 (`max verify-commit`)

## 关键配置文件

- [config/config.ts](config/config.ts) - Umi 构建配置
- [config/routes.ts](config/routes.ts) - 路由配置
- [tailwind.css](tailwind.css) - Tailwind CSS 配置（v4 无 JS 配置文件）
- [.prettierrc](.prettierrc) - Prettier 配置
- [eslint.config.mjs](eslint.config.mjs) - ESLint 10 flat config（移植自 umi lint 预设）
- [stylelint.config.mjs](stylelint.config.mjs) - stylelint 17 配置

## 特殊说明

### Cesium 地图

- 需要设置环境变量 `CESIUM_ION_TOKEN`
- Cesium 资源在构建时自动复制到 dist/Cesium/
- 全局变量 `CESIUM_BASE_URL` 指向 `/Cesium`
- 新页面用 `@/components/CesiumViewer` 的 `useCesiumViewer` + `CesiumStage`（创建、错误态、销毁、瓦片失败的未处理拒绝都在里面）；不要隐藏 credit 署名区（ion 条款要求）
- http 页面（本地 E2E、Docker 经 http 访问）上 Bing 兜底影像瓦片也走 http，会被 CSP 拦；https 部署不受影响

### 易踩坑（均有真实事故）

- **演示后端（src/demo）**：未配 `UMI_APP_API_BASE` 时所有接口经请求层 axios adapter 交给浏览器内的演示后端，dev 与静态部署同一套实现（umi mock 已关闭、`mock/` 目录已删除）。不用 Service Worker：http 内网访问的 Docker 部署也要能用。验证纯静态行为用 `node scripts/serve-dist.mjs`，不要用 `max preview`
- **演示数据改规则要升版本**：生成规则或数据结构变化时把 `src/demo/store.ts` 的 `STORE_VERSION` 加一，否则老访客的补丁会叠在新数据上；数据合理性由 `src/demo/generate.test.ts` 断言，改完先跑它
- **polyfill 只引 `core-js/stable`**（config.ts `polyfill.imports`）：默认的 esnext 提案 polyfill 会强制覆盖原生实现（曾导致 pdfjs 报 onPull 错误）
- **public 资源路径一律经 `PUBLIC_PATH` 拼接**：GitHub Pages 部署在 `/umi-react-admin/` 子路径
- **业务数据只由 `src/demo/generate.ts` 以固定种子生成**，不要在页面里写死示例数据，也不要引入来源不明的第三方数据
- **pages 下不要有名为 `model.ts(x)` 的文件**：umi model 插件会把它当数据模型加载（macOS 大小写不敏感时 `Model.tsx` 同样中招，dev 编译失败）
- **登录后跳转要等登录态提交**：在 `setInitialState` 之后立即 `history.push` 会被路由守卫弹回登录页（登录页用 effect 监听 `initialState.name` 再跳）
- **html2canvas 1.x 解析不了 `oklch()`**：Tailwind 4 调色板是 oklch，被截图区域不要用 Tailwind 颜色工具类或任意 `[#hex]` 颜色类（后者体积门禁也识别不了），改用 style 或 antd token
- **入口体积预算 700KB gzip**（size-budget.json）：新增全局依赖前先 `pnpm size`
- **FullCalendar v7 在 render 阶段就发起事件拉取**：页面挂载后再渲染日历（Calendar 页的 `mounted` 开关），否则被 React 丢弃的那次渲染在拉取完成时回写状态，dev 报 "hasn't mounted yet"
- **看板拖拽用 Mouse + Touch（长按）+ Keyboard 传感器**：PointerSensor 在触屏上会被浏览器滚动手势抢走；单击 / 回车留给详情抽屉
- **列表页表格用 `useResponsiveTable`**：`scroll.x` 取 max-content、固定列只在 md 以上生效；不要再写死 `scroll={{ x: 1300 }}`（宽屏上列会被固定操作列盖住，手机上数据列被挤没）
- **产物秘钥扫描不能用固定 grep**：Cesium 的 `Ion.js` 自带公开的默认 ion token（HS256 JWT），打包后必然进产物；CI 用 `scripts/check-dist-secrets.mjs`（白名单从 Ion.js 动态读取，只输出指纹）

### 国际化

- 默认语言: zh-CN；首次访问按浏览器语言选择
- 菜单项键名: `menu.<父级>.<name>`（路由表测试校验双语齐全）
- 组件内用 `useIntl()`；组件外（请求层、错误边界）用 `@/utils/i18n` 的 `t()`
- 代码里直接写中文会被 ESLint `local/no-cjk-literal` 拦下（`src/demo`、locales、测试除外）；英文界面无遗漏由 e2e 断言
- 文案按 ICU 语法解析：不要在文案里直接写 `{a.b}`、`<Tag>` 这类代码片段（解析失败会回退成原文并报错），用 `{code}` 占位符传入（`locales.test.ts` 把关）

### 权限控制

- 在 `src/access.ts` 定义权限
- 使用 `useAccess()` hook 获取权限
- 路由中通过 `access` 属性控制访问

## 部署

- **GitHub Pages**: `pnpm build:github` + GitHub Actions（部署前复制 404.html 做 SPA 回退；部署后等 `version.json` 切到本次提交再跑 `@smoke` e2e；部署提交用 github-actions[bot] 身份）
- **Docker**: 根目录 Dockerfile + `nginx/`（仅带哈希文件长缓存，.mjs 需显式声明类型）
- **Vercel**: 支持自动部署 (vercel.json，含 SPA rewrite)
