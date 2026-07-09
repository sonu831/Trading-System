FROM node:20-alpine
WORKDIR /app
RUN npm config set strict-ssl false
COPY package*.json ./
RUN npm install --only=production
COPY . .
USER node
EXPOSE 8095
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=5 \
    CMD node -e "require('http').get('http://localhost:8095/health',r=>{process.exit(r.statusCode===200?0:1)})"
CMD ["node", "src/index.js"]
