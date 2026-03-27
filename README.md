# RideWithUs

> A full-stack carpooling / ride-sharing web application (client + server). This repository contains a React + Tailwind frontend (`client/`) and an Express + MongoDB backend (`server/`).

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Repository Structure](#repository-structure)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
  - [Configure Environment Variables](#configure-environment-variables)
  - [Run Server](#run-server)
  - [Run Client](#run-client)
- [Database Seeding](#database-seeding)
- [Real-time & Integrations](#real-time--integrations)
- [Deployment Notes](#deployment-notes)
- [Contributing](#contributing)
- [License & Contact](#license--contact)

---

## Overview

RideWithUs is a carpooling platform that lets users create, find, book, and track shared rides. The project demonstrates a typical production-ready layout with a React frontend, a Node/Express API backend, MongoDB persistence, realtime messaging via WebSockets, and integrations such as Twilio and payment handling.

## Features

- User authentication (signup / login)
- Create and search rides
- Book rides and view booking history
- Real-time chat between users and drivers
- Ride tracking
- Admin panel for rides & users
- Payment integration (placeholder routes present)

## Tech Stack

- Frontend: React, Vite (or Create React App), Tailwind CSS
- Backend: Node.js, Express
- Database: MongoDB / Mongoose
- Realtime: Socket.IO (server socket handler present)
- Other: Twilio (SMS), payment controller (placeholder)

## Repository Structure

- `client/` — React frontend (Tailwind)
- `server/` — Express backend, routes, controllers, models

Key server folders:

- `server/config/` — DB and third-party configurations
- `server/controllers/` — API controllers
- `server/models/` — Mongoose models
- `server/routes/` — Express routes
- `server/socket/` — real-time socket handler
- `server/utils/seed.js` — database seeding helper

## Prerequisites

- Node.js (v16+ recommended)
- npm or yarn
- MongoDB (local or hosted like MongoDB Atlas)

## Quick Start

1. Clone the repository

```bash
git clone https://github.com/<your-username>/ridewithus-v3-fixed.git
cd ridewithus-v3-fixed
```

2. Configure environment variables (see below)

### Configure Environment Variables

Create `.env` files in both `server/` and `client/` as needed.

Example `server/.env` (adjust values):

```env
PORT=5000
MONGO_URI=mongodb+srv://<user>:<pass>@cluster0.mongodb.net/ridewithus
JWT_SECRET=your_jwt_secret
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_token
TWILIO_PHONE_NUMBER=+1234567890
```

Example `client/.env` (adjust values):

```env
VITE_API_BASE_URL=http://localhost:5000/api
```

> Note: The exact env variable names used by the project are found in `server/config/` and the frontend `services/api.js` — update the `.env` accordingly.

### Run the Server

```bash
cd server
npm install
npm run dev    # or `npm start` depending on scripts in server/package.json
```

The API should start on the port from `server/.env` (default 5000).

### Run the Client

```bash
cd client
npm install
npm run dev    # or `npm start` depending on client/package.json
```

Open the frontend at `http://localhost:3000` (or the port printed by the dev server).

## Database Seeding

The server contains `server/utils/seed.js` to insert sample data. To run it manually, review the file and run as appropriate (or add a script in `server/package.json`). Ensure your `MONGO_URI` is set before running the seed.

## Real-time & Integrations

- Socket: `server/socket/socketHandler.js` handles socket connections for chat and tracking.
- Twilio: `server/config/twilio.js` and usage in controllers — configure Twilio env vars to enable SMS notifications.
- Payments: `server/controllers/paymentController.js` includes payment-related endpoints (implement provider-specific logic and secure keys in env).

## Testing & Linting

No automated tests are present by default. You can add tests with Jest / React Testing Library (frontend) and Jest / Supertest (backend).

## Deployment Notes

- Use environment variables in production (never commit secrets).
- For production builds, build the React app and serve statically (or host separately) and run the Express API behind a reverse proxy.
- Use MongoDB Atlas for hosted DB, and configure CORS and security (rate limiting, helmet) on the server.

### Production build (quick guide)

1. Build the client for production

```powershell
cd client
npm install
npm run build
```

This produces an optimized static bundle (commonly `dist/` or `build/` depending on the frontend setup).

2. Serve the static build

- Option A — Host the static files separately (Netlify / Vercel / Surge): upload the `dist/` or `build/` folder.
- Option B — Serve from the Express server:

  - copy or move the frontend build output into a folder the Express app serves (e.g., `server/public`), or configure `express.static()` to point to the built folder.

3. Run the backend in production

```powershell
cd server
npm install --production
NODE_ENV=production npm start
```

On Windows PowerShell, set env vars like this instead:

```powershell
$env:NODE_ENV = "production"
npm start
```

4. (Optional) Process manager

Use `pm2` or a similar process manager in production:

```powershell
npm install -g pm2
pm2 start npm --name ridewithus -- start
pm2 save
```

Adjust reverse proxy, SSL termination, and environment settings per your hosting provider.

## Contributing

Feel free to open issues or create pull requests. Suggested workflow:

1. Fork the repo
2. Create a feature branch
3. Implement changes and add tests
4. Open a PR with a clear description

## License & Contact

This project is distributed under the MIT License — see the `LICENSE` file for details. (If you prefer a different license, replace `LICENSE` with your chosen license file.)

For questions, reach out to the project owner (update this section with your contact info).

---

Created for easy GitHub publishing — edit sections to add screenshots, badges, or deployment instructions as needed.
