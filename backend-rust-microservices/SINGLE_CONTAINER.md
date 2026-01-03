# Single-Container Deployment Guide

## 📦 What This Is

A **simplified deployment** that runs both Gateway and Worker services in a **single Docker container** using **supervisord** as a process manager.

---

## ⚠️ Trade-offs: Single vs Multi-Container

### ❌ What You LOSE

| Feature | Multi-Container | Single-Container |
|---------|----------------|------------------|
| **Independent Scaling** | ✅ Scale workers separately (`--scale worker=5`) | ❌ Must scale entire container |
| **Fault Isolation** | ✅ Worker crash doesn't affect Gateway | ❌ Any crash can affect both |
| **Resource Limits** | ✅ Different CPU/memory per service | ❌ Shared resources |
| **Separate Logs** | ✅ `docker logs gateway` / `worker` | ⚠️ Combined in supervisord logs |
| **Rolling Updates** | ✅ Update services independently | ❌ Must restart everything |
| **Health Monitoring** | ✅ Per-service health checks | ⚠️ Single health check |

### ✅ What You GAIN

| Benefit | Single-Container |
|---------|------------------|
| **Simplicity** | One container to manage |
| **Lower Overhead** | ~50MB less memory (no duplicate deps) |
| **Faster Startup** | No network setup between containers |
| **Easier Deployment** | Single image to push/pull |

---

## 🚀 How to Use

### Build and Run

```bash
cd backend-rust-microservices

# Build the single container
docker build -f Dockerfile.single -t obsidian-panel:single .

# Run with docker-compose
docker-compose -f docker-compose.single.yml up
```

### Access

- **Application**: http://localhost:3000
- **MongoDB**: mongodb://localhost:27017

### View Logs

```bash
# Combined logs
docker-compose -f docker-compose.single.yml logs obsidian-panel

# From inside container
docker exec obsidian-panel-all-in-one tail -f /var/log/supervisor/gateway.out.log
docker exec obsidian-panel-all-in-one tail -f /var/log/supervisor/worker.out.log
```

### Restart Individual Services

```bash
# Restart just the worker (without restarting gateway)
docker exec obsidian-panel-all-in-one supervisorctl restart worker

# Restart gateway
docker exec obsidian-panel-all-in-one supervisorctl restart gateway

# Check status
docker exec obsidian-panel-all-in-one supervisorctl status
```

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────┐
│  Docker Container: obsidian-panel           │
│                                             │
│  ┌────────────────────────────────────────┐ │
│  │  Supervisord (Process Manager)         │ │
│  └────────────────────────────────────────┘ │
│                                             │
│  ┌──────────────┐      ┌─────────────────┐ │
│  │  Gateway     │      │  Worker         │ │
│  │  (Port 3000) │◄────►│  (Internal)     │ │
│  │              │ ZMQ  │                 │ │
│  │  • HTTP      │ TCP  │  • REP :5555    │ │
│  │  • WebSocket │ 127  │  • PULL :5556   │ │
│  │              │ .0.  │  • PUB :5557    │ │
│  │  • REQ       │ 0.1  │                 │ │
│  │  • PUSH      │      │  • MongoDB      │ │
│  │  • SUB       │      │  • Logic        │ │
│  └──────────────┘      └─────────────────┘ │
│                                             │
│  Logs: /var/log/supervisor/                │
└─────────────────────────────────────────────┘
         │
         ▼
   ┌─────────────┐
   │  MongoDB    │
   │  Container  │
   └─────────────┘
```

**Key Point**: ZeroMQ uses `127.0.0.1` (localhost) instead of service names since both processes are in the same container.

---

## 📊 When to Use Single-Container

### ✅ Good For:

- **Hobby projects** / personal use
- **Demos** / proof of concepts
- **Low-traffic applications** (<1k req/s)
- **Simple VPS deployments** (no orchestration)
- **Development/testing** on resource-constrained machines

### ❌ Not Recommended For:

- **Production workloads** with high traffic
- **Scenarios requiring horizontal scaling**
- **Microservices best practices** (defeats the purpose)
- **Systems where downtime is critical**
- **Multi-tenant environments**

---

## 🔧 Monitoring & Debugging

### Check Process Status

```bash
docker exec obsidian-panel-all-in-one supervisorctl status
```

Output:
```
gateway                          RUNNING   pid 15, uptime 0:05:23
worker                           RUNNING   pid 14, uptime 0:05:24
```

### View Real-time Logs

```bash
# Gateway logs
docker exec obsidian-panel-all-in-one tail -f /var/log/supervisor/gateway.out.log

