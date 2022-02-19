# Install dependencies
FROM node:16.14-alpine as dependencies
RUN mkdir -p /home/node/app/node_modules && chown -R node:node /home/node/app
WORKDIR /home/node/app
COPY package*.json ./
RUN npm config set unsafe-perm true
USER node
RUN npm ci

# Transpile typescript
FROM dependencies AS builder
COPY --chown=node:node . .
RUN npm run build

# Run app
FROM node:16.14-alpine
RUN mkdir -p /home/node/app/node_modules && chown -R node:node /home/node/app
WORKDIR /home/node/app
COPY package*.json ./
USER node
RUN npm ci --production
COPY --from=builder /home/node/app/dist ./dist

EXPOSE 4330 8000
# https://github.com/nodejs/docker-node/blob/main/docs/BestPractices.md#cmd
CMD [ "node", "--experimental-specifier-resolution=node", "/home/node/app/dist/server/start.js" ]
