# Custom React Hooks (`frontend/src/hooks`)

## Purpose
Provides reusable custom React hooks encapsulating stateful logic, side effects, and API subscriptions.

## Key Hooks
- **`useAuth`:** Accesses `AuthContext` state (user profile, login, logout, role check).
- **`useSocket`:** Accesses `SocketContext` instance for emitting and listening to WebSocket events.
- **`useGeolocation`:** Obtains browser location coordinates via HTML5 `navigator.geolocation` API.
