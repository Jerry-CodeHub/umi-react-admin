# 更新日志

本文件基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 格式维护；历史提交明细见 git log。

## [未发布] - 2026-09 治理批次（feat/next-umi）

### 依赖升级阶段 4（2026-09-23）

- pnpm 10 → 11.27.1：11 起不读 `package.json#pnpm` 与 `.npmrc` 非鉴权配置，overrides（49 条）与提升等配置迁入 `pnpm-workspace.yaml`，`allowBuilds` 显式记录不执行的安装脚本；Dockerfile 同步拷贝该文件。未选 12.x：12 是 Rust 重写的原生二进制，pnpm 10 自动切换到它在本机即失败（ENOEXEC）
- 关闭 `shamefullyHoist`：node_modules 顶层只剩声明的依赖；Cesium 默认 token 白名单与 mock 可加载性门禁改为沿依赖链解析传递依赖
- TypeScript 5.9 → 6.0（最后一个带 JS 编译器 API 的版本）。TS 7 暂缓：typescript-eslint 最新版 peer `<6.1.0`；实测 TS 7.0.2 对本项目类型检查 0 错误、1.35s
- ESLint 8（@umijs/lint 预设）→ ESLint 10 flat config（`eslint.config.mjs`，逐条移植 umi 规则集）；stylelint 14 → 17（`stylelint.config.mjs`）。ESLint 9 已于 2026-08 EOL 故直接上 10
- React 18 → 19（项目直接依赖，umi 别名到它）、@types/react 19、react-pdf 11（PDF.js 6.3，`suspense={false}` 保留原告警）；antd 5 经官方 `@ant-design/v5-patch-for-react-19` 兼容 React 19
- 高德页去掉 `@pansy/react-amap`（其 Marker 调用 React 19 已删除的 `unmountComponentAtNode`，库 2024-06 后无更新），改为直接调用 JS API 2.0，加载器仍用 `@pansy/amap-api-loader`，未配 key 时行为不变
- antd 6 + pro-components 3（beta）放在独立实验分支 `chore/deps-phase4-antd6-experimental`，未并入本阶段

### 依赖升级阶段 3（2026-09-23）

- FullCalendar 6 → 7：五个插件包合并为 `@fullcalendar/react/*` 入口，新增 peer `temporal-polyfill`；v7 不再内置 CSS，改为引入 skeleton + Classic 主题（保持 v6 外观）；类型改名（`DateSelectArg` → `DateSelectInfo` 等）；日历随应用暗色主题切换（调色板读取祖先 `data-color-scheme`）。可见差异：v6 下日期数字被 antd 的链接色染成蓝色，v7 恢复正文色；列头默认不加粗
- Tailwind CSS 3 → 4：删除 `tailwind.config.js`，配置迁入 `tailwind.css`（`@theme inline` 桥接 antd CSS 变量、`@source` 限定扫描范围、`@source not inline()` 替代 blocklist）。工具类刻意不放进 `@layer`，保持 v3 与 antd CSS-in-JS 的层叠语义；日历侧栏的 `space-y-3` 改为等价的 v3 选择器（v4 的 space-y 实现会输给 antd 排版外边距）。17 个页面与升级前逐像素对比无差异（日历页除外）
- 浏览器基线提高到 Chrome 111+ / Firefox 128+ / Safari 16.4+（Tailwind 4 要求），README 已注明

### 依赖升级阶段 2（2026-09-23）

- 工程工具主版本：husky 9（`prepare` 改为 `husky`，hook 去掉 v8 的引导行）、lint-staged 17（需 Node ≥22.22.1；配置改名 `.lintstagedrc.json`，17 起无扩展名按 YAML 解析）、cross-env 10（`start` 脚本无环境变量，去掉无效包装）、prettier-plugin-organize-imports 4、prettier-plugin-packagejson 3
- 运行时小型主版本：@dnd-kit/sortable 10、signature_pad 5、ol 10；移除从未被引用的 @dnd-kit/modifiers

### 依赖升级阶段 1（2026-09-23）

- 工具链切到 Node 24 LTS（`.nvmrc` 24.21.0、Docker 构建镜像同步）；engines 由 `>=20`（Node 20 已于 2026-04 停止维护）收紧为 `^22.22.2 || >=24.15.0`，与 Cesium、jsdom 的引擎要求对齐
- 范围内升级：antd 5.17 → 5.29、cesium 1.141 → 1.145、wavesurfer.js 7.12、xgplayer 3.0.26、FullCalendar 6.1.21、react-pdf 10.5、prettier 3.9 等；@umijs/max 暂留 4.7.19（4.7.20 发布不足两天）
- 幽灵依赖清零：classnames、@dnd-kit/utilities、pdfjs-dist（与 react-pdf 内置版本严格一致）显式声明；styled-components 改走 `@umijs/max` 再导出，ProCard 改从 pro-components 导入，fecha 换成 dayjs。仓库卫生门禁新增「导入包必须已声明」与 pdfjs 版本一致性检查，为后续 pnpm 11（不再读取 `.npmrc` 的 shamefully-hoist）铺路
- antd 5.25 起废弃的 `destroyOnClose` 改为 `destroyOnHidden`；vendor-antd 分包覆盖 `@rc-component/*` 作用域
- 依赖审计 low 3 → 1（postcss-selector-parser 两条经 override 修复）

