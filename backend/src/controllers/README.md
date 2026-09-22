# Backend Controllers Directory (`backend/src/controllers`)

## Purpose
Contains Express.js route controller functions responsible for processing HTTP request bodies, headers, and query parameters, invoking business logic services, and returning structured JSON HTTP responses.

## Key Controllers
- **`auth.controller.js`:** Handles user registration, login, JWT token issuance, password resets, and OTP verification workflows.
- **`emergency.controller.js`:** Processes emergency SOS trigger requests, hospital dispatch acceptance, and active SOS tracking queries.
- **`chat.controller.js`:** Handles Doctor AI message submission, conversation history retrieval, and intent classification persistence.
- **`healthpack.controller.js`:** Manages patient HealthPack medical history uploads, document metadata retrieval, and hospital consent grants.
- **`hospital.controller.js`:** Manages hospital capacity updates (ICU/general bed counts), doctor registrations, and emergency queue listings.
- **`settings.controller.js`:** Handles multi-portal user settings updates and administrator blocklist operations.
