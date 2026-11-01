# 安全策略（中文版）

> 英文主文档：[SECURITY.md](./SECURITY.md)；本文件为其完整中文副本，两者同步维护。

## 报告漏洞

**请勿使用公开 issue 报告安全问题。** 推荐渠道：

1. GitHub 私有漏洞报告：仓库页面 **Security** 标签 → **Report a vulnerability**（维护者需先在 Settings → Code security 中开启 Private vulnerability reporting）
2. 邮件：lishuai4415@gmail.com（package.json author）

请在报告中包含：影响版本/commit、复现步骤、影响评估。我们会在 **3 个工作日内确认收到**，修复进度会通过原渠道反馈。

## 支持版本

| 版本            | 支持状态 |
| --------------- | -------- |
| master 分支最新 | ✅       |
| 历史 tag        | ❌       |

## 质量门禁

- PR 阶段 CI：typecheck / 严格 lint（含 .mjs；`react-hooks/exhaustive-deps` 为 error，未使用 disable 的上报已开启）/ vitest / **覆盖率门禁**（`pnpm test:coverage`，阈值见 `vitest.config.ts`）/ 两条显式演示构建 + 真实模式构建（`build:real`，其产物会被断言不含演示代码）/ 体积预算与样式覆盖 / **产物密钥扫描**（仅核对已声明的公开客户端 token 指纹）/ 分层依赖公告（运行时零忽略 + 真实补丁验证；仅构建链可达的公告为非阻塞告警）/ Playwright（包含第三方引起的 CSP 违规，不作忽略）
- 覆盖率百分比统计的是 `vitest.config.ts` 里的**选定域**——`src/utils/**`、`src/services/**`、`src/demo/**`、`src/pages/Login/**`、`src/pages/System/Users/**`、`src/pages/System/Roles/**`——不是全项目口径。最终本机数字为 54 个文件上 statements 79.38% / branches 74.48% / functions 75.55% / lines 81.51%（`pnpm test:coverage`，644 passed / 5 skipped，阈值 60/50/60/60 未改动）；另做一次全项目 `src/**` 统计约为 statements 47.87%（配置未改动），因此门禁数字不得作为全项目覆盖率引用。5 个 skip 全部是 `scripts/real-mode-artifact.test.ts` 中按模式分支的用例（演示模式产物会跳过真实模式断言）；CI 的 `build:real` 作业设置 `REAL_MODE_ARTIFACT_REQUIRED=1`，在那里它们无法静默跳过
- 部署后：等待线上 `version.json` 切到本次提交，对线上地址跑 `@smoke` 用例
- 提交阶段：pre-commit（lint-staged + typecheck）
- 仓库卫生测试：可提交文件不含 JWT 形态秘钥与本地工件

## 构建期凭据与产物扫描

所有可能进入公开产物的构建期凭据都必须显式声明，并在构建后校验。`config/config.ts` 从 `process.env` 注入三类凭据（`CESIUM_ION_TOKEN` / `AMAP_KEY` / `AMAP_SECURITY_CODE`），`scripts/check-dist-secrets.mjs` 为每类维护类型化声明：`EXPECTED_CESIUM_TOKEN`（JWT 形态的 Cesium ion token）、`EXPECTED_AMAP_KEY` 与 `EXPECTED_AMAP_SECURITY_CODE`（32 位十六进制的不透明高德值）；旧名 `EXPECTED_TOKEN` 仅作为 Cesium token 的废弃别名保留。以下情况一律 fail closed：`config.ts` 或 `config.github.ts` 的 define 由 `process.env` 派生——直接引用或间接绑定（先赋给变量、解构、函数返回、从读取 `process.env` 的本地模块导入，逐层追踪）——却既没登记凭据类型、也没登记为公开配置（`PUBLIC_ENV_DEFINES`：API 前缀、演示开关与 `BUILD_INFO`）；define 条目无法静态识别（展开、计算属性名）；构建环境或工作目录下 `.env` / `.env.local` 里出现已登记公开项（`PUBLIC_UMI_APP_VARS`）以外的 `UMI_APP_*` 变量——umi 会把所有 `UMI_APP_*` 变量注入浏览器包的 `process.env` 对象，不经过 define 块，凭据因此不得使用该前缀；构建期配置了凭据却没声明；声明值不是约定形态（截断、带引号、带空白）；声明值与构建实际注入的值不一致；声明值在产物里找不到（说明被扫描的产物不是要发布的那份）。日志只输出 SHA-256 指纹与文件路径，绝不输出凭据值。

