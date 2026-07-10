FROM node:20-alpine

WORKDIR /app

# Bypass SSL certificate verification (for corporate proxy/firewall)
RUN npm config set strict-ssl false

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

# Run as non-root user
USER node

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD node -e "process.exit(0)"

CMD ["npm", "start"]
