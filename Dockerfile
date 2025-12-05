# Multi-stage build Dockerfile for Minecraft Server Panel

# Stage 1: Build React Frontend
FROM node:18-alpine AS frontend-build

WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Stage 2: Production Image
FROM node:18-bullseye

# Install Java for Minecraft servers
RUN apt-get update && \
  apt-get install -y openjdk-17-jre-headless && \
  apt-get clean && \
  rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy backend files
COPY backend/package*.json ./
RUN npm install --production

COPY backend/ ./

# Copy built frontend
COPY --from=frontend-build /app/frontend/dist ./frontend/dist

# Create servers directory
RUN mkdir -p /app/servers

# Set environment variables
ENV NODE_ENV=production
ENV MC_SERVER_BASE_PATH=/app/servers
ENV PORT=5000
EXPOSE 5000
EXPOSE 25565
EXPOSE 19132/udp
EXPOSE 5060

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s \
  CMD node -e "require('http').get('http://localhost:5000', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start server
CMD ["node", "server.js"]
