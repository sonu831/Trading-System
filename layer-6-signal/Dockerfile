FROM node:24-alpine AS builder
RUN npm install -g pnpm
WORKDIR /app
COPY package*.json ./
COPY pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile --prod
COPY . .

FROM node:24-alpine AS runtime
RUN apk add --no-cache tini && addgroup -S app && adduser -S app -G app
WORKDIR /app
COPY --from=builder --chown=app:app /app /app
USER app
EXPOSE 8082
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=5 \
    CMD node -e "require('http').get('http://localhost:8082/health',r=>{process.exit(r.statusCode===200?0:1)}).on('error',()=>process.exit(1))"
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "-r", "ts-node/register", "src/index.ts"]
