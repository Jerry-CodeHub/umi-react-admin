# 安全策略

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

- PR 阶段 CI：typecheck / 严格 lint（含 .mjs）/ vitest（含演示数据合理性与 CSP 一致性）/ 两条产线构建冒烟 / 体积预算与样式覆盖门禁 / **产物 JWT 泄露扫描**（放行 Cesium 自带的公开默认 ion token，只输出指纹）/ 依赖审计 / Playwright 浏览器冒烟（逐页断言无 CSP 违规）
- 部署后：等待线上 `version.json` 切到本次提交，对线上地址跑 `@smoke` 用例
- 提交阶段：pre-commit（lint-staged + typecheck）
- 仓库卫生测试：可提交文件不含 JWT 形态秘钥与本地工件

## 已知限制

- 仓库内置鉴权为**演示桩**：未配置 `UMI_APP_API_BASE` 时由浏览器内的演示后端（`src/demo`）签发与校验 token（任意用户名/密码，不具备任何安全性）。接入生产前必须替换为真实后端（配置 `UMI_APP_API_BASE`，按 `src/services/types.ts` 的契约实现接口），演示后端代码随之不再加载。
- 登录 token 存放在 localStorage，存在 XSS 窃取面；生产环境建议改为 HttpOnly Cookie 等方案。
- Docker 镜像默认未启用 CSP（地图与第三方资源来源较多），上线前请按实际来源在 `nginx/security-headers.conf` 中收敛后启用。
- 依赖审计中个别组件存在暂无补丁的公告（见 [THIRD-PARTY-NOTICES.md](./THIRD-PARTY-NOTICES.md)「已知接受风险」）。
