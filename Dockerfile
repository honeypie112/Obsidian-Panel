# Build stage
FROM node:22-alpine as build-step

WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Production stage
FROM node:22-alpine

# Install Java 21, 17, and 8 to support all Minecraft versions
RUN apk add --no-cache openjdk8 openjdk17 openjdk21

WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm install --production
COPY backend/ ./

# Copy built frontend from build-step
COPY --from=build-step /app/frontend/dist ./public

# Create server directory
RUN mkdir -p minecraft_server

EXPOSE 5000

CMD ["node", "server.js"]
