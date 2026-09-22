# 更新日志

本文件基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 格式维护；历史提交明细见 git log。

## [未发布] - 2026-09 治理批次（feat/next-umi）

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
