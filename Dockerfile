# --- Base image ---
FROM node:20-alpine

# --- Create app directory ---
WORKDIR /app

# --- Install dependencies ---
COPY package.json package-lock.json ./
RUN npm install --production

# --- Copy source code ---
COPY . .

# --- Expose port (Back4App uses 3000 by default) ---
EXPOSE 3000

# --- Start the bot ---
CMD ["npm", "run", "dev"]
