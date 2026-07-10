FROM node:20-alpine

RUN npm install -g pnpm

WORKDIR /app

COPY package*.json ./
RUN pnpm install --frozen-lockfile --prod

COPY . .

USER node

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD node -e "process.exit(0)"

CMD ["pnpm", "start"]
