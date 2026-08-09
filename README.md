# DeployDoctor

**Turn deployment failures into an actionable diagnosis.** Paste the logs from a
failed deploy and DeployDoctor tells you *what* broke, *why*, the supporting
evidence, and the exact next steps to fix it — instead of leaving you to read a
wall of stack traces.

![DeployDoctor — diagnosis view](docs/screenshot-diagnosis.png)

> Replace the image above with a real screenshot — see [Screenshots](#screenshots).

---

## Problem

Deployment failures almost always leave useful logs behind — `ECONNREFUSED`,
`CrashLoopBackOff`, `JavaScript heap out of memory`, `502 Bad Gateway` — but a
developer still has to interpret them by hand: recognise the signature, guess the
root cause, and remember the fix. That first layer of triage is repetitive,
error-prone, and eats time during exactly the moments that matter most.

I kept hitting the same wall while deploying open-source apps with Docker,
Kubernetes, PostgreSQL and Redis: the logs told the story, but I had to decode it
every single time. DeployDoctor automates that first layer of troubleshooting.

## Solution

DeployDoctor takes an incident (a title, environment, and logs) and returns a
**structured diagnosis**:

- **Diagnosis** — a one-line explanation of what failed
- **Severity + Category** — e.g. `HIGH · DATABASE`
- **Likely cause** — the most probable root cause
- **Evidence** — the specific signals pulled from the logs
- **Recommended fix** — the single most important action
- **Next steps** — an ordered checklist to verify and resolve

It uses a fast **deterministic analyzer** for well-known failure signatures and
falls back to **Google Gemini** for anything unfamiliar, so common incidents are
diagnosed instantly (no API key required) while novel ones still get answered.

## Features

- ⚡ **Instant diagnosis** for 12+ common deployment failure signatures
- 🧠 **AI fallback** (Gemini) for unrecognised or low-confidence logs
- 🎯 **Structured output**: severity, category, evidence, fix, and next steps
- 🧪 **One-click examples** to try Postgres, Redis, Docker, Kubernetes,
  networking and config failures
- 🗄️ **Incident persistence** in PostgreSQL via Prisma
- 🚀 **Deployed on Zerops**

## Architecture

```
        ┌──────────────┐        ┌──────────────────┐        ┌──────────────┐
        │  React + Vite │  HTTP  │  DeployDoctor API │  SQL   │  PostgreSQL  │
        │  (frontend)   │ ─────▶ │     (Fastify)     │ ─────▶ │  (incidents) │
        └──────────────┘        └────────┬─────────┘        └──────────────┘
                                         │
                                         │ fallback for unknown logs
                                         ▼
                                 ┌────────────────┐
                                 │  Google Gemini │
                                 │  (2.5 Flash)   │
                                 └────────────────┘
```

The API first runs a deterministic analyzer. If confidence is below a threshold,
it asks Gemini and returns the same structured shape. Every incident and its
diagnosis is stored in PostgreSQL.

## Tech Stack

| Layer     | Technology                                        |
| --------- | ------------------------------------------------- |
| Frontend  | React 19, TypeScript, Vite                        |
| API       | Fastify 5, TypeScript (Node 22)                   |
| Database  | PostgreSQL via Prisma ORM 7 (`@prisma/adapter-pg`)|
| AI        | Google Gemini (`gemini-2.5-flash`)                |
| Hosting   | Zerops                                            |

## How It Works

1. The frontend `POST`s the incident to `/incidents`.
2. It then calls `POST /incidents/:id/analyze`.
3. The API runs the **deterministic analyzer** (`src/services/analyzer.ts`),
   matching the logs against known failure patterns.
4. If confidence `< 0.8`, it falls back to **Gemini**
   (`src/services/ai-analyzer.ts`).
5. The diagnosis is persisted and returned to the UI, which renders the
   severity/category badges, evidence, fix, and next steps.

## AI Diagnosis

The deterministic analyzer recognises signatures including:

| Category    | Example signal                          |
| ----------- | --------------------------------------- |
| DATABASE    | `ECONNREFUSED …:5432`, `relation "…" does not exist` |
| CACHE       | `ECONNREFUSED …:6379`                   |
| DOCKER      | `port is already allocated`, `manifest … not found` |
| KUBERNETES  | `CrashLoopBackOff`, `ImagePullBackOff`  |
| RUNTIME     | `JavaScript heap out of memory`         |
| NETWORK     | `getaddrinfo ENOTFOUND`, `502 Bad Gateway` |
| CONFIG      | `DATABASE_URL is undefined`             |
| SYSTEM      | `permission denied` / `EACCES`          |

Anything else is handed to Gemini with a strict prompt that returns the same JSON
shape (diagnosis, likelyCause, evidence, recommendation, nextSteps, severity,
category, confidence).

## Zerops Deployment

DeployDoctor runs on [Zerops](https://zerops.io). Both services are described in
[`zerops.yml`](./zerops.yml).

**`api`** (Fastify backend)

- **Build**: `npm ci` → `npx prisma generate` → `npm run build`
- **Runtime**: Node 22, `npm start` (`node dist/server.js`)
- **Port**: `3000` with HTTP support
- **Data**: a Zerops PostgreSQL service, injected via `DATABASE_URL`

The server binds to `0.0.0.0` and reads `PORT`/`HOST` from the environment so it
works unchanged on Zerops.

**`frontend`** (React + Vite SPA)

- **Build**: `npm install` → `npm run build` (run inside `frontend/`)
- **Runtime**: `static` — Nginx serves `frontend/dist` with SPA fallback built
  in (no Node process at request time)
- **API URL**: `VITE_API_URL` is baked into the bundle at build time from the
  `RUNTIME_VITE_API_URL` env var (defaults to the internal `http://api:3000`).



## Screenshots

> Add screenshots here — the diagnosis view is the strongest one to lead with.

1. Create a `docs/` folder and drop your images in it.
2. Reference them, for example:

```md
![Incident form](docs/screenshot-form.png)
![Diagnosis result](docs/screenshot-diagnosis.png)
```

## Live Demo

- **App**: https://deploydoctor.abdultalha.dev
- **API health check**: `<your-zerops-api-url>/health`

## API Endpoints

| Method | Path                     | Description                              |
| ------ | ------------------------ | ---------------------------------------- |
| GET    | `/health`                | Service health check                     |
| POST   | `/incidents`             | Create an incident                       |
| GET    | `/incidents/:id`         | Fetch an incident by id                  |
| POST   | `/incidents/:id/analyze` | Analyze an incident and return the fix   |

## Local Development

**Prerequisites:** Node 22+, a PostgreSQL database, and (optionally) a Gemini API
key for the AI fallback.

```bash
# 1. API (repository root)
npm install
npx prisma generate
npx prisma migrate deploy   # or `migrate dev` locally
npm run dev                 # starts the Fastify API on :3000

# 2. Frontend (in a second terminal)
cd frontend
npm install
npm run dev                 # starts Vite on :5173
```

**Environment variables:**

| Variable              | Used by           | Purpose                                        |
| --------------------- | ----------------- | ---------------------------------------------- |
| `DATABASE_URL`        | API               | PostgreSQL connection string                   |
| `GEMINI_API_KEY`      | API               | Enables the Gemini AI fallback                 |
| `PORT` / `HOST`       | API               | Bind address (defaults `3000` / `0.0.0.0`)     |
| `VITE_API_URL`        | Frontend (local)  | Base URL of the API (defaults localhost)       |
| `RUNTIME_VITE_API_URL`| Frontend (Zerops) | Public API URL baked into the build on deploy  |

## What I Learned

- How to turn messy, unstructured log output into a consistent, structured
  diagnosis that is actually useful under pressure.
- Balancing a **deterministic-first, AI-fallback** design — fast and free for
  common cases, smart for the long tail — instead of sending everything to an LLM.
- Deploying a full-stack app (React + Fastify + PostgreSQL + Prisma) to Zerops,
  including build pipelines, service networking, and environment configuration.

## Future Improvements

- Broaden the deterministic pattern library and add confidence tuning.
- Let users confirm/correct diagnoses to build a feedback dataset.
- Incident history view with filtering by severity and category.
- Direct log ingestion from CI/CD and container platforms.
