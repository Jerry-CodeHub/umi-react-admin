# umi-react-admin

<!-- ALL-CONTRIBUTORS-BADGE:START - Do not remove or modify this section -->

[![All Contributors](https://img.shields.io/badge/all_contributors-3-orange.svg?style=flat-square)](#contributors-)

<!-- ALL-CONTRIBUTORS-BADGE:END -->

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE) [![Deploy](https://github.com/Jerry-CodeHub/umi-react-admin/actions/workflows/deploy.yml/badge.svg?branch=master)](https://github.com/Jerry-CodeHub/umi-react-admin/actions/workflows/deploy.yml) [![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](./CONTRIBUTING.md)

`umi-react-admin` 是基于 **Umi Max 4 + React 19 + Ant Design 5 + ProComponents** 的开源后台模板。和多数模板不同，它的演示内容讲的是**同一个故事**：一个虚构的「物联网监测运营平台」——240 台监测站、近 90 天告警、由告警派生的工单、86 名运维人员、角色权限与操作审计，工作台上的每个数字都由这些明细实时聚合，经得起推敲。

**[在线演示](https://jerry-codehub.github.io/umi-react-admin/)** —— 登录页一键「以管理员体验」或「以访客体验（受限权限）」。

| 分组 | 页面 |
| --- | --- |
| 工作台 | KPI（在线设备、今日告警、工单时限达成率、平均响应）、告警趋势、类型占比、各大区在线率、处置流向、设备健康、设备分布、最新动态 |
| 系统管理 | 用户管理（筛选 / 排序 / 批量 / 详情抽屉）、角色权限（权限点树）、操作日志、权限演示（路由级 / 按钮级 / 数据级） |
| 设备运维 | 设备台账、告警中心（转工单 / 恢复 / 误报关闭）、工单看板（拖拽流转，支持键盘）、频谱占用（D3） |
| 地图 | 高德、OpenLayers（同一批站点）；Cesium 六个场景：GeoHash 网格、方位测距、场强热力图、路线与覆盖、框选与测距、海空态势 |
| 组件 | 日程（FullCalendar）、富文本（自托管 TinyMCE，预置按数据生成的周报）、电子签名（工单验收）、页面截图（html2canvas） |
| 多媒体 / 文档 | 视频、音乐播放器、波形；浏览器内按数据生成的月报 PDF、Excel 导入导出（逐行校验） |

全站中英双语、明暗主题、手机端可用；每个页面右上角「查看源码」直达对应代码。

## 环境要求

- Node.js 24 LTS（见 [.nvmrc](./.nvmrc)，推荐使用 nvm / fnm 管理）；最低 22.22.2（jsdom、Cesium 等依赖的引擎要求）
- pnpm 11（`packageManager` 字段已钉住版本，pnpm 10 会自动切换）；新发布不足 24 小时的依赖版本会被 pnpm 11 默认的 `minimumReleaseAge` 拒绝
- 国内开发者可在 `~/.npmrc` 自行配置镜像源（本仓库的 `.npmrc` 不携带镜像配置）

## 安装使用

```bash
git clone https://github.com/Jerry-CodeHub/umi-react-admin.git

cd umi-react-admin

# 复制环境变量模板，按需填写（见下方环境变量说明）
cp .env.example .env.local

pnpm install

pnpm start
```

### 环境变量

| 变量 | 必需 | 说明 |
| --- | --- | --- |
| `CESIUM_ION_TOKEN` | Cesium 功能需要 | 在 [ion.cesium.com](https://ion.cesium.com/tokens) 获取；缺失时 Cesium Ion 影像/地形不可用（其余功能不受影响） |
| `UMI_APP_API_BASE` | 可选 | 真实后端 API 地址；不配置时为演示模式：接口由浏览器内的演示后端响应（`src/demo`，dev 与所有静态部署同一套实现，改动经 localStorage 持久化） |
| `AMAP_KEY` / `AMAP_SECURITY_CODE` | 可选 | 高德 Web 端（JS API）Key 与安全密钥（[控制台申请](https://console.amap.com)）；不配置时高德演示页使用组件库自带公共 key（配额不受控），正式部署建议配置 |
| `CLARITY_ID` | 可选 | [Clarity](https://clarity.microsoft.com) 统计项目 ID；**模板默认不含任何统计脚本**，配置后才按你自己的项目上报（含会话回放，正式站点请履行隐私告知义务） |

## 常用脚本

```bash
pnpm start            # 开发服务器（端口 8000）
pnpm build            # 生产构建（主产线：Vercel / Docker）
pnpm build:github     # GitHub Pages 构建（子路径 /umi-react-admin/）
pnpm check            # typecheck + 严格 lint + vitest（提交前必跑）
pnpm test             # vitest 单测（含演示数据合理性、接口、CSP 一致性、路由表）
pnpm e2e              # Playwright：对 build:github 产物逐页冒烟 + 英文完整性 + 关键流程（先 build:github）
pnpm e2e:build        # 构建并跑 e2e
pnpm size             # 构建并执行体积预算门禁（size-budget.json）
pnpm analyze          # 构建并生成 bundle 组成分析
pnpm format           # Prettier 格式化
```

## 目录结构

```
src/
├── pages/            # 页面（按菜单分组：Dashboard / System / Ops / Map / Components / Media / Document / Exception）
├── components/       # 通用组件（DemoPage 页面外壳、ChartCard、CesiumViewer、GuideTour、ErrorBoundary…）
├── demo/             # 浏览器内的演示后端：数据生成器、补丁存储、REST 路由、axios adapter
├── services/         # 接口调用与前后端契约（types.ts）
├── hooks/            # useApi / useChartTheme / useEnums / useThemeMode
├── locales/          # 中英文案（按领域拆分，键集一致由测试把关）
├── constants/        # 枚举顺序、语义色、权限点树
├── layouts/          # 顶栏
└── utils/            # 请求层、格式化、地图计算（geodesy / geohash / turf 合并）
config/               # umi 配置、路由（含旧路径重定向）、CSP 单一来源、分包、构建信息
e2e/                  # Playwright 用例
```

## 功能说明

- **演示后端**：未配置 `UMI_APP_API_BASE` 时，所有接口由浏览器内的演示后端响应（`src/demo`，经请求层 axios adapter 接入）。dev、preview 与各静态部署是同一套实现；不用 Service Worker，所以 Docker 经 http 内网地址访问也能用。数据按日历日以固定种子生成，时间窗随今天滑动；你做的改动（新建、编辑、拖动、签名……）以补丁形式存 localStorage，头像菜单可「重置演示数据」。
- **数据合理性**：`src/demo/generate.test.ts` 把规则写成断言——级别比例、工作日 / 周末节律、时间线先后、设备状态与活动告警对应、KPI 与明细口径一致、邮箱只用 example.com、手机号只以脱敏形式出现、IP 只用文档保留段。
- **接真实后端**：设置 `UMI_APP_API_BASE`，按 [src/services/types.ts](./src/services/types.ts) 的契约实现同名接口即可，前端零改动；演示后端代码不会被加载。
- **鉴权与权限**：`admin`（系统管理员）与 `guest`（访客）两个体验账号，任意其它用户名也可登录（密码不校验，见 SECURITY.md「已知限制」）。未登录打开受保护页面会先去登录、登录后回到原页面；受限身份访问管理页得到 403。
- **多语言与主题**：中英双语（首次访问按浏览器语言选择），代码中直接写中文会被 ESLint 规则拦下，英文界面无遗漏由 e2e 断言；明暗主题下图表、地图、日历、富文本同步切换。
- **构建信息**：页脚显示构建提交与时间，`dist/version.json` 同源，部署后可核对线上版本。
- **无障碍**：`<html lang>` 随语言切换、页面允许缩放；顶栏与看板可键盘操作；图标按钮具可访问名称。
- **浏览器基线**：Chrome 111+ / Firefox 128+ / Safari 16.4+（Tailwind CSS 4）；PDF 需要原生 `Promise.try`（Chrome 128+ / Firefox 134+ / Safari 18.2+）。

## 部署

三条产线的安全响应头基线一致（审计 2026-09-22；CSP 单一来源 [config/csp.ts](./config/csp.ts)，另两份静态副本由测试比对）：`X-Content-Type-Options` / `Referrer-Policy` / `X-Frame-Options` / `Permissions-Policy` / CSP；CSP 来源清单按产物逐域核实（高德、Cesium ion、OSM 瓦片、演示视频 CDN），`'unsafe-eval'` 因 Cesium Knockout 模板编译保留。启用 Clarity 统计的部署需自行在 CSP 中追加 `https://www.clarity.ms` 与 `https://c.bing.com`。

- **GitHub Pages**：push `master` 自动触发 [deploy.yml](./.github/workflows/deploy.yml)（typecheck/test/lint/build 全绿、产物秘钥扫描通过后部署；复制 `404.html` 使子路由直链与刷新可用；部署后等待线上 `version.json` 切到本次提交，再对线上地址跑 `@smoke` 用例）。平台无法自定义响应头，安全头经产物内的 CSP `<meta>` 提供（`config/config.github.ts`）；`X-Frame-Options` 等响应头级的点击劫持防护为平台限制，介意者请用另外两条产线。
- **Vercel**：仓库含 [vercel.json](./vercel.json)（含 SPA rewrite 与安全响应头 `headers`），导入仓库即可；锁文件以 `--frozen-lockfile` 安装。
- **Docker**：见 [Dockerfile](./Dockerfile) 与 [nginx/](./nginx/)（多阶段构建 + nginx 1.30，`docker build` 时通过 `--build-arg CESIUM_ION_TOKEN=` 与 `--build-arg GIT_SHA=$(git rev-parse HEAD)` 传参）。产物文件名带内容哈希，仅哈希文件一年长缓存，入口与 Cesium 等无哈希资源每次协商；CSP 以 `Content-Security-Policy-Report-Only` 观察一个迭代周期后在 `nginx/security-headers.conf` 中转正式。

## 第三方许可说明

本项目按 **MIT** 分发（见 [LICENSE](./LICENSE)），但以下第三方内容**不随 MIT 一并授权**：

- **TinyMCE 8**：GPL-2.0-or-later 或 Tiny 商业许可双轨。本模板**自托管** npm 中的 TinyMCE（随富文本路由的异步 chunk 分发，不依赖 Tiny Cloud 与 API key），编辑器以 `license_key: 'gpl'` 运行。模板按 MIT 分发不等于授予 TinyMCE 闭源商用权利：对外提供包含 TinyMCE 的构建产物即构成分发，须遵守 GPL；闭源商用请购买 Tiny 商业许可，或替换为 TipTap（MIT）/ Quill 2（BSD-3）。仅内部使用等场景的义务请结合自身情况评估。
- **Cesium**：Apache-2.0（构建产物已随附许可副本 `dist/Cesium/LICENSE.md`）。
- **演示媒体**：仓库内的演示音频、PDF、视频封面与业务数据均为项目自制（业务数据由 `src/demo` 在浏览器内以固定种子确定性生成），仅作演示用途；视频播放器页的示例视频运行时引用 xgplayer 官方演示 CDN，不随仓库分发。
- 完整依赖许可清单见 [THIRD-PARTY-NOTICES.md](./THIRD-PARTY-NOTICES.md)。

## 统计与隐私

模板默认**零统计、零埋点**。如需为自己的部署开启 Clarity 统计，配置 `CLARITY_ID` 环境变量即可——数据上报到你自己的 Clarity 账号；Clarity 含会话回放能力，面向公众的站点请依法履行隐私告知/同意义务。

## Contributors ✨

Thanks goes to these wonderful people ([emoji key](https://allcontributors.org/docs/en/emoji-key)):

<!-- npx all-contributors-cli add JerryHub-dev code -->
<!-- npx all-contributors-cli add kingling-abb code -->
<!-- npx all-contributors-cli add cc9971 code  -->

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
<!-- prettier-ignore-start -->
<!-- markdownlint-disable -->
<table>
  <tbody>
    <tr>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/cc9971"><img src="https://avatars.githubusercontent.com/u/85613959?v=4?s=100" width="100px;" alt="chen"/><br /><sub><b>chen</b></sub></a><br /><a href="https://github.com/Jerry-CodeHub/umi-react-admin/commits?author=cc9971" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/kingling-abb"><img src="https://avatars.githubusercontent.com/u/153783999?v=4?s=100" width="100px;" alt="kingling-abb"/><br /><sub><b>kingling-abb</b></sub></a><br /><a href="https://github.com/Jerry-CodeHub/umi-react-admin/commits?author=kingling-abb" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/JerryHub-dev"><img src="https://avatars.githubusercontent.com/u/75985761?v=4?s=100" width="100px;" alt="LiShuai (阿木)"/><br /><sub><b>LiShuai (阿木)</b></sub></a><br /><a href="https://github.com/Jerry-CodeHub/umi-react-admin/commits?author=JerryHub-dev" title="Code">💻</a></td>
    </tr>
  </tbody>
  <tfoot>
    <tr>
      <td align="center" size="13px" colspan="7">
        <img src="https://raw.githubusercontent.com/all-contributors/all-contributors-cli/1b8533af435da9854653492b1327a23a4dbd0a10/assets/logo-small.svg">
          <a href="https://all-contributors.js.org/docs/en/bot/usage">Add your contributions</a>
        </img>
      </td>
    </tr>
  </tfoot>
</table>

<!-- markdownlint-restore -->
<!-- prettier-ignore-end -->

<!-- ALL-CONTRIBUTORS-LIST:END -->

This project follows the [all-contributors](https://github.com/all-contributors/all-contributors) specification. Contributions of any kind welcome!

## License

[MIT](./LICENSE) © 2024-present Li Shuai (Jerry)
