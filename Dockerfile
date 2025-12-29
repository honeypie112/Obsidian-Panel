# ====================
# Stage 1: Build Frontend
# ====================
FROM node:22-alpine AS frontend-builder

WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# ====================
# Stage 2: Build Rust Backend
# ====================
FROM rust:alpine AS backend-builder

# Install build dependencies
RUN apk add --no-cache musl-dev pkgconfig openssl-dev

WORKDIR /app/backend-rust

# Copy cargo files first for better caching (Cargo.lock is optional)
COPY backend-rust/Cargo.toml ./
# Copy Cargo.lock if it exists (glob pattern makes it optional)
COPY backend-rust/Cargo.loc[k] ./ || true

# Create dummy src to build dependencies  
RUN mkdir src && echo "fn main() {}" > src/main.rs
RUN cargo build --release && rm -rf src

# Copy actual source and build
COPY backend-rust/src ./src
RUN touch src/main.rs && cargo build --release

# ====================
# Stage 3: Production Runtime
# ====================
FROM alpine:3.20

# Install Java 8, 17, 21 and required tools
# Alpine paths:
# openjdk8  -> /usr/lib/jvm/java-1.8-openjdk/bin/java
# openjdk17 -> /usr/lib/jvm/java-17-openjdk/bin/java
# openjdk21 -> /usr/lib/jvm/java-21-openjdk/bin/java
RUN apk add --no-cache \
    openjdk8 \
    openjdk17 \
    openjdk21 \
    zip \
    unzip \
    tar \
    curl \
    ca-certificates \
    libgcc

WORKDIR /app

# Copy Rust backend binary
COPY --from=backend-builder /app/backend-rust/target/release/obsidian-panel-backend ./

# Copy frontend build
COPY --from=frontend-builder /app/frontend/dist ./public

# Create required directories
RUN mkdir -p /minecraft_server /tmp/obsidian_backups

# Environment variables
ENV PORT=5000 \
    HOST=0.0.0.0 \
    MC_SERVER_BASE_PATH=/minecraft_server \
    TEMP_BACKUP_PATH=/tmp/obsidian_backups \
    FRONTEND_URL=http://localhost:5173 \
    RUST_LOG=info

# Expose ports
# 5000 - Backend API/Frontend
# 25565 - Minecraft Java Edition
# 19132 - Minecraft Bedrock Edition
# 24454 - Minecraft RCON
EXPOSE 5000 25565 25565/udp 19132 19132/udp 24454 24454/udp

# Run the Rust backend
CMD ["./obsidian-panel-backend"]
