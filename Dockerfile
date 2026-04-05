# Step 1: Use a slim Node image
FROM node:20-slim

# Step 2: Install Puppeteer dependencies
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    xdg-utils \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Step 3: Set Puppeteer environment variables
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Step 4: Set working directory
WORKDIR /app

# Step 5: Copy package files and install dependencies
COPY package*.json ./
COPY prisma ./prisma

RUN npm install

# Step 6: Copy source code
COPY . .

# Step 7: Build the project
# RUN npm run build

# Step 8: Expose port
EXPOSE 9000

# Step 9: Run the compiled NestJS app
# CMD ["node", "dist/src/main.js"]
CMD ["npm", "run", "start:dev"]