扫描对象就是真正发布的产物：Docker 构建阶段在同一个 `RUN` 内构建并扫描 `dist`，之后才 `COPY --from=builder /app/dist`；Vercel 在同一个 shell 里执行 `pnpm run build && node scripts/check-dist-secrets.mjs dist`；GitHub Pages 产线用部署 secret 扫描后生成 SHA-256 完整性清单（`scripts/verify-dist-integrity.mjs`：逐文件路径/大小/sha256、文件数、目录结构、总字节数，拒绝符号链接），清单随 artifact 上传、下载后再校验，任何不一致都在发布前失败。Cloudflare Pages 只有在控制台构建命令设为 `pnpm build:demo && node scripts/check-dist-secrets.mjs dist` 时才会扫描；仓库无法强制控制台设置，这条产线依赖配置者。Docker 只用 build-arg 传凭据，不用 `ENV`；但 Docker 仍可能把 build-arg 值记进构建器元数据/来源证明，需要更强隔离时应改用 BuildKit secret 挂载。

本机制的已知边界：高德值没有可辨识前缀，因此**第二个**既不曾在构建期环境里出现、也没被声明的不透明 key 无法按形态识别——入口被有意收敛到两份配置的 define 登记与 `UMI_APP_*` 白名单（新增凭据类型必须登记，注入了就必须声明）。define 分析是保守的文本级污点追踪而不是 TypeScript 求值：宁可多报不可漏报，追踪不了的写法直接判失败。高熵启发式有意不做：产物里合法的高熵字符串太多，误报不可控。Docker 产线与三个 workflow 文件是静态验证 + 在本机执行其确切 shell 步骤（开发机没有 Docker daemon）；本文不声明任何真实的 Docker 镜像构建、Vercel 部署或 GitHub Actions 运行。

一个本机注意点：umi 的 `loadEnv`（`@umijs/core`）会用 `.env`、`.env.local` 无条件覆盖 `process.env`，因此存在 `.env.local` 时 shell 里的凭据不会进入产物，扫描会（按预期）判失败，直到声明出真正被注入的那个值。`.env.local` 本身不在 CI / Vercel / Docker 环境中（`.dockerignore` 排除 `.env*`，`.gitignore` 覆盖 `/.env.*`，且该文件未被 git 跟踪）——这正是「本机扫描失败、CI 通过」的常见原因。

## 已知限制

仓库只有前端模板，没有真实后端。纯前端演示必须显式设置 `UMI_APP_DEMO_MODE=true`。演示不校验密码，也无法建立可信数据隔离——权限点在浏览器内演示后端逐请求校验（可演示权限差异），但一切校验都在用户自己的浏览器里执行，不构成真实安全边界。演示只使用虚构数据，登录 token 在 sessionStorage；启动会移除旧版 localStorage token。浏览器内的数据与脚本均由用户控制。

