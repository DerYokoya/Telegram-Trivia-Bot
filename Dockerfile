FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Compile TypeScript
RUN npm run build

EXPOSE 3000

# Start production server
CMD ["node", "dist/server.js"]
