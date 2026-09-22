# CareSetu Backend Source Code (`backend/src`)

## Overview
This directory contains the primary JavaScript/TypeScript source code for the CareSetu Express.js backend application.

## Key Entry Files
- **`server.js`:** The application entry point. Initializes the HTTP server, connects Socket.IO WebSocket listeners, and listens on `PORT` (default 3000).
- **`app.js`:** Express application configurator. Registers Helmet security middleware, CORS options, JSON body parsers, cookie parsers, API routes under `/api`, and central error handling middleware.

## Source Subdirectories
- `config/`: System and environment settings.
- `controllers/`: Route controllers handling HTTP requests/responses.
- `data/`: Curated medical knowledge JSON datasets for lexical RAG.
- `middleware/`: Authentication, role verification, and rate limiting handlers.
- `providers/`: Integration clients for external SMS and email gateways.
- `routes/`: Express endpoint definitions.
- `services/`: Core business logic (SOS routing, Doctor AI NLP, HealthPack encryption).
- `utils/`: Helper utilities (JWT generation, password hashing, formatting).
