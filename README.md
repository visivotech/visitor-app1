# Visitor Registration App

A reception-desk sign-in/sign-out app.

- **Frontend:** React + Vite, deployed to **AWS Amplify** (static hosting)
- **Backend/API:** **Google Apps Script** Web App (handles writes + sends emails)
- **Database:** **Google Sheets** (two tabs: `Visitors`, `Hosts`)

## How the pieces fit together

```
[ Visitor's browser ]
         │
         │   HTTPS (fetch)
         ▼
[ React app on Amplify ]  ← static files only
         │
         │   POST /exec   (text/plain, JSON body)
         ▼
[ Apps Script Web App ]  ← API + emailer
         │
         ▼
[ Google Sheet ]         ← your "database"
```

**Why this architecture?** Browsers can't securely write to a Google Sheet directly — you'd have to ship credentials. Apps Script is the only way to expose a Google Sheet as an authenticated API without running your own server, and it can send emails on your behalf for free (`MailApp.sendEmail`).

---

## Part 1 — Set up the Google Sheet + Apps Script backend

### 1. Create the Sheet

1. Go to [sheets.new](https://sheets.new) and create a blank spreadsheet.
2. Name it something like **"Visitor Log"**.
3. Copy the **Sheet ID** from the URL — it's the long string between `/d/` and `/edit`:

   ```
   https://docs.google.com/spreadsheets/d/ 1AbC...XyZ /edit#gid=0
                                            ^^^^^^^^^^
                                            this is the ID
   ```

### 2. Add the Apps Script

1. In the Sheet, go to **Extensions ▸ Apps Script**. A new tab opens.
2. Delete the default `function myFunction() {}` stub.
3. Open `google-apps-script/Code.gs` from this project, copy **all** of its contents, and paste into the Apps Script editor.
4. At the top of the file, replace:
   ```js
   const SHEET_ID = 'REPLACE_WITH_YOUR_SHEET_ID';
   ```
   with your actual Sheet ID from step 1.
5. If you're not in the UK, change `TIMEZONE` too (e.g. `'America/New_York'`, `'Asia/Singapore'`).
6. Optionally change `COMPANY_NAME` — it appears in the email signature.
7. Click the **Save** icon (or Ctrl/Cmd + S).

### 3. Initialise the tabs

1. In the Apps Script editor, select **`setupSheet`** from the function dropdown at the top.
2. Click **Run**.
3. The first time, Google will ask for permissions — click **Review permissions**, choose your account, click **Advanced ▸ Go to (project name) (unsafe)**, then **Allow**. (This is normal for personal Apps Scripts — Google shows this warning for anything not reviewed by them.)
4. Switch back to your Sheet tab — you'll see two new tabs: **Visitors** and **Hosts**, both with headers.

### 4. Add your hosts

In the **Hosts** tab, fill in rows with the people visitors might come to see:

| Name           | Email                  |
|----------------|------------------------|
| Jane Smith     | jane@example.com       |
| Ahmed Patel    | ahmed@example.com      |
| Priya Nair     | priya@example.com      |

The **Name** column is what shows in the dropdown. The **Email** is who gets notified.

### 5. Deploy as a Web App

1. In the Apps Script editor, click **Deploy ▸ New deployment**.
2. Click the gear icon next to "Select type" and choose **Web app**.
3. Fill in:
   - **Description:** `Visitor API v1` (anything you like)
   - **Execute as:** **Me** (your email)
   - **Who has access:** **Anyone** ← important, or your app can't reach it
4. Click **Deploy**.
5. You may need to **Authorize access** again — same flow as before.
6. Copy the **Web app URL** that looks like:
   ```
   https://script.google.com/macros/s/AKfyc...long-string.../exec
   ```
   **Save this URL** — you'll need it in Part 2.

> ℹ️ **When you update the Apps Script later**, you must redeploy: **Deploy ▸ Manage deployments ▸** pencil icon **▸ Version: New version ▸ Deploy**. This keeps the same URL.

### 6. Quick sanity check

Paste this into your browser, replacing the URL:
```
https://script.google.com/macros/s/.../exec?action=hosts
```
You should see a JSON response with your hosts list. If you see an HTML error page, the deployment access isn't set to "Anyone", or the `SHEET_ID` is wrong.

---

## Part 2 — Deploy the React app to AWS Amplify

### 1. Push to GitHub

```bash
cd visitor-app
git init
git add .
git commit -m "Initial visitor app"
# create an empty repo on GitHub called visitor-app, then:
git remote add origin https://github.com/YOUR_USERNAME/visitor-app.git
git branch -M main
git push -u origin main
```

### 2. Connect Amplify

1. Sign in to [AWS Amplify Console](https://console.aws.amazon.com/amplify).
2. Click **Create new app ▸ Host web app**.
3. Choose **GitHub** as your source and authorise AWS.
4. Pick your `visitor-app` repo and the `main` branch.
5. Amplify will auto-detect the `amplify.yml` build spec — just click **Next**.
6. **Important:** before clicking the final **Save and deploy**, expand **Advanced settings ▸ Environment variables** and add:

   | Variable         | Value                                            |
   |------------------|--------------------------------------------------|
   | `VITE_API_URL`   | *the `/exec` URL you copied from Apps Script*    |

7. Click **Save and deploy**.

Amplify will build and deploy in 2–3 minutes. When done, you'll get a URL like `https://main.d1abc234.amplifyapp.com`.

### 3. Optional — Custom domain

In Amplify ▸ your app ▸ **Domain management**, add your own domain (e.g. `checkin.yourcompany.com`). Amplify issues an SSL cert automatically.

---

## Part 3 — Local development (optional)

You don't need to run it locally, but if you want to iterate on the UI:

```bash
cd visitor-app
npm install
cp .env.example .env.local
# edit .env.local — paste your /exec URL into VITE_API_URL
npm run dev
```

Open <http://localhost:5173>.

---

## How the data flows

**Sign-in** → `POST /exec` with `{action: "signin", name, reason, host}`
- Appends a row: `Name | Reason | Host | Date | Arrival | (blank)`
- Looks up the host's email in the Hosts tab
- Sends `MailApp.sendEmail(...)` — delivered from your Google account

**Sign-out** → `POST /exec` with `{action: "signout", name}`
- Finds that name's most recent sign-in **today** with no departure
- Fills in the **Departure** column

**Autocomplete on sign-out** → `GET /exec?action=active`
- Returns everyone signed in today who hasn't signed out yet
- UI filters as the visitor types

---

## Troubleshooting

**"Failed to fetch" / CORS errors**
Apps Script Web Apps don't handle CORS preflight. The app already uses `Content-Type: text/plain` for POSTs to avoid this — don't change it.

**Emails aren't sending**
Check the spelling of host names — the dropdown `Name` must exactly match a row in the Hosts tab. Case doesn't matter but spelling does. Also check your Gmail "Sent" folder — the emails come from your own account.

**"Sorry, unable to open the file" when hitting the /exec URL**
The deployment access isn't set to **Anyone**. Go back to **Deploy ▸ Manage deployments** and edit it.

**Hit Google's email quota**
Consumer Gmail accounts have a 100/day `MailApp.sendEmail` quota. For a reception desk this is plenty. If you need more, Workspace accounts get 1,500/day.

**Wrong timezone on timestamps**
Change `TIMEZONE` at the top of `Code.gs`, then redeploy (Deploy ▸ Manage deployments ▸ new version).

---

## Editing the app later

- **Add/remove hosts:** just edit the Hosts tab in the Sheet. No redeploy needed.
- **Change the backend logic:** edit `Code.gs`, then Deploy ▸ Manage deployments ▸ new version.
- **Change the UI:** edit the React code, commit & push — Amplify auto-rebuilds.

---

## What "database" means here

Google Sheets is not a SQL database — it's a spreadsheet. That's fine for a reception desk, but know the limits:

- Hard cap: 10 million cells per Sheet (you'll never hit this)
- Practical slowness: past ~10,000 rows, reads get noticeably slower
- No real concurrent-write safety (fine at reception volume, not fine for high traffic)

When you outgrow it, the Apps Script layer is the only thing to replace — the React app can keep talking to the same `/exec`-style endpoint if you swap the backend for AWS Lambda + DynamoDB.
