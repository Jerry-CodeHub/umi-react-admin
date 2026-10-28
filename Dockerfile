# 不声明 # syntax：本文件只使用默认 frontend 就支持的能力（FROM/ARG/COPY/RUN/WORKDIR/EXPOSE、
# COPY --from 多阶段拷贝、摘要固定的 FROM），无需拉取外部解析器镜像。
# 审计 2026-10 F9：此前的 `# syntax=docker/dockerfile:1` 是可变 tag —— 每次构建隐式联网拉取一个
# 可能随时变化的 frontend 镜像，与两个 base 镜像的摘要固定策略不一致（供应链可变依赖）。
# 若将来确实需要 BuildKit 专属语法（heredoc、RUN --mount=type=secret 等），必须固定到精确版本
# 或摘要（例如 docker/dockerfile:1.7.0@sha256:...），不得再用浮动 tag；
# scripts/dockerfile-frontend.test.ts 会在「用了外部 frontend 能力却没固定」时失败。

# ---------- 阶段一：构建 ----------
FROM node:26-alpine@sha256:40cd011b55415bc894e45b02fdd5a5dfde056921b7d23a64c74f80497af48797 AS builder
WORKDIR /app

# 先装依赖以利用层缓存
# pnpm-workspace.yaml 承载 overrides 与提升配置，缺了它 --frozen-lockfile 会因配置不符而失败
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
# 冻结安装会立即读取 patchedDependencies，补丁必须先于 install 进入构建上下文。
COPY patches ./patches
RUN corepack enable && pnpm install --frozen-lockfile

# 源码与构建（Cesium/高德凭据经 build-arg 注入，最终 define 进产物）
COPY . .
# 凭据经 ARG 注入（RUN 中直接可见）。不落 ENV：ENV 会把值持久化进 builder 镜像层，
# docker history 可见（审计 2026-09-22 L-1；最终运行镜像虽不继承，但没有理由留下这层痕迹）
ARG CESIUM_ION_TOKEN=""
ARG AMAP_KEY=""
ARG AMAP_SECURITY_CODE=""
ARG UMI_APP_DEMO_MODE="false"
ARG UMI_APP_API_BASE=""
# 构建信息：.git 不进构建上下文，提交号经 build-arg 传入（docker build --build-arg GIT_SHA=$(git rev-parse HEAD)）
ARG GIT_SHA=""
# 构建与产物扫描放在同一层（审计 F4）：此前 Docker 产线只构建、从不扫描，凭据与硬编码密钥随镜像发布。
# 扫描失败则该层不落盘，绝不会出现「未扫描的 dist 层」被 COPY 进运行镜像；扫描用的声明值就是本次构建
# 注入的凭据（客户端应用里注入即公开，见 scripts/check-dist-secrets.mjs 的 fail-closed 矩阵）。
# 值不作为 ENV 落盘、也不出现在 RUN 命令文本里（只有变量引用）；但 build-arg 值本身可能被构建器记进
# 构建历史/来源证明，需要更强隔离时应改用 BuildKit secret 挂载（见 SECURITY.md）。
RUN if [ -z "$UMI_APP_API_BASE" ]; then unset UMI_APP_API_BASE; fi; \
    BUILD_TARGET=docker GITHUB_SHA="${GIT_SHA}" pnpm build \
    && EXPECTED_CESIUM_TOKEN="$CESIUM_ION_TOKEN" \
       EXPECTED_AMAP_KEY="$AMAP_KEY" \
       EXPECTED_AMAP_SECURITY_CODE="$AMAP_SECURITY_CODE" \
       node scripts/check-dist-secrets.mjs dist

# ---------- 阶段二：运行（全程非 root） ----------
# 固定到稳定线 1.30 的具体镜像摘要（多架构 index），升级时显式更新 tag 与摘要
FROM nginxinc/nginx-unprivileged:1.31-alpine@sha256:b5047b9b76845eac124358373c6852377c52e4b05834a47647e955dd91cb8f1e

COPY nginx/default.conf /etc/nginx/conf.d/default.conf
COPY nginx/security-headers.conf /etc/nginx/snippets/security-headers.conf
# /api 失败闭合契约的单一来源（default.conf 的 `location ~ ^/api(/|$)` include 它）。
# 缺了这个文件 nginx 会因 include 失败直接起不来——所以 scripts/deploy-routing.test.ts
# 同时断言这里的 COPY 与 default.conf 的 include 成对存在。
COPY nginx/api-fail-closed.conf /etc/nginx/snippets/api-fail-closed.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 8080
