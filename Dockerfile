FROM node:22-slim

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 3000

LABEL authors="home"

ENTRYPOINT ["npm", "start"]