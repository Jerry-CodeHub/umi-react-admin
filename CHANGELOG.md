# 更新日志

本文件基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 格式维护；历史提交明细见 git log。

## [未发布] - 2026-09 演示重构（refactor/*）

方案见 `docs/remediation-plan-2026-09-23.md`（不入库）。

### P7 部署与使用体验（2026-09-24）

- 登录页重做：左侧产品说明与亮点，右侧「以管理员体验」「以访客体验（受限权限）」一键登录，表单预填；登录页可直接切换明暗与语言
- 首次登录导览（antd Tour，4 步：菜单分组 → 主题与语言 → 账户菜单与重置 → 查看源码），可从头像菜单「功能导览」重新打开
- 构建信息：页脚显示构建时间、部署目标与提交号（链接到提交），并输出 `dist/version.json`；Docker 经 `--build-arg GIT_SHA` 传入提交号
- 路由切换的加载占位改为贴近页面形状的骨架；项目标识换成自制 SVG（同时作为 favicon），删除沿用的 umi 标识与未使用的图片
- 体积：pro-components 拆为异步 `vendor-pro`，入口 JS 由 777KB 降到 649KB gzip、登录页由 779KB 降到 652KB，预算相应收紧到 700KB
- E2E（Playwright，`e2e/`）：对 GitHub Pages 同构产物逐页断言无未捕获异常、无 console.error、无 CSP 违规；英文界面逐页断言无遗漏中文；关键流程（登录回跳、旧路径重定向、访客 403 与脱敏、KPI 与台账口径一致、告警转工单与看板拖动、重置演示数据、版本信息）。CI 新增 e2e 任务；部署后等待线上 `version.json` 切到本次提交再对线上跑 `@smoke`
- 部署提交改用 github-actions[bot] 身份（不再计入维护者的贡献图）
- Cesium 影像瓦片请求失败时的未处理拒绝不再刷屏（缺几块瓦片不影响使用）
- `pnpm preview` 改用与 GitHub Pages 行为一致的静态服务器（`scripts/serve-dist.mjs`），不再用自带 mock 的 `max preview`
- 文档：README、CONTRIBUTING、SECURITY 与新架构对齐

### P6 地图（2026-09-24）

- 高德与 OpenLayers：两张地图显示同一批 240 个监测站，按状态着色、按状态筛选（带数量）、点击弹出站点卡片（两页共用一个 React 组件）；高德暗色主题切换深色底图，OpenLayers 暗色下瓦片反色
- Cesium 六个场景统一到 `useCesiumViewer` / `CesiumStage`（创建、初始视角、错误态、外部事件处理器的销毁都在一处），并按业务重做：
  - GeoHash 网格：把 240 个站点按 GeoHash 分桶计数（精度可调）、查看视野中心的网格编码
  - 方位测距：外场监测点的截获 / 定位 / 解调包络；新增 `utils/MapCompute/geodesy.ts`（大圆公式），由「方位 + 距离」反算的包络与实测经纬度的误差 < 3 km（测试断言）。原算法把方位 0 当作正东、且不按纬度缩放经度，已删除
  - 场强热力图：图片纹理与点云（悬停读取场强、分级图例）
  - 路线与覆盖：巡检路线规划（逐点点击，按公里生成采样点并给出全长）、三种能力包络的 turf 并集、东北区 214 个站点覆盖的凸包合并与逐个显示对比
  - 框选与测距：在站点上框选统计、两点直线距离
  - 海空态势：关注海域内 7 个目标按航速插值运动（SampledPositionProperty），可调播放速度、开关航迹、点击查看目标
- 数据与代码分离：删除写在 TS 里的 2,694 行数据（`exportJson.ts`、`dataEnd.ts`，其中 800 行 `thermal` 从未被引用），改为 `public/data/cesium/*.json` 按需加载；删除不再使用的计算函数与图标
- 样式收敛完成：移除 styled-components 插件配置、全局 Less 与 `postcss-less`，样式只剩 antd token + Tailwind + 少量按根类名隔离的 CSS
- 多语言迁移完成：`I18N_PENDING` 清空，代码中不再有直接书写的中文界面文案

### P5b 组件、多媒体与文档（2026-09-24）

