FROM node:20-alpine
WORKDIR /app

COPY package.json tsconfig.base.json ./
COPY apps ./apps
COPY packages ./packages
COPY prisma ./prisma

RUN npm install
RUN npm run db:generate

CMD ["npm","run","dev","-w","api-gateway"]
