FROM node:20-alpine

WORKDIR /app

# Bypass SSL certificate verification (for corporate proxy/firewall)
RUN npm config set strict-ssl false

COPY package*.json ./
RUN npm install --only=production

COPY . .

CMD ["npm", "start"]
