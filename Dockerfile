# Build stage
FROM node:22-alpine as build-step

WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Production stage
FROM node:22-alpine

# Install Java 8, 17, and 21
# Note: On Alpine:
# openjdk8 -> /usr/lib/jvm/java-1.8-openjdk/bin/java
# openjdk17 -> /usr/lib/jvm/java-17-openjdk/bin/java
# openjdk21 -> /usr/lib/jvm/java-21-openjdk/bin/java
RUN apk add --no-cache openjdk8 openjdk17 openjdk21 zip unzip tar curl

WORKDIR /app/backend
RUN npm install -g npm@11.7.0
COPY backend/package*.json ./
RUN npm install --omit=dev
COPY backend/ ./

# Copy built frontend from build-step
COPY --from=build-step /app/frontend/dist ./public

# Create server directory
RUN mkdir -p minecraft_server

EXPOSE 5000 25565 25565/udp 19132 19132/udp 24454 24454/udp

CMD ["node", "server.js"]
