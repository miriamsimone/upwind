# Upwind Portal

Monorepo containing the Upwind student training portal frontend (React + Vite) and a lightweight Express backend that proxies external APIs.

## Prerequisites

- Node.js 20+
- npm 10+

## Project Structure

- `upwind-portal/` – React + TypeScript frontend configured with Tailwind CSS.
- `backend/` – Express + TypeScript API proxy for weather data and Claude suggestions.

## Environment Variables

Backend secrets are loaded from a `.env` file inside `backend/`. Copy the provided template:

```bash
cd backend
cp env.sample .env
```

Then edit `.env` and add your own keys:

- `ANTHROPIC_API_KEY` – Claude API key.
- `OPENWEATHER_API_KEY` – OpenWeatherMap API key.
- Optional: set `FRONTEND_ORIGIN` if the frontend is served from anywhere other than `http://localhost:5173`.

## Installing Dependencies

```bash
# install frontend deps
cd upwind-portal
npm install

# install backend deps
cd ../backend
npm install
```

## Running the Apps

Open two terminal windows/tabs:

1. **Backend (port 3001)**

   ```bash
   cd backend
   npm run dev
   ```

2. **Frontend (Vite dev server on port 5173)**

   ```bash
   cd upwind-portal
   npm run dev
   ```

The React app is configured to call the backend at `http://localhost:3001`. With both servers running you can visit <http://localhost:5173>.

## Production Builds

```bash
# Frontend
cd upwind-portal
npm run build

# Backend
cd backend
npm run build
npm start
```

## Available API Endpoints

All backend endpoints are prefixed with `/api` and run on port 3001.

- `GET /api/weather/current?lat={lat}&lon={lon}` – Returns formatted current weather data from OpenWeatherMap.
- `GET /api/weather/forecast?lat={lat}&lon={lon}&days={1-7}` – Returns daily summaries for the next `days` days.
- `POST /api/reschedule` – Generates three AI-powered rescheduling suggestions using Claude. Requires a JSON body that includes `student`, `weather`, and `conflict` objects.

# upwind
# upwind
