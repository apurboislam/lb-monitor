FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

RUN apk add --no-cache python3 make g++ vnstat

COPY . .

EXPOSE 3000

CMD ["node", "src/server.js"]
