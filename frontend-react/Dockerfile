# 前端部署镜像（多阶段构建）
FROM node:20-slim AS build
WORKDIR /app
RUN npm i -g pnpm
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
# 同源部署：前端请求 /api 由 Caddy 反代到后端，无需跨域 base
ENV NEXT_PUBLIC_API_URL=
COPY . .
RUN pnpm build

FROM node:20-slim
WORKDIR /app
RUN npm i -g pnpm
COPY --from=build /app/package.json /app/pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/next.config.mjs ./
ENV NODE_ENV=production PORT=3000
EXPOSE 3000
CMD ["pnpm", "start"]
