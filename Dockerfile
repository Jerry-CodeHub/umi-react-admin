# syntax=docker/dockerfile:1

# ---------- 阶段一：构建 ----------
FROM node:22-alpine AS builder
WORKDIR /app

# 先装依赖以利用层缓存
COPY package.json pnpm-lock.yaml .npmrc ./
RUN corepack enable && pnpm install --frozen-lockfile

# 源码与构建（Cesium token 经 build-arg 注入，最终 define 进产物）
COPY . .
ARG CESIUM_ION_TOKEN=""
ENV CESIUM_ION_TOKEN=$CESIUM_ION_TOKEN
RUN pnpm build

# ---------- 阶段二：运行（全程非 root） ----------
# 固定到稳定线 1.30 的具体镜像摘要（多架构 index），升级时显式更新 tag 与摘要
FROM nginxinc/nginx-unprivileged:1.30-alpine@sha256:04a3275f25d766cff8926d2e57b2ff34a783d6b12a702dc98bb82226d2d9a508

COPY nginx/default.conf /etc/nginx/conf.d/default.conf
COPY nginx/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 8080
