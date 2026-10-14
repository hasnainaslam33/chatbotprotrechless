# Deploying to Railway

The app runs on Railway as a single Node.js service: the Express server serves the
built React site (`dist/`) and the API from the same address. Uploads, leads, reports
and the research cache are stored on a Railway volume so they survive restarts and
redeploys.

`railway.json` in the repo root already tells Railway how to start the app
(`npm start`) and how to check it is healthy (`/health`).

## 1. Create the service

1. Sign in at <https://railway.com> with GitHub. The Hobby plan (about $5/month) is
   needed for volumes; new accounts get a trial credit.
2. **New Project → Deploy from GitHub repo →** `hasnainaslam33/chatbotprotrechless`.
   If the repo is not listed, use **Configure GitHub App** to grant Railway access.
   Only someone with access to the repo can grant this.
3. The first deploy may fail or run without settings — that is expected until the
   variables below are added.

## 2. Add a volume

1. On the service, open **Settings → Volumes → Add Volume**, or right-click the
   service on the canvas → **Attach volume**.
2. Set the mount path to `/data`.

## 3. Add variables

Open the service's **Variables** tab → **Raw Editor** and paste the following, filling
in the values:

```
NODE_ENV=production
OPENAI_API_KEY=<your OpenAI key>
OPENAI_MODEL=gpt-5.2

DATA_DIR=/data/data
UPLOAD_DIR=/data/uploads

PUBLIC_BASE_URL=https://<your-app>.up.railway.app
CORS_ORIGIN=https://<your-app>.up.railway.app

ADMIN_USERNAME=admin
ADMIN_PASSWORD=<long random value>
ADMIN_API_KEY=<long random value>
ADMIN_SESSION_SECRET=<long random value>
```

Then copy across any of these from your local `.env` that you use: `SENDGRID_API_KEY`,
`NOTIFY_EMAIL_TO`, `NOTIFY_EMAIL_FROM`, `LEAD_WEBHOOK_URL`, `LEAD_WEBHOOK_SECRET`,
`BUSINESS_NAME`, `BUSINESS_PHONE`, `MAIN_SITE_URL`, `AI_SITE_URL`, and the
upload/vision limits if you changed them.

Important:

- **Do not set `PORT`.** Railway provides it.
- **Never leave the admin values unset.** Without them the admin dashboard falls back
  to the default password `admin12345`.
- **`PUBLIC_BASE_URL` and `CORS_ORIGIN` must exactly match the address people use**
  (including `https://`, no trailing slash). Otherwise the browser's requests are
  rejected and chat, uploads and comparisons fail. You get the address in step 4;
  come back and fill these in, then redeploy.

## 4. Get a public address

**Settings → Networking → Generate Domain.** This gives an address like
`https://<your-app>.up.railway.app`. Put it in `PUBLIC_BASE_URL` and `CORS_ORIGIN`.
Railway redeploys automatically when variables change.

## 5. Check it works

- `https://<your-app>.up.railway.app/health` should return `"ok": true` and a masked
  OpenAI key (not `MISSING`).
- Open the site, ask Flo a question, and run an estimate comparison with an upload.
- Log in to `/admin` with the new admin username and password.

On the first start, admin settings (enabled modules, phone numbers) are created from
the defaults, not copied from the repo's `data/settings.json`. Review them in the admin
dashboard.

## 6. Optional: use answers.protrenchless.com

1. In Railway: **Settings → Networking → Custom Domain**, enter
   `answers.protrenchless.com`. Railway shows the DNS records to create.
2. In Cloudflare (whoever manages the `protrenchless.com` zone): **DNS → Add record**,
   and create exactly the records Railway shows (a `CNAME` for `answers`, plus a `TXT`
   verification record if Railway asks for one).
3. If the record is proxied (orange cloud), set Cloudflare **SSL/TLS → Overview** to
   **Full**. Flexible causes redirect loops.
4. Once Railway shows the domain as verified, change `PUBLIC_BASE_URL` and
   `CORS_ORIGIN` to `https://answers.protrenchless.com`.

## Updating the live site

Railway redeploys on every push to `main`. It does not build the React site itself,
so run `npm run build:ui` and commit the updated `dist/` folder together with your
source changes before pushing.
