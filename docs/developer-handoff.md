# Developer Handoff

This package now includes a working frontend and backend for **Instant Sewer & Drain Answers**, powered by **Pro Trenchless Services**.

## Recommended production URL

```text
https://answers.protrenchless.com
```

## Stack

- Frontend: static HTML/CSS/JS in `/public`
- Backend: Node.js 20 + Express in `/server`
- AI: OpenAI Responses API through the official Node SDK when `OPENAI_API_KEY` is present
- Storage: local JSONL files in `/data` and uploaded files in `/uploads`
- Admin: `/admin/` dashboard using protected `/api/admin/*` endpoints
- Lead routing: optional webhook and optional SendGrid email notification

## Run locally

```cmd
npm install
copy .env.example .env
npm run dev
```

Open:

```text
http://localhost:3000
```

## Required environment variables before launch

```env
PORT=3000
NODE_ENV=production
PUBLIC_BASE_URL=https://answers.protrenchless.com
CORS_ORIGIN=https://answers.protrenchless.com
ADMIN_API_KEY=replace-with-long-random-key
OPENAI_API_KEY=replace-with-real-key
OPENAI_MODEL=gpt-5.2
LEAD_WEBHOOK_URL=https://crm-or-zapier-webhook
```

## Backend routes

- `GET /health`
- `POST /api/chat`
- `POST /api/leads`
- `POST /api/uploads`
- `POST /api/events`
- `GET /api/modules`
- `GET /api/admin/stats`
- `GET /api/admin/leads`
- `GET /api/admin/uploads`
- `GET /api/admin/uploads/:id/download`

Admin endpoints require this header:

```text
x-admin-key: ADMIN_API_KEY
```

## Frontend integration already completed

The frontend now has:

- Floating AI chat widget connected to `/api/chat`
- Lead forms connected to `/api/leads`
- File uploads connected to `/api/uploads`
- Event logging connected to `/api/events`
- Local fallback AI mode if no OpenAI key is configured

## Deployment recommendation

Use a server-backed host, not static-only hosting. Good options:

- Render
- Railway
- Fly.io
- DigitalOcean App Platform
- VPS with Nginx reverse proxy
- Docker-capable host

Static-only hosting will not support AI, uploads, admin, or lead routing unless the API is deployed separately.

## SEO setup

- Index polished tool landing pages.
- Noindex admin, uploaded files, private reports, AI transcripts, and thin generated outputs.
- Keep `robots.txt` updated.
- Track the subdomain separately in Google Search Console.
- Link tool results back to main Pro Trenchless money pages.

## Security notes

- Change `ADMIN_API_KEY` before launch.
- Do not expose `.env`.
- Use HTTPS only in production.
- Put uploads behind admin authentication only.
- Use CRM webhook secret if available.
- Keep private user-uploaded files noindexed and inaccessible from public URLs.