演示所展示的授权行为同样如此：分配角色需要独立的 `system.user.role.assign` 权限（新建用户、带 `role` 的资料更新，以及导入行里角色非空时都适用——角色留空按访客导入，角色列传角色 key、由页面把中英文标签映射成 key，任一行在无权限时指定角色则整批 403），可分配范围限于 viewer / operator / analyst，当前角色是 admin / lead 的账号也不能经该通道改角色（委派者既不能提升到、也不能降出这两类角色）；当前角色是 admin / lead 的账号只能由管理员角色停用、启用、删除或改资料（持有 `system.user.update` / `system.user.delete` 的委派角色单条与批量请求都是 403）；任何身份都不能改自己的角色（含 admin）；持有 `system.role.update` 的角色不能修改或 reset 自己所在角色的权限，且只能授予自己持有的权限点；精确设备坐标需要 `ops.device.coordinate.view`，否则接口在序列化时把经纬度粗化到 0.1° 格网并标 `coarse`；角色权限更新必须是去重的叶子 key 字符串数组，admin 角色按集合精确比对；导入请求在写入前按行数/字段数/长度/文本总量/请求体预算整批校验；状态变更路由会写操作日志（登录/退出、用户新建/编辑/停用/删除、角色分配/权限修改/reset、批量导入、告警处置、工单派发/开始处理/退回/完成/验收/返工、日程增删改、演示时钟切换），而 `POST /api/v1/demo/reset` 与 `POST /api/v1/demo/scenario` **刻意豁免**——它们会清空存储，写进去的日志会立刻被抹掉。这些校验让前后端契约可演示、可测试，但它们**不是**安全控制，真实后端必须自行实现上述每一项。

默认关闭演示。真实生产构建必须设置同源 `UMI_APP_API_BASE`，否则失败；GitHub Pages 仅允许公开演示。真实模式采用 Cookie 会话，删除持久 bearer 入口，禁止跨源及单次请求覆盖 API 地址，登录回跳规范化后限制在本站应用内。前端权限展示不能替代服务端授权。

Vercel、nginx 与 Cloudflare Pages（`public/_headers`）强制 CSP，生产 HTML 带 meta CSP。GitHub Pages 无法提供 `frame-ancestors`/`X-Frame-Options` 响应头，因此不能承载需要防嵌入保护的真实管理后台。Cesium 的 Knockout 控件需要 `unsafe-eval`，antd 样式需要内联样式；富文本须持续经 DOMPurify，PDF 禁用 eval/脚本，上传与 URL 输入须经过相应边界。`script-src` 已收窄到唯一被注入的脚本主机 `https://webapi.amap.com`——由已安装的 `@pansy/amap-api-loader` 源码推导，并由 `scripts/csp-amap-pinning.test.ts` 把加载器源码与来源清单绑定——不再保留任何通配符脚本来源；`img-src` 与 `connect-src` 仍放行 `https://*.amap.com` / `https://*.autonavi.com`，因为地图瓦片与数据服务走图片/XHR，不是脚本来源。未配置地图 key 时不使用第三方共享凭据，未审查的统计集成拒绝构建。

Vercel 产线的 `/api/*` 是闭合失败的：显式的 `/api/(.*)` rewrite 排在 SPA 回退之前，`api/` 下的函数在 `API_ORIGIN` 未配置时返回 `503` JSON、对字面 `/api/v1/*` 之外的路径返回 `404` JSON，只有通过判定后才代理到同源后端。因此未配置或配置错误的后端绝不会用 SPA HTML 回应接口请求。该保证的运行时代价：`/api` 流量全部经过 Serverless Function——冷启动、约 4.5 MB 的请求体上限、执行时长上限、响应不做流式转发——高流量后端应改用平台级网关。nginx（`location ~ ^/api(/|$)`，404 JSON 响应体在单一来源 `nginx/api-fail-closed.conf` 中）与 GitHub Pages 等价的本地服务器实现同样的闭合行为；路由与函数由本机回归覆盖，本文不声明任何真实 Vercel 部署。Cloudflare Pages 上由 `public/_redirects` 在 SPA 回退之前把 `/api` 与 `/api/*` 改写到一份静态 JSON。Pages 的 `_redirects` 只支持 3xx 跳转与 200 改写，所以那里的状态码是 200 而不是 404；让前端请求层闭合失败的是响应体（`success: false`、`errorCode: 404`）。本文同样不声明任何真实 Cloudflare 部署。

