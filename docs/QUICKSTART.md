# Quickstart: try Intygy on your repository

Time: about 15 minutes. You need admin access to a GitHub repository with a web app that
either has Vercel/Netlify preview deployments or can be built and served inside GitHub Actions.

Intygy scans the routes you list with axe-core on every pull request, blocks only **new**
WCAG 2.2 violations, and keeps a dated history of findings and fixes.

## Before you start

- Dashboard, scan report, and evidence pages have no login. They open through signed links
  that expire after 30 days, and anyone holding a link can read them. Do not test on a
  project whose accessibility findings are confidential.
- Automated scans find a subset of accessibility problems. A green check is not a claim of
  full WCAG or EN 301 549 conformance.
- Only GitHub is supported. Pull requests from forks are not scanned.

## 1. Install the GitHub App

Open <https://github.com/apps/intygy>, click **Install**, and select the repository you
want to scan. The App posts pull-request comments when a scan finds new violations.

## 2. Get your API key

Email <intygy.access@gmail.com> with the repository name (`owner/repo`). We reply with your project API
key. This step is manual for now.

## 3. Add the key as a secret

In the repository: **Settings → Secrets and variables → Actions → New repository secret**.
Name it `INTYGY_KEY` and paste the key.

## 4. Add the workflow

Copy [`examples/intygy-workflow.yml`](../examples/intygy-workflow.yml) to
`.github/workflows/intygy.yml`. Then:

- Replace `main` under `push: branches:` with your default branch if it differs.
- Leave `api-base` and the `permissions` block as they are; scans are rejected without
  `id-token: write`.

## 5. Add the scan config

Copy [`examples/intygy.yml`](../examples/intygy.yml) to the repository root. Then:

- Set `routes` to real paths in your app.
- Set `readySelector` to an element that is visible only once a page has finished loading,
  not a loading shell.
- No Vercel/Netlify previews? Switch `target` to the `serve:` variant and add your app's
  install and build steps to the workflow before the Intygy step.
- Scanning pages behind a login also needs `auth.success_selector`, an element visible
  after login and on every scanned route.

## 6. Open a pull request

1. The first scan records your existing issues as the baseline. The check is green, and
   the job summary links to your dashboard.
2. To see a block, open a pull request that adds a visible button with no text or
   accessible name. The check goes red and the Intygy bot comments with the rule, the WCAG
   criterion, the selector, and a fix link.
3. Fix it and push; the check goes green. Merging to your default branch updates the
   baseline and records resolved issues.

The first scan after a quiet period can take longer while the hosted API wakes up. If it
times out, re-run the job.

## If something fails

See [Troubleshooting](./INSTALL.md#troubleshooting) in the self-hosting guide; the workflow
and scan errors listed there apply to hosted use too.
