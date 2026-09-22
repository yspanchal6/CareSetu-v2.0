# CareSetu Scalability & Load Balancing Specifications

## 1. Stateless Backend Architecture

CareSetu is architected for zero-downtime horizontal scaling across multiple backend instances behind a Load Balancer or Reverse Proxy (e.g. AWS ALB, Nginx, Cloudflare).

```
                      +----------------------------------+
                      |  Load Balancer / Reverse Proxy   |
                      |   (SSL Termination / ALB / WAF)  |
                      +----------------+-----------------+
                                       |
             +-------------------------+-------------------------+
             |                                                   |
   +---------v---------+                               +---------v---------+
   | Backend Instance 1|                               | Backend Instance 2|
   | (Node.js / Express) |                               | (Node.js / Express) |
   +---------+---------+                               +---------+---------+
             |                                                   |
             +-------------------------+-------------------------+
                                       |
                   +-------------------+-------------------+
                   |                                       |
       +-----------v-----------+               +-----------v-----------+
       |   Redis Shared Store  |               |  PostgreSQL / PostGIS |
       | (Rate Limit / Socket) |               |  (Primary DB Pool)    |
       +-----------------------+               +-----------------------+
```

---

## 2. Key Scalability Controls

### 1. Trusted Reverse Proxy Configuration
- `app.set('trust proxy', 1)` is enabled in `app.js`.
- Ensures client IP addresses are accurately resolved from `X-Forwarded-For` without vulnerability to client IP header spoofing.

### 2. Distributed Rate Limiting (Redis Store)
- Rate limiters (`rate-limiters.js`) integrate with `rate-limit-redis`.
- When deployed in multi-instance environments, counter increments are processed atomically in Redis (`REDIS_URL`), ensuring rate limit caps are enforced across all nodes.

### 3. Socket.IO Event Broadcasting
- Real-time notifications for hospital SOS emergencies and chat messaging support multi-node scaling using `@socket.io/redis-adapter`.
- Events emitted on Node 1 automatically broadcast to connected clients on Node 2 via Redis Pub/Sub channels.

### 4. PostgreSQL Connection Pooling
- Prisma ORM is configured with database connection pool limits (`connection_limit=20` in `DATABASE_URL`).
- Prevents database connection exhaustion during peak emergency SOS traffic spikes.

### 5. Health Checks & Monitoring
- **Endpoint:** `GET /health` and `GET /api/health`
- Performs deep health checks including a live database query (`SELECT 1`).
- Returns HTTP 200 OK when database services are healthy, or HTTP 503 Service Unavailable when degraded, allowing load balancers to automatically remove unhealthy instances from traffic distribution.

### 6. Graceful Shutdown Draining
- `server.js` listens for `SIGTERM` and `SIGINT` operating system signals.
- In-flight HTTP requests are drained within a configurable grace period before closing Prisma connection pools and stopping the process.
