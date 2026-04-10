# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies (only omit dev dependencies, but non-interactive to avoid Playwright download)
# Use CI_SKIP_BROWSER env to avoid Playwright install
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
RUN npm ci

# Copy source code
COPY . .

# Generate SvelteKit types and config
RUN npx svelte-kit sync

# Build the app
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Copy package files
COPY package.json package-lock.json ./

# Install production dependencies only
RUN npm ci --omit=dev && npm cache clean --force

# Copy built app from builder
COPY --from=builder /app/build ./build

# Expose port for Cloud Run
EXPOSE 8080

# Set PORT environment variable for Cloud Run
ENV PORT=8080 NODE_ENV=production

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the app
CMD ["node", "build/index.js"]
