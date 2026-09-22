# External Service Providers Directory (`backend/src/providers`)

## Purpose
Encapsulates third-party API communication clients and external service adapters.

## Providers Included
- **`textbee.provider.js`:** Integrates with the TextBee cellular SMS gateway to dispatch real-time emergency SOS SMS alerts to patient contacts.
- **`brevo.provider.js`:** Integrates with Brevo REST API to send transactional email notifications, OTP verification codes, and password reset links.
- **`ai-sidecar.provider.js`:** Connects to the Python FastAPI microservice (`http://localhost:8000`) for advanced NLP entity extraction and model inference.
