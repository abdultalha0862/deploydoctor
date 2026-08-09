# DeployDoctor

Paste the logs from a failed deployment and get back a structured diagnosis:
what broke, the likely cause, the evidence from the logs, and the steps to fix
it.

DeployDoctor matches logs against a library of known failure signatures first,
which is instant and needs no API key. When the logs don't match a known
pattern, it falls back to Google Gemini for a diagnosis in the same format.

## How it works

1. The frontend creates an incident (`POST /incidents`) with a title, optional
   environment, and the logs.
2. It then requests analysis (`POST /incidents/:id/analyze`).
3. The API runs the deterministic analyzer in `src/services/analyzer.ts`,
   matching the logs against known error signatures.
4. If the match confidence is below `0.8`, it calls Gemini
   (`src/services/ai-analyzer.ts`), which returns the same JSON shape.
5. The diagnosis is saved to PostgreSQL and returned to the UI.

Every diagnosis has the same fields: `diagnosis`, `likelyCause`, `evidence`,
`recommendation`, `nextSteps`, `severity`, `category`, and `confidence`.

## Recognized signatures

The deterministic analyzer covers common deployment failures:

| Category   | Example signal                                        |
| ---------- | ----------------------------------------------------- |
| DATABASE   | `ECONNREFUSED …:5432`, `relation "…" does not exist`  |
| CACHE      | `ECONNREFUSED …:6379`                                 |
| DOCKER     | `port is already allocated`, `manifest … not found`   |
| KUBERNETES | `CrashLoopBackOff`, `ImagePullBackOff`                |
| RUNTIME    | `JavaScript heap out of memory`, `OOMKilled`          |
| NETWORK    | `getaddrinfo ENOTFOUND`, `502 Bad Gateway`            |
| CONFIG     | `DATABASE_URL is undefined`                           |
| SYSTEM     | `permission denied` / `EACCES`                        |

Anything else is handed to Gemini.

## Tech stack

| Layer    | Technology                                         |
| -------- | -------------------------------------------------- |
| Frontend | React 19, TypeScript, Vite                         |
| API      | Fastify 5, TypeScript (Node 22)                    |
| Database | PostgreSQL via Prisma ORM 7 (`@prisma/adapter-pg`) |
| AI       | Google Gemini (`gemini-2.5-flash`)                 |
| Hosting  | Zerops                                             |

## API

| Method | Path                     | Description                |
| ------ | ------------------------ | -------------------------- |
| GET    | `/health`                | Service health check       |
| POST   | `/incidents`             | Create an incident         |
| GET    | `/incidents/:id`         | Fetch an incident by id    |
| POST   | `/incidents/:id/analyze` | Analyze an incident's logs |

## Local development

Requires Node 22+, a PostgreSQL database, and optionally a Gemini API key for
the AI fallback.

```bash
# API (repository root)
npm install
npx prisma generate
npx prisma migrate deploy   # use `migrate dev` while iterating locally
npm run dev                 # Fastify API on :3000

# Frontend (second terminal)
cd frontend
npm install
npm run dev                 # Vite on :5173
```

## Environment variables

| Variable               | Used by           | Purpose                                    |
| ---------------------- | ----------------- | ------------------------------------------ |
| `DATABASE_URL`         | API               | PostgreSQL connection string               |
| `GEMINI_API_KEY`       | API               | Enables the Gemini fallback                |
| `PORT` / `HOST`        | API               | Bind address (defaults `3000` / `0.0.0.0`) |
| `VITE_API_URL`         | Frontend (local)  | Base URL of the API                        |
| `RUNTIME_VITE_API_URL` | Frontend (Zerops) | Public API URL baked in at build time      |

## Deployment

Both services are defined in [`zerops.yml`](./zerops.yml).

- **api** — Node 22. Builds with `npm ci`, `npx prisma generate`, `npm run
  build`, then runs `node dist/server.js` on port 3000. The database URL is
  injected via `DATABASE_URL`.
- **frontend** — built with Vite and served as static files by Nginx with SPA
  fallback. The API URL is baked into the bundle at build time from
  `RUNTIME_VITE_API_URL`, falling back to the API's internal hostname.

The API binds to `0.0.0.0` and reads `PORT`/`HOST` from the environment, so it
runs unchanged locally and on Zerops.
