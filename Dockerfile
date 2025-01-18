FROM node:18

WORKDIR /app

COPY package*.json ./

RUN npm install

RUN apt-get update && \
    apt-get install -y chromium && \
    chmod +x /usr/bin/chromium && \
    rm -rf /var/lib/apt/lists/*

ENV CHROME_BIN=/usr/bin/chromium \
    CHROME_PATH=/usr/lib/chromium/

COPY . .

EXPOSE 3125

CMD ["npm", "start"]
