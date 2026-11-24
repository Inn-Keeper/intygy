# Try Intygy on one page of your web app

Intygy opens a page in Chromium and runs automated accessibility checks. Your first
successful scan records existing findings as a baseline and passes. On later
pull requests, new findings fail the check. A green check covers the automated
checks on the pages you selected. Full WCAG or EN 301 549 conformance requires
additional assessment.

To try it, choose a GitHub repo you administer with one public-facing page you can
scan. Allow about 15 minutes of setup once you have the key. Anyone holding a
dashboard, report, or evidence link can read it for 30 days without signing in.
Choose a project whose findings you can share that way.

## 1. Connect the repository

1. [Install the Intygy GitHub App](https://github.com/apps/intygy) and select your
   repo. If the App is already installed on your account, grant it access to this repo.
2. Email <intygy.access@gmail.com> with `owner/repo` to request that repo’s project
   API key. Keys are issued manually and each repo needs its own.
3. In the repo, open **Settings → Secrets and variables → Actions → New repository
   secret**. Name it `INTYGY_KEY` and paste the key.

## 2. Try one deployed page

If your app is already online, you can get a first report with one workflow file.
Use a deployed version of this repo’s default branch so the first baseline
represents the app you want to track. If your app only runs locally, go straight
to [Set up ongoing PR checks](#set-up-ongoing-pr-checks).

In your GitHub repo, choose **Add file → Create new file**. Name it
`.github/workflows/intygy-trial.yml` and paste the workflow below. Replace
`https://your-site.example` with your site’s origin. The example scans the home
page and waits for a visible `main` element. Change the route or selector if your
page uses something else.

```yaml
name: Try Intygy
on:
  push:
    paths:
      - .github/workflows/intygy-trial.yml
permissions:
  contents: read
  id-token: write
jobs:
  scan:
    if: github.ref_name == github.event.repository.default_branch
    runs-on: ubuntu-latest
    steps:
      - name: Choose the page to scan
        run: |
          cat > "$RUNNER_TEMP/intygy.yml" <<'CONFIG'
          target: { url: "https://your-site.example" }
          routes: ["/"]
          readySelector: "main"
          CONFIG
      - uses: Inn-Keeper/intygy@v1
        with:
          api-key: ${{ secrets.INTYGY_KEY }}
          api-base: https://intygy-api.onrender.com
          config-path: ${{ runner.temp }}/intygy.yml
```

Save the file to your default branch, merging a PR if your repo requires one.
Open **Actions → Try Intygy → the latest run → Summary → View scan report**. The first
successful scan passes and records any findings. You can stop here after viewing
your report. The trial runs again only when that workflow file changes on the
default branch.

## Set up ongoing PR checks

When you want feedback on proposed changes, replace the trial workflow with the
two files below. Keep `target: preview` if GitHub records a successful, reachable
deployment for both the PR head commit and the default-branch commit after merge.
Otherwise use the local build example below. A fixed URL always scans the version
currently deployed there.

| Copy from Intygy | Save in your repo | What to change |
| --- | --- | --- |
| [Workflow template](../examples/intygy-workflow.yml) | `.github/workflows/intygy.yml` | Replace `main` with your default branch if needed. Keep the checkout ref, permissions, and hosted API URL. |
| [Scan config](../examples/intygy.yml) | `intygy.yml` at the repo root | Start with one real route. Set `readySelector` to an element visible when its content has loaded. Keep `main` only if it meets that condition. |

**For preview deployments**, keep `target: preview`. The workflow can scan the
deployed page without installing your app’s dependencies.

**To serve in Actions**, build the app after checkout and before the Intygy step.
For example, an npm app with a root `package-lock.json`, Node 22, and a
`build` script can insert these items under `jobs.a11y.steps`:

```yaml
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: npm ci
      - run: npm run build
```

Replace the single `target: preview` line in your scan config with this block
if `npm start` serves your built app on port 3000:

```yaml
target:
  serve: npm start
  url: http://localhost:3000
```

Use your repo’s existing runtime, package manager, install and build commands,
and supply any environment variables the app needs at build or startup.
The Action starts the server from the repo root. For example, in a pnpm workspace
with a package named `web`, reuse your CI’s pnpm setup and install steps, build
with `pnpm --filter web build`, and set `serve: pnpm --filter web start`.
Match `url` to the port your start command actually uses.

### Verify the PR workflow

1. Open a PR from a branch in the same repo containing just the setup files.
2. Open **Actions → Accessibility check** for the PR. When it passes, open
   **View scan report** from the run summary to see what Intygy recorded. If you already ran the trial, this PR compares against the existing baseline.
3. Merge the setup PR and confirm the default-branch push run also succeeds.
   Setup is complete. Use the latest successful run summary for a fresh report link.

To expand coverage, add routes that share the readiness selector. For pages
that require login, follow [Authenticated routes](./OPERATIONS.md#authenticated-routes).

## Optional: require the check and try a regression

The example workflow also runs on fork PRs. Ordinary fork runs lack the project
secret and fail before scanning. Requiring the check can block those contributions.

1. In repository **Settings → Rules → Rulesets**, edit or create an active branch
   ruleset targeting the default branch. Enable **Require status checks to pass**,
   select the check reported by the setup run (`a11y` in the example), and save.
   An existing branch protection rule can require the same check.
2. Open a second same-repository PR. On a scanned route, add a visible button with
   no text or accessible name. Confirm the check fails, the Intygy comment identifies
   the element, and GitHub lists the failed required check as blocking the merge.
3. Give the button an accessible name and push again. Confirm the check passes, then
   merge. Open the default-branch push run, select **View scan report**, and follow the dashboard link to **Export evidence dossier**.
   This run updates the baseline for the coverage it scanned. A resolution appears
   when a previously open baseline finding disappears within that coverage. The
   button fixed before merge never entered the baseline.

## If the first run fails

- **No successful preview deployment** — check whether GitHub recorded a reachable
  URL for the exact commit. Switch to serving in Actions if pushes or PRs lack one.
- **Timed out waiting for the local URL** — check the server output, start command,
  and port. A slow startup can use a larger `target.readyTimeoutMs` (default
  120000). The top-level `readyTimeoutMs` controls the page’s readiness selector.
- **Page or selector failed** — open the configured route and check that its
  readiness marker becomes visible. Start with a single route you can verify.
- **Hosted API timed out after a quiet period** — re-run the job after it wakes up.

For key, token, and other workflow errors, see [Troubleshooting](./OPERATIONS.md#troubleshooting).
