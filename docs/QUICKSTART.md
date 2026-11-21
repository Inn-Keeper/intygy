# Quickstart: try Intygy on your repository

Allow about 15 minutes of hands-on setup after you receive your project API key. You need admin access to a GitHub repository with a web app that
either has Vercel/Netlify preview deployments or can be built and served inside GitHub Actions.

Intygy scans the routes you list with axe-core on same-repository pull requests, fails the check for **new**
automated WCAG findings, and keeps a dated history of findings and fixes.

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
- Keep `target: preview` if GitHub records a successful deployment with a reachable URL
  for **both** the PR head commit and the default-branch commit after merge.
- Otherwise use the example’s `serve` target. Install your app’s dependencies before the
  Intygy step, set the local URL and port, and build only once. The example’s serve
  command already builds the app before starting it.
- Start with a public route if available. For routes behind a login, see
  [Authenticated routes](./INSTALL.md#authenticated-routes).

## 6. Establish the baseline

Open a setup PR from a branch in the same repository containing the workflow and config.
Keep the app unchanged for this first scan. Wait for **Accessibility check** to finish,
then open **Dashboard** from the Actions run summary. The first successful scan records
existing findings as the baseline and passes even when that count is above zero.

Merge the setup PR. In **Actions**, confirm the push run for the default branch also
succeeds. Use the dashboard link from the latest successful run whenever you need a
fresh signed link.

## 7. Require the check and verify it blocks a merge

Ordinary fork PRs cannot access the project secret. Requiring this check can leave those PRs blocked.

1. In repository **Settings → Rules → Rulesets**, edit or create an active branch
   ruleset targeting the default branch. Enable **Require status checks to pass**,
   select the check reported by the setup run (`a11y` in the example), and save.
   An existing branch protection rule can require the same check.
2. Open a second same-repository PR. On a scanned route, add a visible button with
   no text or accessible name. Confirm the check fails, the Intygy comment identifies
   the element, and GitHub lists the failed required check as blocking the merge.
3. Give the button an accessible name and push again. Confirm the check passes, then
   merge. Open the default-branch push run and follow **Dashboard → Export evidence dossier**.
   This run updates the baseline for the coverage it scanned. A resolution appears
   when a previously open baseline finding disappears within that coverage. The
   button fixed before merge never entered the baseline.

The first scan after a quiet period can take longer while the hosted API wakes up. If it
times out, re-run the job.

## If something fails

See [Troubleshooting](./INSTALL.md#troubleshooting) in the self-hosting guide; the workflow
and scan errors listed there apply to hosted use too.
