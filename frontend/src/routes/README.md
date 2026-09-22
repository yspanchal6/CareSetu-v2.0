# Frontend Routing Directory (`frontend/src/routes`)

## Purpose
Defines React Router route paths and protected route guard components (`ProtectedRoute.tsx`) enforcing role-based access before rendering page views.

## Key Files
- **`index.tsx`:** Route path declarations mapping URL paths to page components.
- **`ProtectedRoute.tsx`:** Checks `AuthContext` for active JWT session and validates user role permissions.
