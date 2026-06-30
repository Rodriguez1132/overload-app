# Overload backend (Node + Express + MongoDB)

A small key/value API the app syncs through. Endpoints: `GET/PUT/DELETE /api/kv/:key`,
`GET /api/kv?prefix=`, `GET /api/health`. Data is scoped per user via the `x-user-id` header.

## Run

1. Have MongoDB available — either install it locally, or create a free **MongoDB Atlas**
   cluster and copy its connection string.
2. ```bash
   cd server
   cp .env.example .env        # then edit MONGODB_URI (and PORT / API_KEY if you want)
   npm install
   npm run dev                 # http://localhost:8787  (npm start for production)
   ```
3. Point the frontend at it: in the project root `.env`, set
   `VITE_API_URL=http://localhost:8787`, then restart `npm run dev` in the root.

## Notes
- `API_KEY` (optional) turns on a shared-secret check; set the same value as the frontend's
  `VITE_API_KEY`. For single-user local use you can leave both empty.
- CORS is open by default for convenience — restrict `cors()` to your domain before hosting publicly.
