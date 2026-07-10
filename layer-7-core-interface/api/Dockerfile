FROM node:20-alpine
RUN npm install -g pnpm pm2

WORKDIR /app

COPY package*.json ./
COPY pnpm-lock.yaml* ./
COPY prisma ./prisma/

RUN pnpm install --frozen-lockfile

RUN NODE_TLS_REJECT_UNAUTHORIZED=0 pnpm exec prisma generate

COPY . .

EXPOSE 4000

USER node

HEALTHCHECK --interval=30s --timeout=10s --start-period=90s --retries=5 \
    CMD node -e "require('http').get('http://localhost:4000/health',r=>{process.exit(r.statusCode===200?0:1)})"

CMD ["pm2-runtime", "ecosystem.config.js"]
