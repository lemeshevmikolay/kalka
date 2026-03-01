FROM node:18-slim

WORKDIR /app

COPY package*.json ./

RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && npm install --production \
    && apt-get purge -y python3 make g++ \
    && apt-get autoremove -y \
    && rm -rf /var/lib/apt/lists/*

COPY . .

RUN mkdir -p /app/data && chmod 777 /app/data

EXPOSE 3000

LABEL authors="home"

ENTRYPOINT ["npm", "start"]