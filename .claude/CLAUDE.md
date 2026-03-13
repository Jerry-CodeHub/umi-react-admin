# CLAUDE.md - umi-react-admin 项目指南

这是 Claude Code 在处理此项目时的上下文文档。

## 项目概述

umi-react-admin 是一个基于 Umi Max 的企业级 React 后台管理系统模板，包含丰富的功能组件展示，如日历、富文本编辑、地图（Cesium/高德/OpenLayers）、低代码设计器等。

## 技术栈

- **框架**: Umi Max 4.x + React 18 + TypeScript 5.x
- **UI**: Ant Design 5 + Ant Design Pro Components
- **样式**: Tailwind CSS 3 + Less
- **状态管理**: Valtio (Umi Max 内置)
- **表单/低代码**: Formily 2 + Designable
- **地图**: Cesium.js、OpenLayers 9、高德地图
- **图表**: Ant Design Charts、D3.js
- **包管理器**: pnpm

## 常用命令

```bash
pnpm install          # 安装依赖
pnpm start            # 启动开发服务器 (端口 8000)
pnpm build            # 生产构建
pnpm build:github     # GitHub Pages 构建
pnpm preview          # 构建并预览 (端口 8001)
pnpm format           # Prettier 格式化代码
```

## 项目结构

```
src/
├── pages/            # 页面组件（路由对应）
├── components/       # 可复用组件
├── layouts/          # 布局组件
├── models/           # 全局数据模型 (hooks)
├── services/         # API 服务层
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

## Git 工作流

- **pre-commit**: 自动运行 lint-staged (ESLint + Prettier)
- **commit-msg**: 验证 commit 消息格式 (`max verify-commit`)

## 关键配置文件

- [config/config.ts](config/config.ts) - Umi 构建配置
- [config/routes.ts](config/routes.ts) - 路由配置
- [tailwind.config.js](tailwind.config.js) - Tailwind CSS 配置
- [.prettierrc](.prettierrc) - Prettier 配置
- [.eslintrc.js](.eslintrc.js) - ESLint 配置

## 特殊说明

### Cesium 地图

- 需要设置环境变量 `CESIUM_ION_TOKEN`
- Cesium 资源在构建时自动复制到 dist/Cesium/
- 全局变量 `CESIUM_BASE_URL` 指向 `/Cesium`

### 国际化

- 默认语言: zh-CN
- 菜单项键名前缀: `menu.`
- 使用 `useIntl()` hook 获取翻译

### 权限控制

- 在 `src/access.ts` 定义权限
- 使用 `useAccess()` hook 获取权限
- 路由中通过 `access` 属性控制访问

## 部署

- **GitHub Pages**: `pnpm build:github` + GitHub Actions
- **Docker**: 使用根目录 Dockerfile
- **Vercel**: 支持自动部署 (vercel.json)
