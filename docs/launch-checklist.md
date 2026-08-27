# Launch Checklist

## Local QA

- Run `npm install`
- Create `.env` from `.env.example`
- Run `npm run dev`
- Open `http://localhost:3000`
- Test each tool page
- Test floating AI chat
- Test fallback mode without `OPENAI_API_KEY`
- Add `OPENAI_API_KEY` and test live AI mode
- Submit a lead with consent checked
- Submit a lead without consent and confirm validation blocks it
- Upload a PDF, image, or video
- Open `/admin/` and confirm lead appears
- Download uploaded file through admin

## Production environment

- Set `NODE_ENV=production`
- Set `PUBLIC_BASE_URL=https://answers.protrenchless.com`
- Set `CORS_ORIGIN=https://answers.protrenchless.com`
- Replace `ADMIN_API_KEY`
- Add `OPENAI_API_KEY`
- Confirm `OPENAI_MODEL`
- Configure persistent storage for `/data` and `/uploads`
- Configure HTTPS
- Add backup plan for leads and uploads

## CRM and notifications

- Add `LEAD_WEBHOOK_URL`
- Add `LEAD_WEBHOOK_SECRET` if supported
- Send test lead to CRM/Zapier/GoHighLevel/HubSpot/ServiceTitan middleware
- Optional: configure SendGrid lead notification email
- Confirm uploaded file IDs are visible in admin

## SEO and tracking

- Add Google Search Console for subdomain
- Add GA4/GTM scripts if needed
- Confirm `robots.txt`
- Confirm `sitemap.xml`
- Keep `/admin/`, `/api/`, `/uploads/`, and private reports noindexed
- Add main-site buttons to AI center:
  - Get a Free Sewer Second Opinion
  - Check Your Sewer Backup Risk
  - Upload Your Sewer Camera Video
  - Compare Your Sewer Repair Estimate

## Content and conversion

- Review all tool copy
- Confirm phone number is correct: `(484) 206-5551`
- Confirm Pro Trenchless service page links are correct
- Confirm disclaimer appears on results and forms
- Confirm emergency guidance says to stop using water where possible
- Confirm CTA appears after value is given

## Go live

- Point `answers.protrenchless.com` DNS to host
- Verify HTTPS certificate
- Submit sitemap in Search Console
- Test from mobile
- Test from desktop
- Submit one real test lead
- Confirm CRM and email routing
