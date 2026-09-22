# Backend Express Routes Directory (`backend/src/routes`)

## Purpose
Defines HTTP URL endpoint routes and attaches corresponding validation middleware and route controllers.

## Core Route Files
- **`auth.routes.js`:** `/api/auth` — Registration, login, OTP verification, credential updates.
- **`emergency.routes.js`:** `/api/emergency` — SOS dispatching, hospital acceptance, live status.
- **`chat.routes.js`:** `/api/chat` — Doctor AI message handling (`/message`, `/send`) and conversation management.
- **`healthpack.routes.js`:** `/api/patient/health-pack` & `/api/patient/documents` — Encrypted document upload/download and consent management.
- **`hospital.routes.js`:** `/api/hospital` — Bed capacity management and emergency queue listings.
- **`settings.routes.js`:** `/api/settings` & `/api/admin` — User settings and administrator blocklist endpoints.
