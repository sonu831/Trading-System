FROM node:20-alpine

WORKDIR /app

RUN npm config set strict-ssl false

COPY package*.json ./
RUN npm install --legacy-peer-deps --omit=dev

COPY . .

RUN mkdir -p data/historical && chown -R node:node /app

HEALTHCHECK --interval=30s --timeout=10s --start-period=90s --retries=5 \
  CMD node -e "require('http').get('http://localhost:9101/health',r=>{process.exit(r.statusCode===200?0:1)})"

USER node
EXPOSE 3001

CMD ["npx", "tsx", "src/index.ts"]
