FROM node:20-alpine

WORKDIR /app

# Bypass SSL for npm at build time only (corporate proxy)
RUN npm config set strict-ssl false

# Install dependencies
COPY package*.json ./
RUN npm install --only=production

# Copy source code
COPY . .

# Create data directory and set permissions
RUN mkdir -p data/historical && chown -R node:node /app

# Health check (node-based, no GNU wget dependency)
HEALTHCHECK --interval=30s --timeout=10s --start-period=90s --retries=5 \
  CMD node -e "require('http').get('http://localhost:9101/health',r=>{process.exit(r.statusCode===200?0:1)})"

# Run as non-root user
USER node

EXPOSE 3001

CMD ["node", "src/index.js"]
