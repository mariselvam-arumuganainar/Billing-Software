FROM node:20-alpine

RUN apk add --no-cache openssl

WORKDIR /app

# Install the shared database package (api-gateway depends on it via file:)
COPY packages/database/package*.json packages/database/
RUN cd packages/database && npm install

COPY packages/database/ packages/database/

# Install api-gateway dependencies
COPY services/api-gateway/package*.json services/api-gateway/
RUN cd services/api-gateway && npm install

COPY services/api-gateway/ services/api-gateway/

# Generate Prisma client
RUN cd packages/database && npx prisma generate

WORKDIR /app/services/api-gateway

EXPOSE 4000

# Run DB migrations then start the server
CMD sh -c "cd /app/packages/database && npx prisma migrate deploy && cd /app/services/api-gateway && npm run dev"
