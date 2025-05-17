FROM node:18-slim
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 8080
ENV NODE_ENV=production
CMD ["node", "fe-server.js"]