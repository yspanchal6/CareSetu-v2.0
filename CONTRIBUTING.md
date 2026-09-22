# Contributing to CareSetu

Thank you for your interest in contributing to **CareSetu**! We welcome contributions from developers, designers, healthcare technology enthusiasts, and security researchers.

---

## 1. Code of Conduct

By participating in this project, you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md). Please report unacceptable behavior to `conduct@caresetu.org`.

---

## 2. How to Contribute

### Reporting Bugs
Before creating a bug report, please check existing GitHub issues. When creating an issue, include:
- A clear, descriptive title.
- Steps to reproduce the issue.
- Expected vs. actual behavior.
- Operating system, browser, and Node.js version.
- Relevant error trace logs (without sensitive tokens or keys).

### Suggesting Features
Enhancement suggestions are tracked as GitHub issues. Please provide:
- A clear explanation of the proposed feature.
- Use cases and target user roles (Patient, Hospital, Doctor, Administrator).
- Any architectural considerations.

---

## 3. Local Development Setup

1. Fork the repository on GitHub.
2. Clone your fork locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/CareSetu-demo.git
   cd CareSetu-demo
   ```
3. Set up environment configuration files (`.env`) for both backend and frontend based on `.env.example`.
4. Install dependencies:
   ```bash
   # Backend
   cd backend && npm install

   # Frontend
   cd ../frontend && npm install
   ```
5. Ensure local PostgreSQL is running and push database schema:
   ```bash
   cd backend
   npx prisma db push
   ```

---

## 4. Git Workflow & Branch Naming

We follow a feature-branch workflow:

- `main` / `master` — Production-ready release code.
- `feature/feature-name` — New features and enhancements.
- `fix/bug-name` — Bug fixes and security patches.
- `docs/doc-name` — Documentation improvements.

### Commit Messages
Write clear, concise commit messages:
```
feat(doctor-ai): add Hindi negation parsing support
fix(sos): resolve multi-hospital broadcast fallback timeout
docs(readme): update system architecture diagrams
```

---

## 5. Pull Request Guidelines

1. Ensure all code passes linting and build checks (`npm run build`).
2. Run test suites locally before submitting:
   ```bash
   cd backend
   node scratch/test_doctor_ai_deep_verification.js
   node scratch/test_doctor_ai_e2e_api.js
   ```
3. Do **not** commit `.env` files, API keys, JWT secrets, or database credentials.
4. Keep pull requests focused on a single topic or fix.
5. Provide clear testing steps in your PR description.
