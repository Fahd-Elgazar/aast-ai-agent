FROM node:20-bookworm-slim

ENV NODE_ENV=production
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

RUN mkdir -p /app/logs /app/data

EXPOSE 8004

CMD ["npm", "run", "start:orchestrator"]
