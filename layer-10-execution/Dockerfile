FROM node:20-alpine AS builder
WORKDIR /app
RUN npm config set strict-ssl false
COPY package*.json ./
RUN npm install --legacy-peer-deps --omit=dev
COPY . .

FROM node:20-alpine AS runtime
RUN apk add --no-cache tini && addgroup -S app && adduser -S app -G app
WORKDIR /app
COPY --from=builder --chown=app:app /app /app
USER app
EXPOSE 8095
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=5 \
    CMD node -e "require('http').get('http://localhost:8095/health',r=>{process.exit(r.statusCode===200?0:1)}).on('error',()=>process.exit(1))"
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["npx", "tsx", "src/index.ts"]