- 日程：日程来自接口（值班交接、现场巡检、复盘评审、培训、维护窗口、版本发布，按类型着色），框选新建、拖动 / 拉伸改期、点击删除都写回接口；侧栏显示类型图例与「接下来」列表
- 富文本：TinyMCE 预置一份按当前数据生成的运维周报（核心指标表、告警类型 Top 3、下周巡检计划），插值全部转义，回显仍经 DOMPurify；只打包实际用到的 8 个插件
- 电子签名：改为工单验收场景——选择近 3 天完成的工单，签字后写回工单（看板卡片显示「已验收签字」），可下载签名 PNG；画布随容器与像素比自适应，改用 ref 而非全局 id
- 视频 / 音频：外壳统一、文案双语；音乐播放器改用原生 Segmented 切换频谱样式、唱片随播放旋转，歌词中英双语；波形页颜色跟随主题、显示播放进度
- PDF：删除原先写着开发说明的 `public/demo.pdf`，改为在浏览器内按当前数据生成两页月报（复用工作台图表，html2canvas 截图 + 手写的最小 PDF 封装，无需嵌入中文字体），react-pdf 预览、可下载，也可打开本地 PDF
- 样式：以上页面的 styled-components 全部移除（信号板、PDF、音频页），音乐播放器的舞台样式改为按根类名隔离的普通 CSS
- 修复：Tailwind 4 默认边框色是 `oklch()`，html2canvas 1.x 无法解析，截图页与 PDF 生成会整体失败；基础层边框色改为 rgb 写法

### P5a 设备运维（2026-09-24）

- 设备台账（新）：240 台监测站，按大区、型号、状态筛选，在线率 / 电平 / 心跳排序；详情抽屉含最近告警
- 告警中心（新）：近 90 天告警，按级别、类型、状态、大区、时间范围筛选，「只看未恢复」开关；未恢复告警可转工单、标记恢复或误报关闭，转出的工单立即出现在看板
- 工单看板：替换原先 944 行的 dnd-kit 示例拷贝（只画了 16 个数字方块），改为三列看板——卡片含优先级、处理人、时限剩余 / 超时；拖动流转状态并写回（乐观更新，失败回退）；键盘左右方向键直接跨列；可按故障 / 巡检筛选。删除不再使用的 `@dnd-kit/sortable`、`@dnd-kit/utilities`
- 频谱占用：替换原先 1,006 行的 D3 频率图，改为对数频率轴上的型号覆盖带与重点业务频段叠加（宽度随容器自适应、颜色跟随主题），下方表格列出各重点频段可监测的在线设备数与覆盖型号
- 演示数据：例行巡检改为多站点连续作业（3~6 天），看板「处理中」列在任何时刻都有内容

### P4 系统管理（2026-09-24）

- 用户管理：头像 + 姓名 + 邮箱、工号、部门、角色、脱敏手机、状态、最近登录（相对时间，悬停看精确时间）；关键字 / 部门 / 角色 / 状态筛选与服务端排序分页；新建 / 编辑表单带校验；单个与批量启用、停用、删除（体验账号与当前账号受保护）；详情抽屉展示该用户最近的操作记录
- 角色权限（新）：五种内置角色与成员数，按权限点树勾选配置、恢复默认；系统管理员角色锁定全部权限
- 操作日志（新）：近 30 天审计记录，按关键字、操作类型、结果、时间范围筛选；在演示站里的登录、编辑等操作实时出现在这里
- 权限演示：当前身份卡片与一键切换（管理员 ↔ 访客）；路由级（无权限访问得到 403）、按钮级（`<Access>` 隐藏或禁用）、数据级（精确坐标仅管理员可见）三个示例并排对比
- Excel 导入导出与用户管理同源：导出全部用户、下载模板；导入时表头与部门 / 角色取值中英文都能识别，逐行校验必填、邮箱、登录名格式、已存在与文件内重复，确认后写入用户表
- 仓库卫生门禁的导入识别不再把 `'import'` 这类字符串误判为模块导入

### P3 工作台（2026-09-24）

- 首页重做为运营工作台：4 个 KPI（在线设备、今日告警及较昨日同期、工单时限达成率、平均响应时长，后两项与前 30 天对比，按「好 / 坏」而非涨跌着色）+ 告警趋势（按级别堆叠，30/90 天切换）+ 告警类型环图 + 各大区在线率 + 告警处置流向桑基图 + 设备健康散点 + 设备分布旭日图 + 最新动态；全部来自 `/api/v1/dashboard/overview`，由明细实时聚合，每分钟自动刷新
- 图表跟随明暗主题（G2 classic / classicDark），级别等语义色全站一致；卡片内置加载骨架与出错重试；栅格按 xs / md / xl 响应式排布，手机宽度单列
- 截图页改为截取一张告警详情卡片（含图表，背景跟随主题），支持预览与下载
- 删除首页旧的静态图表数据（`public/data/charts`）与其生成脚本，业务数据统一由 `src/demo` 生成