# Worker logs
docker exec obsidian-panel-all-in-one tail -f /var/log/supervisor/worker.out.log

# Error logs
docker exec obsidian-panel-all-in-one tail -f /var/log/supervisor/worker.err.log
```

### Restart on Crash

Supervisord automatically restarts crashed processes. Check config:

```ini
autorestart=true  # Will restart if process exits
```

---

## 🔄 Migration Path

### From Single to Multi-Container (When You Need Scale)

1. **No code changes needed!** The binaries are the same.
2. Switch docker-compose files:
   ```bash
   # Stop single container
   docker-compose -f docker-compose.single.yml down
   
   # Start multi-container
   docker-compose up
   ```

3. Update environment variables to use service names:
   ```bash
   # In multi-container .env
   WORKER_REQ_ENDPOINT=tcp://worker:5555  # not 127.0.0.1
   ```

---

## 📈 Resource Usage Comparison

### Memory (Typical)

| Setup | Memory Usage |
|-------|-------------|
| Single Container | ~150MB (combined) |
| Multi-Container | ~200MB (50MB + 50MB + 100MB overhead) |
| **Savings** | **~25% less memory** |

### Disk Space

| Setup | Image Size |
|-------|-----------|
| Single Container | ~180MB |
| Multi-Container (both images) | ~240MB |

---

## 🐛 Troubleshooting

### Gateway Can't Connect to Worker

**Symptom**: `Failed to send to Worker: Connection refused`

**Fix**: Ensure ZeroMQ binds to `127.0.0.1`, not `0.0.0.0`:
```conf
# In supervisord.conf
REQ_BIND_ADDR="tcp://127.0.0.1:5555"  # ✅ Correct
REQ_BIND_ADDR="tcp://0.0.0.0:5555"    # ❌ Wrong (can cause issues)
```

### Process Won't Start

```bash
# Check supervisord logs
docker exec obsidian-panel-all-in-one cat /var/log/supervisor/supervisord.log

# Check specific service
docker exec obsidian-panel-all-in-one supervisorctl tail worker stderr
```

### MongoDB Connection Issues

Ensure MongoDB is healthy before starting:
```bash
docker-compose -f docker-compose.single.yml up mongodb
# Wait for healthy status
docker-compose -f docker-compose.single.yml up obsidian-panel
```

---

## 🎯 Production Recommendation

**For production environments**, I still **strongly recommend** the multi-container setup (original `docker-compose.yml`) because:

1. **Horizontal Scaling**: Run 5+ workers behind one gateway
2. **Zero-Downtime Deployments**: Update worker without restarting gateway
3. **Better Monitoring**: Separate health checks and metrics
4. **Resource Isolation**: Prevent worker from starving gateway CPU

**Use single-container for**:
- Personal projects
- Development environments
- Quick demos
- Resource-constrained setups

---

## 📚 Files

- **[Dockerfile.single](file:///home/alex/workspace/github-honeypie112/others-stuff/Obsidian-Panel/backend-rust-microservices/Dockerfile.single)** - Multi-stage build for both services
- **[supervisord.conf](file:///home/alex/workspace/github-honeypie112/others-stuff/Obsidian-Panel/backend-rust-microservices/supervisord.conf)** - Process management config
- **[docker-compose.single.yml](file:///home/alex/workspace/github-honeypie112/others-stuff/Obsidian-Panel/backend-rust-microservices/docker-compose.single.yml)** - Single-container deployment
- **[.env.single](file:///home/alex/workspace/github-honeypie112/others-stuff/Obsidian-Panel/backend-rust-microservices/.env.single)** - Environment variables

---

## ✅ Summary

**Single-container deployment** trades microservices benefits (scaling, isolation) for **simplicity and lower overhead**. It's perfect for:
- Small-scale deployments
- Development/testing
- Getting started quickly

When your application grows, you can easily switch to multi-container **without any code changes**!
