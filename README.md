# Liaizon

## Local Quick Start

Run and test revisions locally without pushing to preview:

```sh
npm install
npm run dev:local
```

What `npm run dev:local` does:

- Creates `.env.local` from `.env.example` if it does not already exist
- Verifies `GOOGLE_APPLICATION_CREDENTIALS` is configured and points to a readable file
- Starts Vite in dev mode and opens your browser at `http://localhost:5173`

Then iterate locally:

- Edit code under `src/`
- Vite hot-reloads changes instantly
- Stop the dev server with `Ctrl+C`

## Developing

Once you've created a project and installed dependencies with `npm install` (or `pnpm install` or `yarn`), start a development server:

Before starting the app locally, create a `.env.local` file from `.env.example` and fill in your Firebase and GCP values.

```sh
cp .env.example .env.local
npm run dev

# or start the server and open the app in a new browser tab
npm run dev:open
```

## Local Firebase Setup

The auth flow expects Firebase web client config for Google sign-in:

- Preferred: `PUBLIC_FIREBASE_API_KEY`, `PUBLIC_FIREBASE_AUTH_DOMAIN`, `PUBLIC_FIREBASE_PROJECT_ID`, `PUBLIC_FIREBASE_STORAGE_BUCKET`, `PUBLIC_FIREBASE_MESSAGING_SENDER_ID`, `PUBLIC_FIREBASE_APP_ID`
- Also supported: `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`

The server side expects a Firebase/GCP project as well:

- `GCP_PROJECT_ID`
- Either `GOOGLE_APPLICATION_CREDENTIALS` pointing at a service-account JSON file, or both `FIREBASE_CLIENT_EMAIL` and `FIREBASE_PRIVATE_KEY`

Important: set `GCP_PROJECT_ID` to the same Firebase project used by your web client config (for example `liaizon-492523`). A mismatch will cause "Invalid Firebase ID token" errors due to audience (`aud`) verification failure.

Optional engineer-managed auth bootstrap (to avoid user token setup UI):

- `AUTH_BOOTSTRAP_ENABLED=true`
- `AUTH_BOOTSTRAP_SESSION_COOKIE=<firebase session cookie>` (preferred)
- `AUTH_BOOTSTRAP_ID_TOKEN=<firebase id token>` (fallback; converted to session cookie at sign-in)
- `AUTH_BOOTSTRAP_COMPANY_ID=<company id>` (defaults to `demo-company`)

When enabled, the auth page uses server-side env configuration for sign-in and does not require end users to provide a Firebase ID token. Session cookies are used for server auth verification.

Recruiter pages also perform periodic server session refresh using the signed-in Firebase user context, reducing unexpected sign-outs for active users.

Generate a session cookie from a one-time ID token:

```sh
npm run auth:session-cookie -- --id-token '<firebase-id-token>' --expires-days 7
```

The command prints an `AUTH_BOOTSTRAP_SESSION_COOKIE=...` value you can place in `.env.local`.

You can also mint this directly from the admin console:

```sh
npm run dev
# Navigate to http://localhost:5173/recruiter/admin
# Open "Bootstrap Auth" and generate a snippet
```

### Production bootstrap rotation runbook

1. Generate a fresh session cookie from a one-time admin ID token:

```sh
npm run auth:session-cookie -- --id-token '<firebase-id-token>' --expires-days 7
```

2. Update runtime secrets/config with:
	- `AUTH_BOOTSTRAP_SESSION_COOKIE=<new-cookie>`
	- `AUTH_BOOTSTRAP_COMPANY_ID=<company-id>`
	- `AUTH_BOOTSTRAP_ENABLED=true`
3. Clear `AUTH_BOOTSTRAP_ID_TOKEN` after rotation; do not keep ID tokens in persistent config.
4. Roll/redeploy the service so new instances use the new cookie.
5. Verify sign-in by loading `/auth` and confirming redirect to `/recruiter`.

Recommendation: rotate bootstrap session cookies on a regular cadence (for example weekly) and immediately after privileged account changes.

Alternatively, in **development mode**, use the debug web interface:

```sh
npm run dev
# Navigate to http://localhost:5173/debug/mint-session-cookie
```

The web interface provides an interactive form to paste a Firebase ID token and get a session cookie ready for your env.

If the Firebase web config is missing, the auth page still loads, but Google sign-in will show an inline configuration error.

## Building

To create a production version of your app:

```sh
npm run build
```

You can preview the production build with `npm run preview`.

## Cloud Run deploy (persistent custom domain config)

Use the checked-in deploy script so domain settings remain consistent across deployments:

```sh
npm run deploy:cloudrun
```

Defaults used by the script:

- `SERVICE_NAME=liaizon`
- `REGION=us-central1`
- `DOMAIN=liaizon.faberdevelopment.com`

You can override these when needed:

```sh
SERVICE_NAME=liaizon REGION=us-central1 DOMAIN=liaizon.faberdevelopment.com npm run deploy:cloudrun
```

What the script enforces every deploy:

- Deploys the latest source to Cloud Run.
- Updates `APP_BASE_URL` to `https://liaizon.faberdevelopment.com`.
- Verifies (or creates) the Cloud Run domain mapping.
- Prints post-deploy checks for `APP_BASE_URL` and mapping readiness.

Important: avoid `gcloud run deploy --set-env-vars ...` unless `APP_BASE_URL` is included, because `--set-env-vars` replaces existing values.

## Firestore rules and indexes

This repository now includes Firestore security and index configuration:

- `firestore.rules`
- `firestore.indexes.json`
- `firebase.json`

To deploy only Firestore configuration:

```sh
npx firebase-tools deploy --only firestore:rules,firestore:indexes
```

To apply indexes only:

```sh
npx firebase-tools deploy --only firestore:indexes
```
