# umi-react-admin

<!-- ALL-CONTRIBUTORS-BADGE:START - Do not remove or modify this section -->

[![All Contributors](https://img.shields.io/badge/all_contributors-3-orange.svg?style=flat-square)](#contributors-)

<!-- ALL-CONTRIBUTORS-BADGE:END -->

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE) [![CI](https://github.com/Jerry-CodeHub/umi-react-admin/actions/workflows/ci.yml/badge.svg)](https://github.com/Jerry-CodeHub/umi-react-admin/actions/workflows/ci.yml) [![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](./CONTRIBUTING.md)

`umi-react-admin` 是一个基于 `react` 和 `umi max` 的模板系统, 一款开源免费且开箱即用的系统模板, 使用了最新的 `Umi4.x`, `React18.x` , `antd5.x` , `Tailwindcss` , `CSS in JS` , `TypeScript` , `ProComponents` 等主流技术开发。

**[在线演示](https://jerry-codehub.github.io/umi-react-admin/)**（演示环境：任意用户名/密码登录）

目前已包括 `日历`, `富文本(tinymce)`, `拖放界面`, `地图(Cesium, 高德, OpenLayers)`, `地理空间计算(turf)`, `图表可视化(@ant-design/plots, D3)`, `PDF/Excel 办公处理`, `音频/视频播放器`, `音频可视化`, `签名`, `暗色模式`, `多语言` 等模块功能。

## 环境要求

- Node.js 22（见 [.nvmrc](./.nvmrc)，推荐使用 nvm 管理）
- pnpm 10+（`packageManager` 字段已钉住版本）
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
| `UMI_APP_API_BASE` | 可选 | 真实后端 API 地址；不配置时开发环境走 umi mock、纯静态部署走内置静态演示数据（表格 CRUD 经 localStorage 持久化） |
| `CLARITY_ID` | 可选 | [Clarity](https://clarity.microsoft.com) 统计项目 ID；**模板默认不含任何统计脚本**，配置后才按你自己的项目上报（含会话回放，正式站点请履行隐私告知义务） |

## 常用脚本

```bash
pnpm start            # 启动开发服务器 (端口 8000)
pnpm build            # 生产构建
pnpm build:github     # GitHub Pages 构建
pnpm preview          # 构建并预览 (端口 8001)
pnpm check            # typecheck + 严格 lint + vitest（提交前必跑）
pnpm test             # vitest 单测
pnpm size             # 构建并执行体积预算门禁
pnpm analyze          # 构建并生成 bundle 组成分析
pnpm format           # Prettier 格式化代码
```

## 目录结构

```
src/
├── pages/            # 页面组件（路由对应，config/routes.ts）
├── components/       # 可复用组件（ErrorBoundary）
├── layouts/          # 布局组件（顶栏 RightContent）
├── models/           # 全局数据模型 (hooks)
├── services/         # API 服务层（auth + demo 数据适配层）
├── utils/            # 工具函数（请求配置/BizError/地图计算）
├── locales/          # 国际化文件 (zh-CN, en-US)
└── constants/        # 常量定义
```

## 功能说明

- **鉴权**：演示级登录闭环（任意用户名/密码），路由守卫与权限拦截开箱可用；接入真实后端仅需替换 mock 三接口并配置 `UMI_APP_API_BASE`（见 `src/services/auth.ts`）。用户名 `dontHaveAccess` 可体验权限拦截。
- **暗色模式**：顶栏调色盘图标热切换（antd5 算法 + 布局联动，localStorage 持久化）。地图与图表等非 AntD 绘制区域暂不随算法变化。
- **多语言**：框架层页面（登录/错误页/全局提示）中英双语；功能演示页文案为中文示例。
- **无障碍**：图标按钮具可访问名称、图片有 alt、AntD 组件自带键盘能力；自定义键盘导航不在当前范围。

## 部署

- **GitHub Pages**：push `master` 自动触发 [deploy.yml](./.github/workflows/deploy.yml)（typecheck/test/lint/build 全绿后部署）。
- **Vercel**：仓库含 [vercel.json](./vercel.json)，导入仓库即可；锁文件以 `--frozen-lockfile` 安装。
- **Docker**：见 [Dockerfile](./Dockerfile)（多阶段构建 + nginx，`docker build` 时通过 `--build-arg CESIUM_ION_TOKEN=` 传参）。

## 第三方许可说明

本项目按 **MIT** 分发（见 [LICENSE](./LICENSE)），但以下第三方内容**不随 MIT 一并授权**：

- **TinyMCE 8**：GPL-2.0-or-later 或 Tiny 商业许可双轨。本模板**自托管** npm 中的 TinyMCE（随富文本路由的异步 chunk 分发，不依赖 Tiny Cloud 与 API key），编辑器以 `license_key: 'gpl'` 运行。模板按 MIT 分发不等于授予 TinyMCE 闭源商用权利：对外提供包含 TinyMCE 的构建产物即构成分发，须遵守 GPL；闭源商用请购买 Tiny 商业许可，或替换为 TipTap（MIT）/ Quill 2（BSD-3）。仅内部使用等场景的义务请结合自身情况评估。
- **Cesium**：Apache-2.0（构建产物已随附许可副本 `dist/Cesium/LICENSE.md`）。
- **演示媒体**：本仓库内的演示音视频/PDF/数据文件为项目自制，仅作演示用途。
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
