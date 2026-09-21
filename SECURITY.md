# 安全策略

## 报告漏洞

**请勿使用公开 issue 报告安全问题。** 推荐渠道：

1. GitHub 私有漏洞报告（Settings → Code security → Report a vulnerability）
2. 邮件：lishuai4415@gmail.com（package.json author）

请在报告中包含：影响版本/commit、复现步骤、影响评估。我们会在 **3 个工作日内确认收到**，修复进度会通过原渠道反馈。

## 支持版本

| 版本            | 支持状态 |
| --------------- | -------- |
| master 分支最新 | ✅       |
| 历史 tag        | ❌       |

## 质量门禁

- PR 阶段 CI：typecheck / 严格 lint / vitest / 构建冒烟 / **产物 JWT 泄露扫描** / 依赖审计（观察期）
- 提交阶段：pre-commit（lint-staged + typecheck）
- 仓库卫生测试：可提交文件不含 JWT 形态秘钥与本地工件

## 已知限制

- 仓库内置鉴权为**演示桩**（任意用户名/密码），接入生产前必须替换 mock 三接口与 token 逻辑（见 `src/services/auth.ts` 与 README）。
- 依赖审计中个别组件存在暂无补丁的公告（见 [THIRD-PARTY-NOTICES.md](./THIRD-PARTY-NOTICES.md)「已知接受风险」）。
