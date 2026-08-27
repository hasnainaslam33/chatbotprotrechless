# Backend Setup Guide

This project now includes a working Node.js + Express backend for the Pro Trenchless AI Sewer Decision Center.

## What the backend does

- Serves the website from `/public`
- Runs the AI chat endpoint at `/api/chat`
- Saves lead submissions at `/api/leads`
- Saves uploads at `/api/uploads`
- Logs basic events at `/api/events`
- Provides protected admin endpoints at `/api/admin/*`
- Includes a simple admin dashboard at `/admin/`
- Supports optional OpenAI API responses
- Supports optional lead routing to a webhook or SendGrid email notification

## Local installation

Install Node.js 20 or newer. Then open Command Prompt inside the project folder and run:

```cmd
npm install
copy .env.example .env
npm run dev
```

Open:

```text
http://localhost:3000
```

Backend health check:

```text
http://localhost:3000/health
```

Admin dashboard:

```text
http://localhost:3000/admin/
```

Use the value from `.env`:

```text
ADMIN_API_KEY=change-this-long-random-admin-key
```

## AI setup

The backend works without an API key using local fallback answers. For live AI responses, add this to `.env`:

```env
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-5.2
```

Restart the server after editing `.env`.

## Lead routing

All leads are saved locally in:

```text
data/leads.jsonl
```

Uploaded files are saved in:

```text
uploads/
```

Upload metadata is saved in:

```text
data/uploads.jsonl
```

To send leads to Zapier, GoHighLevel, HubSpot, ServiceTitan middleware, or another CRM, add:

```env
LEAD_WEBHOOK_URL=https://your-webhook-url
LEAD_WEBHOOK_SECRET=optional-secret
```

To email lead notifications through SendGrid, add:

```env
SENDGRID_API_KEY=your_sendgrid_key
NOTIFY_EMAIL_TO=team@example.com
NOTIFY_EMAIL_FROM=verified-sender@example.com
```

## Production notes

Recommended deployment:

- Node.js 20+
- HTTPS enabled
- Reverse proxy such as Nginx, Cloudflare, or the host platform proxy
- Strong `ADMIN_API_KEY`
- `CORS_ORIGIN=https://answers.protrenchless.com`
- Persistent disk or cloud storage for uploads
- CRM webhook for lead routing
- Regular backup for `data/` and `uploads/`

For Vercel/Netlify style hosting, this Express backend should be deployed as a server app, VPS app, Render app, Railway app, Fly.io app, or container service. The static frontend alone is not enough for AI, uploads, lead routing, and admin.

## Real image/video analysis

The original static prototype only stored uploads and displayed a hardcoded recommendation. The updated backend now does this:

1. Tool buttons call `/api/chat` instead of showing a fixed answer.
2. Uploaded images are sent to OpenAI as image inputs.
3. Uploaded videos are sampled into still frames in the browser and those frames are sent as images.
4. The AI answer should change based on the visible image/frame content and form context.

After adding or changing the API key, restart the server:

```cmd
Ctrl + C
npm run dev
```

Then test with a clear image first before testing large videos.

## Admin Login and Dashboard Settings

This version includes a real admin login screen at:

```text
http://localhost:3000/admin/
```

Set these values in `.env` before launch:

```env
ADMIN_USERNAME=admin
ADMIN_PASSWORD=change-this-admin-password
ADMIN_SESSION_SECRET=change-this-long-random-session-secret
ADMIN_API_KEY=change-this-long-random-admin-key
```

After login, the admin can review:

- Overview metrics
- Activity history
- AI chat events
- Leads
- Uploaded files
- Global settings
- Module enable/disable controls

Settings are stored in:

```text
data/settings.json
```

Changing settings does not require a server restart. Disabling a module blocks AI responses, uploads, and lead submissions for that module.
