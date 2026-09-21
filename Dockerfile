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
FROM nginxinc/nginx-unprivileged:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 8080
