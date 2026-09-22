# Frontend API Services (`frontend/src/services`)

## Purpose
Provides centralized HTTP API client functions wrapping Axios to interact with CareSetu Express backend endpoints.

## Key Services
- **`api.ts`:** Core Axios instance configured with `baseURL` (`VITE_API_BASE_URL`), JSON headers, and request interceptors injecting JWT Bearer tokens.
- **`auth.service.ts`:** Functions for login, registration, and OTP verification API calls.
- **`chat.service.ts`:** Functions for sending Doctor AI queries (`/api/chat/message`) and fetching chat history.
- **`emergency.service.ts`:** Functions for triggering SOS requests and querying active emergency status.
- **`healthpack.service.ts`:** Functions for uploading documents and managing hospital access consents.
