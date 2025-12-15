# Build stage
FROM node:25-alpine as build-step

WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Production stage
FROM node:25-alpine

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
