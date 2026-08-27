# Instant Sewer & Drain Answers

Powered by Pro Trenchless Services

This project is a launch-ready starter package for the Pro Trenchless AI Sewer Decision Center on `answers.protrenchless.com`.

It includes:

- Public frontend pages for the AI Sewer Decision Center
- Tool landing pages for symptom checking, estimate review, camera review, cost planning, emergency risk, and user-specific sewer triage
- A working Node.js + Express backend
- AI chat endpoint using the OpenAI Responses API when an API key is added
- Safe fallback AI answers when no API key is configured
- Lead capture endpoint
- Secure file upload endpoint
- Protected admin API and admin dashboard
- Local JSONL storage for leads, uploads, chats, and events
- Optional webhook routing to Zapier, GoHighLevel, HubSpot, ServiceTitan middleware, or other CRMs
- Optional SendGrid email notifications
- SEO setup, schema, sitemap, robots file, and internal linking recommendations
- Prompt files and module logic for developer handoff

## Public name

Instant Sewer & Drain Answers

## Backend/system name

Pro Trenchless AI Sewer Decision Center

## Recommended subdomain

```text
answers.protrenchless.com
```

## Run locally

Install Node.js 20 or newer, then run these commands from the project folder:

```cmd
npm install
copy .env.example .env
npm run dev
```

Open the site:

```text
http://localhost:3000
```

Open the admin dashboard:

```text
http://localhost:3000/admin/
```

The admin dashboard will ask for the `ADMIN_API_KEY` from your `.env` file.

## AI setup

The backend works without an API key using local fallback answers.

For live AI answers, edit `.env`:

```env
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-5.2
```

Restart the server after changing `.env`.

## Backend folders

```text
server/              Express backend
server/routes/       API routes for chat, leads, uploads, admin, events, modules
server/services/     AI, prompts, storage, module configuration, lead routing
public/              Website frontend
public/admin/        Simple protected admin dashboard UI
prompts/             Master AI prompts and module prompts
docs/                Developer handoff, setup, API reference, launch checklist
seo/                 SEO architecture, schema, tracking plan
marketing/           GBP, paid search, and video CTA ideas
forms/               Lead payload example
data/                Local JSONL data storage
uploads/             Uploaded files
```

## Important URLs

```text
GET  /health
POST /api/chat
POST /api/leads
POST /api/uploads
POST /api/events
GET  /api/modules
GET  /api/admin/stats
GET  /api/admin/leads
GET  /api/admin/uploads
GET  /admin/
```

## Production checklist

Before launch:

- Change `ADMIN_API_KEY`
- Add `OPENAI_API_KEY`
- Set `PUBLIC_BASE_URL=https://answers.protrenchless.com`
- Set `CORS_ORIGIN=https://answers.protrenchless.com`
- Connect `LEAD_WEBHOOK_URL` to CRM or Zapier
- Configure persistent storage for `data/` and `uploads/`
- Add HTTPS
- Add Search Console property for the subdomain
- Confirm `robots.txt` keeps private outputs and admin pages blocked
- Test lead submission with file upload
- Test emergency flow and phone CTA

## Docs

Start here:

```text
docs/backend-setup.md
docs/api-reference.md
docs/developer-handoff.md
docs/launch-checklist.md
```

## Multimodal image/video review

This backend now sends uploaded images to OpenAI for real visual review. Videos are handled by extracting still frames in the browser, then sending those frames as image inputs to the AI. Use `/tools/sewer-camera-review.html` or `/tools/free-second-opinion.html`, upload an image/video, and click `Generate guided recommendation`.

See `docs/multimodal-analysis.md` for setup and testing notes.


## Latest tool behavior fix

The guided tool buttons now use conditional logic:

- If the user selects an image, video, document, estimate, or report upload, the frontend uploads the file, extracts video frames when possible, and sends the visual/file context to the AI backend for review.
- If the user does not select any upload, the tool keeps the original selected-option flow, such as symptom scoring, emergency risk scoring, estimate clarity, cost planning, or the module-specific guidance already built into the page.
- This prevents the AI from giving the same generic answer when there is no uploaded media and keeps the user’s picked options/details as the source of the result.


## AI All Modules + Cost Estimator Update

Every module button now calls the AI response endpoint. If no upload is selected, the AI uses the selected options and typed intake details. The Cost Estimator also displays a designed estimated-cost card with a rough planning range. See `docs/ai-all-modules-cost-estimator-update.md`.

## Admin Dashboard Login

The dashboard now has a login screen instead of the old admin-key box.

Open:

```text
http://localhost:3000/admin/
```

Add these values to `.env`:

```env
ADMIN_USERNAME=admin
ADMIN_PASSWORD=change-this-admin-password
ADMIN_SESSION_SECRET=change-this-long-random-session-secret
ADMIN_API_KEY=change-this-long-random-admin-key
```

After login, the admin dashboard includes:

- Overview metrics
- Activity log
- Lead review
- Upload review and download links
- Global settings
- Module enable/disable controls

Module settings are saved in `data/settings.json`. A restart is not needed after saving settings.
