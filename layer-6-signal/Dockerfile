# ── Builder ──────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app
RUN npm config set strict-ssl false
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .

# ── Runtime ─────────────────────────────────────────
FROM node:20-alpine AS runtime
RUN apk add --no-cache tini && addgroup -S app && adduser -S app -G app
WORKDIR /app
COPY --from=builder --chown=app:app /app /app
USER app
EXPOSE 8082
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=5 \
    CMD node -e "require('http').get('http://localhost:8082/health',r=>{process.exit(r.statusCode===200?0:1)}).on('error',()=>process.exit(1))"
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "src/index.js"]