Dockerfile 不再声明可变的 `# syntax=docker/dockerfile:1` frontend——它只使用默认 frontend 支持的指令，且两个 base 镜像都按摘要固定；若将来确实需要 BuildKit 专属语法，必须固定到精确版本或摘要，由 `scripts/dockerfile-frontend.test.ts` 把关。

真实模式通过构建期 alias（`@/demo/adapter`、`@/demo/token`、`@/demo/clock`）剥离浏览器内演示后端——其中时钟 alias 把 `src/utils/now.ts` 重定向到 `src/demo/clock.real.ts`（恒返回系统时间；freeze/resume 直接抛错）。该替身完全不读不写任何存储，因此即便某来源站曾用于演示、localStorage 里残留冻结时钟锚点，真实模式也不会读到它；freeze/resume 抛错则保证配置错误第一时间暴露。`scripts/real-mode-artifact.test.ts` 断言真实产物含替身哨兵、且异步 chunk 中不含演示时钟的存储键。

本地 preview 默认仅监听 127.0.0.1，拒绝目录越界、逃逸符号链接及异常编码。它用于本机验证；生产应使用 HTTPS 静态服务入口。nginx 监听内网 8080，TLS 在部署入口终止；HSTS 只有浏览器收到 HTTPS 响应时才生效。

## 真实后端接入契约

当前没有后端实现，以下要求在接入时由服务端落实，不能用前端测试代替：

- 会话 Cookie 使用 `Secure`、`HttpOnly`、合适的 `SameSite`，限制 Path，避免宽泛 Domain；登录重新签发会话，退出在服务端失效会话。
- 每个业务接口独立校验身份、角色、对象归属及数据范围；不能接受客户端传来的角色或演示 token。角色分配需要独立权限，且限于委派者有权授予的角色范围（目标账号的当前角色也须在该范围内），必须拒绝自我提权——包括修改自己所在角色的权限、授予自己未持有的权限；用户管理权限同样受范围约束，委派者不能停用、删除或修改持有其无权分配角色的账号；精确坐标需要数据级权限，必须在服务端粗化或不下发；权限列表更新必须按集合校验（拒绝重复与非叶子 key，admin 角色锁定为全量）；导入接口必须在写入前限定整批请求；特权变更必须写入操作者无法抹除的操作日志。
- 状态变更使用 POST/PUT/PATCH/DELETE，检查可信 Origin 和前端发送的 `X-Requested-With: XMLHttpRequest`，拒绝跨源 CORS/简单请求；GET/HEAD 不得修改状态。若引入额外跨源场景须配套真正的 CSRF 方案。
- 登录、退出、currentUser 响应 `Cache-Control: no-store`；错误使用正确 HTTP 状态，接口不得返回 SPA HTML。口令只发往固定同源 API，服务端负责限速、口令存储和会话寿命。
- HTTPS 入口配置证书、同源 API 代理、CSP 和其他安全头，并验证真实响应与权限回归。模板本身没有可声明已通过的线上后端或 TLS 环境。

## 文档及依赖边界

XLSX 在交给 ExcelJS 前校验 ZIP、实际解压量、XML、坐标、合并和命名区域；有文件/行列/字段预算，可终止 worker 的 10 秒时限。PDF 有文件/页数/可见窗口/画布与图片预算，并取消旧任务。这些预算限制模板允许的输入，不能证明浏览器原生解码器对任意未知畸形文件不存在缺陷。

<!-- BEGIN PDF decoded-resource preflight (F13) — WS-PDF/task-3；合并时请保持本块完整 -->

