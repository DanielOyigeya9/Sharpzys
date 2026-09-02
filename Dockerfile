# Production Dockerfile for FlyNow Flight Booking
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency manifests
COPY package*.json ./
RUN npm ci

# Copy source code and build frontend bundle
COPY . .
RUN npm run build

# Production image
FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=5000

COPY package*.json ./
RUN npm ci --only=production

# Copy built frontend assets and server codebase
COPY --from=builder /app/client/dist ./client/dist
COPY --from=builder /app/server ./server

EXPOSE 5000

CMD ["npm", "start"]
