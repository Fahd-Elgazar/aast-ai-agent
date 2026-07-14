FROM node:20-bookworm-slim AS build

WORKDIR /app

ARG VITE_API_BASE=/api
ENV VITE_API_BASE=$VITE_API_BASE

COPY package*.json ./
RUN npm ci --legacy-peer-deps

COPY . .
RUN npm run build

FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 5173

HEALTHCHECK --interval=20s --timeout=5s --retries=5 --start-period=20s \
  CMD wget -qO- http://127.0.0.1:5173/ >/dev/null || exit 1
