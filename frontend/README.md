# CareSetu Frontend Single Page Application (`frontend`)

The **CareSetu Frontend** is a Single Page Application (SPA) built using React 19, TypeScript 6.0, and Vite 8.2. It provides role-tailored user interfaces for Patients, Hospital Dispatchers, Doctors, and System Administrators.

---

## Technical Stack & Libraries

- **Framework:** React 19, Vite 8.2, TypeScript 6.0
- **Routing:** React Router v7 (`react-router-dom`)
- **Styling:** TailwindCSS 3.4, PostCSS, Autoprefixer
- **UI Components & Icons:** Lucide React icons
- **Mapping & Geolocation:** Leaflet & React-Leaflet
- **Real-Time Communication:** Socket.IO Client (v4.8)
- **Charts & Data Visualization:** Recharts
- **Linting & Code Quality:** Oxlint

---

## Repository Folder Structure

```
frontend/
├── public/                # Static public assets (logos, icons)
├── src/                   # Main source code
│   ├── assets/            # Embedded images and media
│   ├── components/        # Reusable React components grouped by feature/portal
│   ├── context/           # React Context state providers (AuthContext, SocketContext)
│   ├── data/              # Static sample data and mock options
│   ├── hooks/             # Custom React hooks (useAuth, useSocket, useSOS)
│   ├── layouts/           # Page layout wrappers (PatientLayout, HospitalLayout)
│   ├── pages/             # Portal view pages grouped by user role
│   ├── routes/            # Route declarations and protected route guards
│   ├── services/          # HTTP API client services (axios wrapper)
│   ├── styles/            # Global CSS styles and Tailwind overrides
│   ├── types/             # TypeScript type definitions and interfaces
│   ├── utils/             # Helper formatting and distance utility functions
│   ├── App.tsx            # Main application router component
│   └── main.tsx           # React DOM root mounting script
├── index.html             # Main HTML document template
├── package.json           # Frontend dependency declarations
├── tailwind.config.js     # TailwindCSS theme configuration
└── vite.config.ts         # Vite build bundler configuration
```

---

## Password Security UI & Animations

CareSetu includes a modern, accessible password security UI component (`PasswordInput`):

- **Password Visibility Toggle:** Touch-friendly 44x44px show/hide toggle button with smooth icon transitions.
- **Real-Time Strength Meter:** Dynamically calculates strength (Weak, Medium, Strong) with an animated color-coded progress bar (0% -> 33% -> 66% -> 100%).
- **Interactive Checklist:** Real-time requirements tracker (8+ chars, uppercase, lowercase, number, special char) with animated checkmarks (`animate-check-pop`).
- **Confirm Matching Feedback:** Live validation indicator (`✓ Passwords match` vs `✕ Passwords do not match`).
- **Animations:** Smooth focus ring expansion, checklist pop-in, and error shake animation (`animate-shake`) on failed validation.
- **Accessibility:** Built with WCAG standards: visible focus indicators, `aria-invalid`, `aria-describedby`, high contrast colors, keyboard navigation, and `motion-reduce` support for `prefers-reduced-motion`.

---

## Getting Started

1. **Install Dependencies:**
   ```bash
   npm install
   ```

2. **Configure Environment:**
   Copy `.env.example` to `.env`:
   ```ini
   VITE_API_BASE_URL="http://localhost:3000/api"
   VITE_SOCKET_URL="http://localhost:3000"
   ```

3. **Start Development Server:**
   ```bash
   npm run dev
   ```
   The application will be accessible at `http://localhost:5173`.

4. **Production Build:**
   ```bash
   node node_modules/vite/bin/vite.js build
   ```
   Compiled production bundles are saved to `dist/`.

