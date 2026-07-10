FROM node:20-alpine

WORKDIR /app

# Bypass SSL certificate verification (for corporate proxy/firewall)
RUN npm config set strict-ssl false

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

# Run as non-root user
USER node

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD node -e "require('http').get('http://localhost:7001/health',r=>{process.exit(r.statusCode===200?0:1)}).on('error',()=>process.exit(1))"

CMD ["npm", "start"]
