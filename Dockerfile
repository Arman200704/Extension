FROM node:18

WORKDIR /app

COPY package*.json ./

RUN npm install

# Install Chromium and dbus
RUN apt-get update && \
    apt-get install -y chromium dbus && \
    rm -rf /var/lib/apt/lists/*

# Set environment variables for Chromium
ENV CHROME_BIN=/usr/bin/chromium \
    CHROME_PATH=/usr/lib/chromium/

COPY . .

# Start dbus service when running the container
CMD ["sh", "-c", "service dbus start && npm start"]

EXPOSE 3125
