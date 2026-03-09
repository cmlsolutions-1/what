FROM node:20-slim

# Instalar dependencias necesarias para Chromium
RUN apt-get update && apt-get install -y \
    chromium \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libxshmfence1 \
    libxss1 \
    libxtst6 \
    xdg-utils \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copiar package.json primero (mejor cache de Docker)
COPY package*.json ./

RUN npm install --omit=dev

# Copiar resto del proyecto
COPY . .

# Variable para Puppeteer
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Crear carpeta de sesiones
RUN mkdir -p /app/.wwebjs_auth

EXPOSE 3010

CMD ["npm","run","start"]