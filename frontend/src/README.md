# CareSetu Frontend Source Code (`frontend/src`)

## Overview
Contains the React 19 TypeScript source code for the CareSetu frontend single-page application.

## Key Root Files
- **`main.tsx`:** Application entry point. Mounts the React component tree into `index.html` DOM element `#root` wrapped in `React.StrictMode`.
- **`App.tsx`:** Primary routing container. Configures `BrowserRouter`, global context providers (`AuthProvider`, `SocketProvider`), and top-level route switches.
- **`index.css`:** Global style imports including TailwindCSS directives (`@tailwind base`, `@tailwind components`, `@tailwind utilities`).

## Subdirectory Structure
- `assets/`: Media files and logo icons.
- `components/`: UI components organized by portal role.
- `context/`: State management context providers.
- `data/`: Mock datasets and select options.
- `hooks/`: Custom reusable React hooks.
- `layouts/`: Shared navigation headers, sidebars, and container layouts.
- `pages/`: Page views for Patient, Hospital, Doctor, and Admin portals.
- `routes/`: Protected route guards and route definitions.
- `services/`: Axios HTTP API client calls.
- `styles/`: Additional styling rules.
- `types/`: Shared TypeScript interface declarations.
- `utils/`: UI helper utilities.
