FROM node:20-alpine

WORKDIR /app

RUN npm config set strict-ssl false

COPY package*.json ./
COPY prisma ./prisma/

RUN npm install --legacy-peer-deps && npm install fastify@5 --save-exact && npm install pm2 -g

RUN NODE_TLS_REJECT_UNAUTHORIZED=0 npx prisma generate

COPY . .

EXPOSE 4000

USER node

HEALTHCHECK --interval=30s --timeout=10s --start-period=90s --retries=5 \
    CMD node -e "require('http').get('http://localhost:4000/health',r=>{process.exit(r.statusCode===200?0:1)}).on('error',()=>process.exit(1))"

CMD ["npx", "tsx", "src/index.ts"]
