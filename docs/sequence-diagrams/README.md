# CareSetu Sequence Diagrams

## Folder Overview
This directory stores sequence diagrams documenting message flow across components during real-time actions.

## Key Sequence Diagrams
1. **Emergency SOS Broadcast Sequence:** Patient Client -> API Server -> PostGIS Query -> Socket.IO -> Hospital Dashboards -> SMS Gateway.
2. **Doctor AI Query & Safety Interception Sequence:** Patient Client -> API Server -> RedFlag Engine -> RAG Tokenizer -> LLM/Local Fallback -> Patient Client.
