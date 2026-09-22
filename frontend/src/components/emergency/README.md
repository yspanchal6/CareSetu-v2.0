# Emergency Components (`frontend/src/components/emergency`)

## Purpose
Renders real-time Emergency SOS dispatch widgets, live status trackers, and emergency contact alerts.

## Key Components
- **SOS Button Widget:** One-click emergency trigger button acquiring current GPS coordinates.
- **Live SOS Tracking Panel:** Renders WebSocket status progression (`DISPATCHING` -> `ACCEPTED` -> `AMBULANCE_EN_ROUTE` -> `ARRIVED`).
- **Emergency Contact Manager:** Interface for adding and editing emergency SMS contact numbers.