### 审查修复（2026-09-21 审查后）

- 本地开发恢复：`mock/` 下的测试文件导致 umi mock 整批加载失败（dev 全站 HTTP 500、preview 启动即退出），测试移出并加 mock 可加载性门禁
- 纯静态部署可登录：鉴权增加前端本地演示实现（此前 GitHub Pages / Vercel / Docker 下整站锁在登录页）；GitHub Pages 加 404.html、Vercel 加 SPA rewrite
- 请求层对齐 umi 运行时约定：errorHandler 不再产生无人处理的 rejection，`skipErrorHandler` 生效，token 只发往自有后端
- PDF 可用：根因为 umi 默认注入的 core-js 提案 polyfill 强制覆盖原生 `Promise.try`，改为只注入 `core-js/stable`
- Docker：产物启用内容哈希，仅哈希文件长缓存；`.mjs` MIME、安全响应头、nginx 1.30
- TinyMCE 改为自托管 8.9.1（此前实际从 Tiny Cloud 加载，无 key 时编辑器只读，8.9.1 升级对运行时无效）
- 拆包修正：去掉误合并的 media/d3 强制分组，体积门禁新增路由真实首屏指标并接入 CI
- 其余：边框基线、暗色登录页、键盘可操作的顶栏菜单、`<html lang>`、Excel 超链接单元格、D3 首段 NaN、AudioPlayer 歌词解析崩溃、Cesium 署名恢复与初始化收敛、首页图表数据全部自制
- 更正：下方"首屏 JS gzip 2.40MB → 728KB"只统计入口同步脚本；登录后落地页 /home 的真实首屏为 1153KB gzip（修正前 1275KB）
- CI：产物 JWT 扫描原为固定 grep，会被 Cesium 自带的公开默认 ion token 必然命中（PR #9 两条构建因此失败），改为白名单脚本 `scripts/check-dist-secrets.mjs`；CI 改为只在 PR 与手动时触发，不再留下被并发取消的重复运行；README 徽章改为反映 master 的部署工作流

### 安全

- 修复 errorHandler 全部分支不可达的回归（axios 运行时下 `instanceof Response` 恒 false），401 恢复清 token 跳登录
- tinymce 8.5.0 → 8.9.1（消 3 条 high XSS）；axios override 0.31.1 → 1.20.0；依赖审计公告 130 条 → 32 条（high 49 → 5）
- 移除硬编码作者私有 Clarity 项目 ID 的统计脚本，改为 `CLARITY_ID` 环境变量可选注入（默认零统计）
- CI 增加产物 JWT 泄露扫描（放行 Cesium 自带的公开默认 ion token，只输出指纹）与依赖审计步骤；pre-commit 增加类型检查

### 新增

- 鉴权闭环：mock 登录/登出/currentUser 三接口、initialState 真实化、路由守卫、`dontHaveAccess` 权限演示
- 生产演示数据层：纯静态托管下表格 CRUD 经静态 JSON + localStorage 真实可用（`UMI_APP_API_BASE` 可切换真实后端）
- 暗色模式真实现（antd 算法热切换 + ProLayout 联动 + localStorage 持久化）
- Excel 演示页（exceljs 导入/导出）；PDF 页三环境路径统一与失败可见提示
- vitest 测试体系（34 例起步，请求层契约/geoHash 性质/纯函数）
- 体积预算门禁（`pnpm size`）；PR 触发的 CI 工作流
- 社区治理文件（SECURITY/CONTRIBUTING/CODE_OF_CONDUCT/PR 模板）与第三方许可清单

### 变更

- 依赖栈收敛：移除 16 个零引用依赖（含断供 3.5 年的设计器 beta fork 与四个重复热图库）；@umijs/max 4.6.53 → 4.7.19；TypeScript 5.9
- turf 整包改按需子包（根除 AGPL/EPL 传递组件）；热力图演示数据降采样（21k → 5.4k 点）
- 演示媒体替换为自制资源（PDF/音频），移除来源不明的第三方媒体约 10MB

### 性能

- 首屏同步脚本 192 → 4 个，首屏 JS gzip 2.40MB → 728KB（splitChunks 重构）
- 删除 8.3k 行不可达代码（Formily/Designable 死代码、半成品演示页、死数据）

### 修复

- 多边形合并误用 `turf.combine`（只打包不合并）改为 `turf.union` 真并集；轨迹补点丢失短线段终点
- 表格编辑不再清空表单外字段；性别枚举与数据对齐；详情抽屉接通
- en-US 菜单键 HaiAirPosture 错挂修复；lint-staged 双配置收敛为单一配置
- Docker 交付链重建（多阶段 + nginx + .dockerignore，见后续提交）

## 历史版本

见 [git log](https://github.com/Jerry-CodeHub/umi-react-admin/commits/master)。
