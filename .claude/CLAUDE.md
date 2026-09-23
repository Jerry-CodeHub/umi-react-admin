# CLAUDE.md - umi-react-admin 项目指南

这是 Claude Code 在处理此项目时的上下文文档。

## 项目概述

umi-react-admin 是一个基于 Umi Max 的企业级 React 后台管理系统模板，包含丰富的功能组件展示，如日历、富文本编辑、地图（Cesium/高德/OpenLayers）、播放器、签名等。

## 技术栈

- **框架**: Umi Max 4.x + React 18 + TypeScript 5.x
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
pnpm size             # 构建并执行体积预算门禁（size-budget.json）
pnpm analyze          # 构建并生成 bundle 组成分析
pnpm format           # Prettier 格式化代码
```

## 项目结构

```
src/
├── pages/            # 页面组件（路由对应）
├── components/       # 可复用组件（ErrorBoundary、CesiumViewer）
├── layouts/          # 布局组件
├── services/         # API 服务层（auth + demo 数据层，模式判定见 services/demo/mode.ts）
├── utils/            # 工具函数
├── locales/          # 国际化文件 (zh-CN, en-US)
├── constants/        # 常量定义
├── app.tsx           # 应用运行时配置
└── access.ts         # 权限定义

config/
├── config.ts         # Umi 主配置
├── config.github.ts  # GitHub Pages 配置
└── routes.ts         # 路由配置
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
- 样式辅助文件: Xxx.style.ts（styled-components 样式常量）

## Git 工作流

- **pre-commit**: 自动运行 lint-staged (ESLint + Prettier)
- **commit-msg**: 验证 commit 消息格式 (`max verify-commit`)

## 关键配置文件

- [config/config.ts](config/config.ts) - Umi 构建配置
- [config/routes.ts](config/routes.ts) - 路由配置
- [tailwind.css](tailwind.css) - Tailwind CSS 配置（v4 无 JS 配置文件）
- [.prettierrc](.prettierrc) - Prettier 配置
- [.eslintrc.js](.eslintrc.js) - ESLint 配置

## 特殊说明

### Cesium 地图

- 需要设置环境变量 `CESIUM_ION_TOKEN`
- Cesium 资源在构建时自动复制到 dist/Cesium/
- 全局变量 `CESIUM_BASE_URL` 指向 `/Cesium`
- 新页面用 `@/components/CesiumViewer` 的 `createDemoViewer` 与 `CesiumInitError`；不要隐藏 credit 署名区（ion 条款要求）

### 易踩坑（均有真实事故）

- **mock 目录只放接口定义**：umi 会 require mock 下所有 ts/js，测试文件放进去会让 dev 全站 500、preview 启动失败（`scripts/mock-loadable.test.ts` 兜底）
- **polyfill 只引 `core-js/stable`**（config.ts `polyfill.imports`）：默认的 esnext 提案 polyfill 会强制覆盖原生实现（曾导致 pdfjs 报 onPull 错误）
- **演示数据层两种模式**：dev 走 umi mock；生产构建且未配 `UMI_APP_API_BASE` 时走前端本地实现（鉴权与表格）。`max preview` 自带 mock，验证纯静态行为要用真正的静态服务器
- **public 资源路径一律经 `PUBLIC_PATH` 拼接**：GitHub Pages 部署在 `/umi-react-admin/` 子路径
- **首页图表数据**由 `node scripts/generate-chart-data.mjs` 确定性生成，不要引入来源不明的第三方数据
- **产物秘钥扫描不能用固定 grep**：Cesium 的 `Ion.js` 自带公开的默认 ion token（HS256 JWT），打包后必然进产物；CI 用 `scripts/check-dist-secrets.mjs`（白名单从 Ion.js 动态读取，只输出指纹）

### 国际化

- 默认语言: zh-CN
- 菜单项键名前缀: `menu.`
- 使用 `useIntl()` hook 获取翻译

### 权限控制

- 在 `src/access.ts` 定义权限
- 使用 `useAccess()` hook 获取权限
- 路由中通过 `access` 属性控制访问

## 部署

- **GitHub Pages**: `pnpm build:github` + GitHub Actions（部署前复制 404.html 做 SPA 回退）
- **Docker**: 根目录 Dockerfile + `nginx/`（仅带哈希文件长缓存，.mjs 需显式声明类型）
- **Vercel**: 支持自动部署 (vercel.json，含 SPA rewrite)