### P2 信息架构与页面外壳（2026-09-24）

- 菜单重组为 工作台 / 系统管理 / 设备运维 / 地图 / 组件 / 多媒体 / 文档 / 异常页，路径统一小写 kebab-case；旧版 34 条路径全部重定向到新地址（`config/routes.ts` 的 `LEGACY_REDIRECTS`，`scripts/routes.test.ts` 校验目标存在、组件文件存在、菜单双语键齐全）
- 演示页统一外壳 `DemoPage`：标题与面包屑取自路由，下方一句话说明，右上角「查看源码」直达仓库文件
- 多语言基础设施：文案按领域拆分（menu / framework / enums / pages），中英键集一致、英文无中文、占位符一致由 `locales.test.ts` 把关；ESLint 新增 `local/no-cjk-literal`，代码里直接写中文即报错（尚未迁移的页面在 `I18N_PENDING` 清单中，随后续阶段清空）。首次访问按浏览器语言选择界面语言
- 请求层、错误边界、业务错误的兜底文案改为从 locales 取默认语言，不再在代码里另写中文
- 顶栏重做：一键切换明暗主题、语言、GitHub、账户菜单（重置演示数据 / 退出登录），头像按姓名生成首字与固定底色
- 应用列表换成项目相关链接（文档、更新日志、问题反馈、Ant Design、Umi、AntV），图标改用内置图标；CSP 随之去掉两个阿里图片域名
- 新增 `useChartTheme`（图表跟随明暗主题）与全站语义色常量（告警级别、设备状态、工单状态、分类色板）；新增 500 异常页
- 修复：Cesium「模型」页文件名 `Model.tsx` 被 umi model 插件当作数据模型自动加载（大小写不敏感文件系统上 dev 编译失败），改名 `ModelMeasure.tsx`

### P1 演示数据底座（2026-09-24）

- 统一的演示后端 `src/demo`：浏览器内运行的 REST 服务，经请求层 axios adapter 接入；dev、preview 与 GitHub Pages / Vercel / Docker 走同一套实现。删除 `mock/` 目录、umi mock 配置、`services/demo` 与 `USE_BACKEND` 双链路（mock 目录曾导致 dev 全站 500）。未采用 MSW：Service Worker 只在 https / localhost 可用，Docker 经 http 内网地址访问时会整站无法登录
- 数据故事：虚构的「物联网监测运营平台」——86 名用户（7 个部门、5 种角色）、34 个城市 240 台监测设备、近 90 天约 1,500 条告警、由告警派生的工单与例行巡检、近 30 天操作日志、前后五周日程。按日历日播种：每天的历史固定、窗口随今天滑动；工单状态按「现在」推导，看板与 KPI 随时间自然演进
- 合理性门禁 `src/demo/generate.test.ts`：级别比例、工作日/周末节律、时间线先后、设备状态与活动告警对应、KPI 与明细口径一致、邮箱仅 example.com、手机号仅脱敏、IP 仅文档保留段、中英数据同构
- 改动以补丁形式存 localStorage（带版本号，结构变化时整体作废；损坏数据自动丢弃；清理旧版 `umi-react-admin-demo-users` 键），支持一键重置
- 接口契约 `src/services/types.ts` 与按领域拆分的服务模块（users / system / ops / events）；删除 OneAPI 生成的 `any` 服务代码
- 体验账号：`admin`（系统管理员）与 `guest`（访客，受限权限）；种子用户按角色签发 token，停用后已签发的 token 立即失效
- 修复：登录后偶发被弹回登录页（状态未提交即跳转，登录请求变为异步后稳定复现），改为登录态写入后再跳转；未登录打开受保护页面由「无权访问」改为先去登录并在登录后回到原页面（只接受站内路径）

### P0 热修（2026-09-23）

- 音频可视页恢复播放：wavesurfer 7 以 blob URL 播放音频，CSP `media-src` 补 `blob:`（GitHub Pages meta 与 vercel.json 为强制模式，09-22 安全头上线后该页点击播放无反应）
- 视频封面改为自制 SVG 随站点托管（原热链图片被 CSP `img-src` 拦截，播放器区为白底）
- CSP 单一来源 `config/csp.ts`：GitHub Pages meta 直接引用，vercel.json 与 nginx 副本由 `scripts/csp-consistency.test.ts` 逐字比对
- 发版后旧 chunk 丢失自愈：错误边界识别 ChunkLoadError 后自动刷新一次（60 秒内至多一次），仍失败则提示「站点已更新」；错误边界文案接入双语

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
