# syntax=docker/dockerfile:1

# ---------- 阶段一：构建 ----------
FROM node:24-alpine@sha256:ebfe2f90462722a7a4de65e91990e97fe0d401c70e0e762c5b53302f905ec1c1 AS builder
WORKDIR /app

# 先装依赖以利用层缓存
# pnpm-workspace.yaml 承载 overrides 与提升配置，缺了它 --frozen-lockfile 会因配置不符而失败
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN corepack enable && pnpm install --frozen-lockfile

# 源码与构建（Cesium token 经 build-arg 注入，最终 define 进产物）
COPY . .
# token 经 ARG 注入（RUN 中直接可见）。不落 ENV：ENV 会把值持久化进 builder 镜像层，
# docker history 可见（审计 2026-09-22 L-1；最终运行镜像虽不继承，但没有理由留下这层痕迹）
ARG CESIUM_ION_TOKEN=""
RUN pnpm build

# ---------- 阶段二：运行（全程非 root） ----------
# 固定到稳定线 1.30 的具体镜像摘要（多架构 index），升级时显式更新 tag 与摘要
FROM nginxinc/nginx-unprivileged:1.30-alpine@sha256:04a3275f25d766cff8926d2e57b2ff34a783d6b12a702dc98bb82226d2d9a508

COPY nginx/default.conf /etc/nginx/conf.d/default.conf
COPY nginx/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 8080
