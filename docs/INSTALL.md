# Self-host Intygy

To scan a repository using the hosted service, start with the [Quickstart](./QUICKSTART.md).
To run your own service, you need Postgres, a Node host with a public HTTPS URL,
and permission to create a GitHub App.

## 1. Prepare Postgres

For a fresh database, apply [schema.sql](../db/schema.sql) using a direct connection.
Use the pooled connection URL for the running API if your provider offers one.
For an existing installation, follow the [upgrade procedure](./OPERATIONS.md#upgrade-an-existing-database-and-action).

## 2. Create your GitHub App

In GitHub **Settings → Developer settings → GitHub Apps**, create an App with a
unique name. Use your API URL as the homepage and append `/api/github/webhook`
for the webhook URL. Set a webhook secret and keep the default installation events.

Grant **Contents** and **Metadata** read access and **Pull requests** and **Issues**
read/write access. Save the App ID and generate a private key.

## 3. Start the API

Deploy from the repository root. Set these values in your host’s secret settings.
For local development, copy [the environment template](../packages/api/.env.example) to
`packages/api/.env`.

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | Postgres connection URL |
| `PUBLIC_BASE_URL` | Public API URL without a trailing slash |
| `GITHUB_APP_ID` | App ID from GitHub |
| `GITHUB_APP_PRIVATE_KEY_B64` | Base64-encoded contents of the downloaded PEM file, on one line |
| `GITHUB_WEBHOOK_SECRET` | The secret you set on the GitHub App |
| `LINK_SIGNING_SECRET` | A separate secret generated with `openssl rand -hex 32`. Rotating it revokes all report links. |

Install with `pnpm install --frozen-lockfile`, including development dependencies
for `tsx`. Start with `pnpm --filter @intygy/api start`. Locally, use `pnpm dev:api`.
GitHub must be able to deliver webhooks, and Actions runners must be able to reach the API.

Open `/healthz` to check the process. To check database connectivity, run this
against your API. Expect HTTP 401 with `unknown api key`; HTTP 500 indicates a server error.

```sh
curl -i -X POST https://YOUR_API/api/ingest \
  -H 'Authorization: Bearer invalid' -H 'Content-Type: application/json' -d '{}'
```

## 4. Connect one repository

Install your App on the target repo. Once the installation webhook provisions it,
retrieve its key in your database client:

```sql
SELECT p.api_key
FROM projects p
JOIN installations i ON i.id = p.installation_id
WHERE p.repo = 'owner/repo' AND p.active AND i.active;
```

Give the key to the repo administrator to save as the Actions secret `INTYGY_KEY`.
Follow the [Quickstart’s first scan](./QUICKSTART.md#2-try-one-deployed-page), using
your exact `PUBLIC_BASE_URL` for the workflow’s `api-base`. Open **View scan report** from
the successful run summary to see the result.

For login-protected routes, troubleshooting, database upgrades, and Action releases,
see the [operations guide](./OPERATIONS.md).
