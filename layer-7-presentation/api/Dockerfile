FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy source code
COPY . .

EXPOSE 4000

# Run as non-root user
USER node

CMD ["node", "src/index.js"]
