# Install dependencies
FROM node:14-alpine as dependencies
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
FROM node:14-alpine
RUN mkdir -p /home/node/app/node_modules && chown -R node:node /home/node/app
WORKDIR /home/node/app
COPY package*.json ./
USER node
RUN npm ci --production
COPY --from=builder /home/node/app/dist ./dist
# Only used for local dev
# heroku doesn't even support volumes
VOLUME [
    # for self signed https certs
    # some browser APIs (like geolocation) need https to work
    "/home/node/app/secret",
    # to test code changes without rebuilding image
    "/home/node/app/dist",
]

ARG NODE_ENV

EXPOSE 3000
CMD [ "node", "./dist/server/start.js" ]