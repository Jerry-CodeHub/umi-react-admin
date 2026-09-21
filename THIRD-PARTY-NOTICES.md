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
| xgplayer / wavesurfer.js / artplayer（已移除） | MIT | 演示页播放器视频/海报素材走第三方 CDN，不随本仓库分发 |
| exceljs | MIT | Excel 演示页动态加载 |
| react-pdf（pdfjs-dist） | Apache-2.0 | cmaps/standard_fonts 随构建产物分发（pdfjs-dist 同为 Apache-2.0） |

## 演示资源清单

| 资源 | 来源 | 许可 |
| --- | --- | --- |
| `public/demo.pdf` | 项目自制（脚本生成的矢量示例文档） | 随项目 MIT |
| `public/audio/audio.wav`、`public/audio/stereo.wav` | 项目自制（正弦合成音频） | 随项目 MIT |
| `public/data/*.json`、`public/data/users.json` | 项目自制演示数据 | 随项目 MIT |
| 播放器演示视频/海报 | xgplayer 演示 CDN（字跳动文档示例资源） | 页面运行时引用，不随仓库分发 |

> 历史版本曾携带的 `react-dev.pdf`（疑似 React 官方文档，版权属 Meta）、来源不明音频与视频已在治理中替换/移除。

## 已知接受风险

以下依赖公告在写作时尚无补丁版本可用，作为已知接受风险登记（随上游发布补丁后升级消解）：

- `image-size`（high）：仅构建链使用，不进入运行产物。
