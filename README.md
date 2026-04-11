# MM Jewels — React Billing Application

Gold and silver jewelry billing application for MM Jewels. Express + MongoDB
backend with a React 19 + Vite + Tailwind frontend, served together over HTTPS.

## Repository layout

```
backend/    Express API + Mongoose models + auth/orders/customers/items routes
frontend/   React 19 + Vite + Tailwind SPA (built output is served by backend)
```

## Backend

```
cd backend
npm install
cp .env.example .env       # then edit .env with real values
node server.js
```

Environment variables are documented in [`backend/.env.example`](backend/.env.example).

`server.js` currently expects:

- `.env` at `$HOME/billing-app/backend/.env`
- TLS key/cert at `$HOME/billing-app/backend/ssl/server.key` and `server.cert`
- Built frontend at `$HOME/billing-frontend/dist`

If you deploy under a different layout you will need to adjust those paths.

## Frontend

```
cd frontend
npm install
npm run dev          # local dev server
npm run build        # production build into frontend/dist
```

The backend serves `frontend/dist` for any non-`/api/*` route, so after `npm run build`
the SPA is available at the same origin as the API.

## Stack

- **Backend:** Express, Mongoose, JWT auth, Helmet, rate limiting, PDFKit
- **Frontend:** React 19, Vite, Tailwind CSS v4, React Router 7, Axios, jsPDF, xlsx
- **Database:** MongoDB Atlas
- **Hosting:** Single Node process behind PM2, HTTPS on 3443, HTTP redirect on 3001

## Notes

- No GST / tax calculation — invoices are pre-tax by design.
- Single Invoice flow only (no quotation / pre-invoice).
- Confirmed orders can be edited and remain confirmed.
- Print and PDF output is intentionally neutral (no colors) for customer copies.