**PDF 解码资源预检（F13）。** 文件交给 react-pdf/PDF.js 之前，PDF 预览先用零依赖预检（`src/pages/Document/Pdf/pdfPreflight.ts`）解析容器结构，任一预算被突破即拒绝：对象 50 000 个、解析 token 200 000 个、解析深度 64、流 10 000 个、单个流解码 32 MiB、全文件解码 128 MiB、对象流 256 个（单个 8 MiB、合计 32 MiB）、页树节点 4 000 个、页树深度 64、页数 1 000（含声明的 `/Count`）、字体 128 个、内嵌字体数据 32 MiB、注释 5 000 条（单页 1 000 条）、文本显示算子 500 000 个（单内容流 50 000 个）、单内容流 8 MiB，以及 3 秒扫描时限。解码边解边计数并立即丢弃，因此解压炸弹在预算处中止，而不是把结果落进内存；超时、取消与卸载会停止扫描、释放 PDF 文档并 revoke 生成的对象 URL，过期的加载/渲染回调一律忽略。渲染页同时关闭注释层与文本层（`renderAnnotationLayer={false}`、`renderTextLayer={false}`），react-pdf 不再对可见页调用 `getAnnotations()`/`getTextContent()`。

如实说明残留限制：PDF.js 没有暴露任何解码资源记账接口，因此该预检是容器层的最佳努力边界，**不是**对任意未知畸形 PDF 的安全证明。我们只解码 `FlateDecode`；首个解码器是 `LZWDecode`/`RunLengthDecode` 的流，以及用 ASCII85/ASCIIHex 盔甲包裹、后面还挂着 Flate 层的链，一律按保守的 64 倍估算而非实测。PNG/TIFF 预测器未做还原，带预测器的流按同量级近似记账。图像编码器（`DCTDecode`/`JPXDecode`/`CCITTFaxDecode`/`JBIG2Decode`）只按压缩长度计入 —— 其展开后的像素缓冲不在这里度量，仍仅由 PDF.js `maxImageSize` 与上文画布/窗口预算约束。同一对象号的每个物理定义都要过预算——增量更新与伪造的诱饵都会让对象号重复，PDF.js 按 xref 选哪一个由文件决定——因此所有流副本都会解码记账，页树节点的每个定义都要过页树预算（引用解析取最后一个定义，与 PDF.js 重建 xref 的口径一致）。加密文档（trailer 或 xref 流字典带 `/Encrypt`）直接拒绝：其流是密文、无法记账，而 PDF.js 用空用户密码即可解密。定位不到目录或页树的文件同样拒绝（fail closed），拒绝前其中的流仍全部记账；预检依旧只是容器解析器，不是完整的 PDF 校验器。流的 `/Length` 是间接引用时，可能以有界 `endstream` 搜索确定范围；扫描在主线程同步执行，因此需要的预检工作超过 3 秒时限的文档会被拒绝而不是放行。以上都不能证明浏览器原生解码器对恶意输入不存在缺陷。

<!-- END PDF decoded-resource preflight (F13) -->

历史公告不再登记为无修复的接受项。真实升级、移除或源码补丁见 [THIRD-PARTY-NOTICES.md](./THIRD-PARTY-NOTICES.md)。原始 `pnpm audit` 根据真实版本号仍可能命中本地已修补包；保留原始结果，`pnpm audit:security` 必须同时验证所有安装实例的源码哈希和真实攻击回归，新公告及未证明修补的实例均失败。不得通过忽略公告、伪造版本号或只评估不可达来让门禁通过。

公告分层（2026-11-01）：所有安装路径都只落在构建/测试/lint 工具链子树内（打包器、vite/mako/utoopack、eslint 与 vitest 家族、纯 Node 构建辅助——这些包不进 `dist`）的公告降为非阻塞告警；只要有任何一条路径可进产物/运行时图，仍按零忽略阻塞。判定从宽（存在旁路路径即维持阻塞），`AUDIT_TOOLCHAIN_STRICT=1` 可恢复全量阻塞用于周期性人工清点。理由：上游 `@umijs/max` 锁死了这些传递依赖的版本、仓库无法升格，而 GHSA 数据库的每次更新在 2026-10-21 至 2026-11-01 间把所有 PR 连续打红；用户真正运行的运行时层的零忽略保证保持不变。
