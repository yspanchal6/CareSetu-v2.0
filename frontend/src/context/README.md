# React Context Providers (`frontend/src/context`)

## Purpose
Provides global React Context state providers for managing authentication tokens, user session state, and WebSocket connection instances.

## Key Contexts
- **`AuthContext.tsx`:** Manages user login state, tab-scoped JWT token storage in `sessionStorage`, user role info, and logout handling.
- **`SocketContext.tsx`:** Initializes single Socket.IO client instance connecting to `VITE_SOCKET_URL` and listens for real-time SOS events.
