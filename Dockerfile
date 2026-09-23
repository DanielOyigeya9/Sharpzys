# Production Dockerfile for FlyNow Flight Booking
FROM node:20-alpine AS builder

WORKDIR /app

# We do not use Playwright at runtime (all providers are HTTP); skip the heavy
# Chromium download so `npm ci` doesn't hang or fail the build.
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

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
# Do NOT hardcode PORT: Railway injects its own PORT at runtime, which the app
# reads via process.env.PORT. A fixed value here can shadow it and break routing.
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

COPY package*.json ./
RUN npm ci --omit=dev

# Copy built frontend assets and server codebase
COPY --from=builder /app/client/dist ./client/dist
COPY --from=builder /app/server ./server

EXPOSE 5000

CMD ["npm", "start"]
