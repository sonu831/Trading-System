FROM node:20-alpine

WORKDIR /app

# Bypass SSL certificate verification (for corporate proxy/firewall)
RUN npm config set strict-ssl false

# Install dependencies
COPY package*.json ./
COPY prisma ./prisma/

# Install all dependencies (including dev for prisma CLI)
RUN npm install --legacy-peer-deps && npm install fastify@5 --save-exact

# Generate Prisma Client (disable SSL verification for binary download)
RUN NODE_TLS_REJECT_UNAUTHORIZED=0 npx prisma generate

# Copy source code
COPY . .

EXPOSE 4000

# Run as non-root user
USER node

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:4000/health || exit 1

CMD ["node", "src/index.js"]
