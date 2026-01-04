# ====================
# Stage 1: Build Frontend
# ====================
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

# Install dependencies needed for build
COPY frontend/package*.json ./
RUN npm ci

# Copy source and build
COPY frontend/ ./
RUN npm run build

# ====================
# Stage 2: Setup Backend
# ====================
FROM node:20-alpine AS backend-setup

WORKDIR /app/backend

COPY backend/package*.json ./
RUN npm ci --only=production

# ====================
# Stage 3: Final Production Image
# ====================
FROM node:20-alpine

# Install System Dependencies including Multiple Java Versions (JRE only)
# Alpine requires testing/community repos for some openjdk versions
RUN echo "http://dl-cdn.alpinelinux.org/alpine/edge/community" >> /etc/apk/repositories && \
    apk update && \
    apk add --no-cache \
    bash \
    curl \
    zip \
    unzip \
    openjdk8 \
    openjdk17 \
    openjdk21

# Create app directory
WORKDIR /app

# Setup Java Home Variables so the backend can find them
ENV JAVA_8_HOME=/usr/lib/jvm/java-1.8-openjdk
ENV JAVA_17_HOME=/usr/lib/jvm/java-17-openjdk
ENV JAVA_21_HOME=/usr/lib/jvm/java-21-openjdk

# Copy Backend Dependencies and Code
COPY --from=backend-setup /app/backend/node_modules ./node_modules
COPY backend/ ./

# Copy Frontend Build to public directory
COPY --from=frontend-builder /app/frontend/dist ./public

# Create server directories and set permissions
RUN mkdir -p /minecraft_server /tmp/obsidian_backups && \
    chown -R node:node /minecraft_server /tmp/obsidian_backups /app

# Switch to non-root user
USER node

# Environment Variables
ENV PORT=5000 \
    NODE_ENV=production

# Inject Build Date
ARG BUILD_DATE
ENV BUILD_DATE=$BUILD_DATE \
    MC_SERVER_BASE_PATH=/minecraft_server \
    TEMP_BACKUP_PATH=/tmp/obsidian_backups

# Expose Ports
EXPOSE 5000 25565 19132 24454

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:5000/api/auth/status || exit 1

# Start Server
CMD ["node", "server.js"]
