# Connect Google Sheets from the admin dashboard

The Admin Dashboard can connect a Google account, browse its spreadsheets, and
select the tab that receives Estimate Comparison Tool customer details. The
spreadsheet and tab are saved as the destination for new form submissions.

## Configure Google OAuth

1. In Google Cloud Console, create or select a project and enable the **Google
   Drive API** and **Google Sheets API**.
2. Configure the OAuth consent screen. Add the Google account that will connect
   as a test user while the app is in testing mode.
3. Create an OAuth client ID with application type **Web application**.
4. Add this exact redirect URI to **Authorized redirect URIs**:

   ```text
   http://localhost:3000/api/admin/google-sheets/oauth/callback
   ```

   For a hosted deployment, use
   `https://YOUR_APP_HOST/api/admin/google-sheets/oauth/callback`. If the
   callback path must differ, set `GOOGLE_OAUTH_REDIRECT_URI` to the exact URI
   registered with Google. The URI is also shown in Admin → Settings.
5. Add the OAuth client credentials to the server's private `.env` file:

   ```env
   GOOGLE_OAUTH_CLIENT_ID=your-client-id.apps.googleusercontent.com
   GOOGLE_OAUTH_CLIENT_SECRET=your-client-secret
   GOOGLE_OAUTH_ENCRYPTION_KEY=generate-a-random-secret-at-least-32-characters
   PUBLIC_BASE_URL=http://localhost:3000
   ```

   Generate an encryption key with
   `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`.
   Keep it stable and private; the encrypted Google connection cannot be read
   if this key changes.
   Use your public HTTPS app URL for `PUBLIC_BASE_URL` in production. Keep the
   client secret private. Restart the backend after changing `.env`.

Google requests permission to view spreadsheet metadata so the dashboard can
list files, read spreadsheet tabs, and append values to the selected sheet.
Google may require OAuth app verification before external users can authorize
the app outside the consent screen's test-user list.

## Select the destination

1. Open `/admin/`, sign in, and go to **Settings**.
2. Choose **Connect Google Drive** and authorize the intended Google account.
3. Search for and select a spreadsheet, then choose its tab and save the
   destination.
4. New Estimate Comparison Tool submissions are appended to that tab when the
   customer selects **Continue to upload estimates**.

The sheet's first row is given these headers if it is blank: Submission ID,
Submitted At (UTC), Customer Name, Street Address, City, State, and ZIP Code.
The app writes values as raw text and uses the submission ID to avoid duplicate
rows when a browser retries the same submission.

OAuth tokens and the selected destination are stored encrypted in
`DATA_DIR/google-sheets-connection.json`. Encryption uses
`GOOGLE_OAUTH_ENCRYPTION_KEY`. Back up the data directory and keep it
protected.
