# Backend Configuration Directory (`backend/src/config`)

## Purpose
Manages system configuration, environment variable extraction, database connections, and external API client initialization.

## Responsibilities
- Parse process environment variables safely using fallback defaults.
- Export central Prisma client instance.
- Configure Socket.IO CORS policies and HTTP rate limit parameters.
