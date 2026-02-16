FROM node:20-slim

WORKDIR /action

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src/ ./src/

RUN npx ncc build src/index.ts -o dist

ENTRYPOINT ["node", "/action/dist/index.js"]
