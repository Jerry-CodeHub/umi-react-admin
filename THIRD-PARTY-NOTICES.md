# 第三方许可与资源说明

本项目按 MIT 分发（见 [LICENSE](./LICENSE)）。本文件汇总分发物中涉及的第三方组件与资源。

## 依赖许可汇总

直接依赖以宽松许可为主，完整传递依赖清单可通过 `pnpm licenses list --prod` 生成查看。关键组件：

| 组件 | 许可 | 说明 |
| --- | --- | --- |
| React / antd / @ant-design/\* / @umijs/max | MIT |  |
| Cesium | Apache-2.0 | 构建产物随附许可副本（`dist/Cesium/LICENSE.md`），满足 Apache-2.0 第 4 条再分发要求 |
| TinyMCE 8 | GPL-2.0-or-later / Tiny 商业双许可 | 自托管：随构建产物分发（仅富文本路由的异步 chunk），编辑器以 `license_key: 'gpl'` 运行；对外提供含 TinyMCE 的产物即构成分发，须遵守 GPL，闭源商用请购买 Tiny 许可或替换（见 README「第三方许可说明」） |
| @turf/union、@turf/helpers | MIT | 按需引入；已避免整包 `@turf/turf` 带来的 AGPL（marchingsquares）/EPL（jsts）传递组件 |
| OpenLayers | BSD-2-Clause |  |
| xgplayer / xgplayer-music / wavesurfer.js | MIT | 视频播放器页的示例视频/海报运行时引用 xgplayer 官方演示 CDN；音频页使用项目自制素材 |
| exceljs | MIT | Excel 演示页动态加载 |
| react-pdf（pdfjs-dist） | Apache-2.0 | cmaps/standard_fonts 随构建产物分发（pdfjs-dist 同为 Apache-2.0） |

## 演示资源清单

| 资源 | 来源 | 许可 |
| --- | --- | --- |
| `public/demo.pdf` | 项目自制（脚本生成的矢量示例文档） | 随项目 MIT |
| `public/audio/audio.wav`、`public/audio/stereo.wav` | 项目自制（正弦合成音频） | 随项目 MIT |
| `public/data/*.json`、`public/data/users.json` | 项目自制演示数据 | 随项目 MIT |
| `public/data/charts/*.json` | 项目自制，由 `scripts/generate-chart-data.mjs` 以固定种子确定性生成（可复现） | 随项目 MIT |
| 音频播放器页的歌词与唱片/背景 | 项目自制（自写示例 LRC；唱片与背景为纯 CSS 绘制） | 随项目 MIT |
| 视频播放器页示例视频/海报 | xgplayer 官方演示 CDN（字节跳动文档示例资源） | 页面运行时引用，不随仓库分发 |

> 历史版本曾携带的 `react-dev.pdf`（疑似 React 官方文档，版权属 Meta）、来源不明音频与视频已在治理中替换/移除；音频播放器页此前热链的商业歌曲、专辑封面及随仓库分发的完整歌词，以及首页图表取自 AntV 示例的第三方数据（股价、气温距平），均已于 2026-09 替换为项目自制内容。

## 已知接受风险

依赖审计策略（2026-09-22 起）：CI 以 `pnpm audit --prod --audit-level=high` 阻断 high 及以上；以下 moderate/low 公告经评估登记接受：

- `image-size`（high，**已消解**）：仅构建链使用。已通过 `"less@<4.9.1": "4.9.1"` override 升级 less（4.9.1 起改用 probe-image-size）消除。
- `react-router@6.30.4` ×2（moderate）：反斜杠 open redirect 与 SSR hydration 注入。6.x 无补丁（修复在 7.18.0），受 @umijs/max 4 约束无法升级；本项目所有路由跳转目标均为代码常量、纯 SPA 无 SSR，实际不可利用。umi 升级 5/react-router 7 时一并闭环。
- `uuid@8.3.2`（moderate）：exceljs 传递依赖，仅 v3/v5/v6 且调用方传自定义 buffer 才触发，exceljs 内部只用 v4，不受影响。
- `decode-uri-component@0.2.2`（moderate）：@umijs/history 传递依赖，畸形 percent-encoding 的 DoS，需超长构造串，风险低。
- `postcss-selector-parser` / `elliptic`（low）：构建链与 webpack polyfill 链，无补丁或无运行时暴露。
