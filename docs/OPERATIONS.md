# Intygy operations

## Authenticated routes

Create repository Actions secrets `INTYGY_TEST_USER` and `INTYGY_TEST_PASS` for a
dedicated test account. Keep routes, target and readiness settings in the root
`intygy.yml`. The Action reads that file literally. To supply credentials at run time,
insert this step immediately before the Intygy step in the example Ubuntu workflow:

```yaml
- name: Prepare authenticated scan config
  env:
    TEST_USER: ${{ secrets.INTYGY_TEST_USER }}
    TEST_PASS: ${{ secrets.INTYGY_TEST_PASS }}
  run: |
    python3 - <<'PYTHON'
    import json
    import os
    from pathlib import Path

    auth = {
        "login_url": "/login",
        "user": os.environ["TEST_USER"],
        "pass": os.environ["TEST_PASS"],
        "success_selector": "[data-testid=sign-out]",
    }
    path = Path(os.environ["RUNNER_TEMP"]) / "intygy.yml"
    with open(path, "x", opener=lambda name, flags: os.open(name, flags, 0o600)) as config:
        config.write(Path("intygy.yml").read_text() + "\nauth: " + json.dumps(auth) + "\n")
    PYTHON
```

Use a base config without an existing `auth` entry. Adapt the login path and choose
a success selector visible after login and on every scanned route. If your form uses
custom controls, set `user_field`, `pass_field`, and `submit` selectors in `auth`.
Add this input alongside `api-key` and `api-base` in the Intygy step’s `with` block:

```yaml
config-path: ${{ runner.temp }}/intygy.yml
```

## Troubleshooting

- **"No successful preview deployment found"** — the repo has no Vercel/Netlify preview;
  switch `intygy.yml` to the `serve:` target.
- **Invalid scan payload / upgrade error** — deploy the new Action and API together after migration.
- **Missing readiness / authentication selector** — configure application-specific visible markers; do not use a loading shell or login page as proof of readiness.
- **Unexpected redirect** — use the canonical route. A trailing slash is allowed; login redirects and other destinations fail the scan.
- **Inactive installation or repository** — restore App access. Re-adding a removed repo rotates its key; retrieve and replace `INTYGY_KEY`.
- **Stale default-branch scan** — the commit is no longer the branch head. Results remain in history without changing the baseline; scan the current head.
- **No PR comment despite red check** — check API logs; usually the App lacks
  Pull requests write permission or `installation_id` is null (reinstall the App).
- **Missing or invalid workflow token (401)** — the job needs `permissions: id-token: write`,
  and the Action's `api-base` must equal the API's `PUBLIC_BASE_URL`. Pull requests from
  forks cannot obtain a token (or the key) and are not scanned.
- **Scan does not match the workflow token (403)** — the reported repository, branch,
  commit, or pull request differs from the run GitHub attests. Check out the triggering commit.
- **Dashboard or report shows "not found"** — the link is unsigned, older than 30 days, or
  was issued before `LINK_SIGNING_SECRET` changed. Open the link from a recent run summary
  or PR comment; any new scan issues a fresh one.
- **Webhook 401** — `GITHUB_WEBHOOK_SECRET` mismatch between App settings and env.
- **Playwright install slow in CI** — first run downloads Chromium (~1 min);
  add `actions/cache` on `~/.cache/ms-playwright` keyed to the playwright version.
- **Push workflow fails but PR scans work** — `target: preview` needs a deployment for the
  `main` commit. Use `serve:` or a fixed `url:` if your host doesn't deploy on push.
- **Evidence shows no resolved issues after merge** — confirm the workflow includes
  `push: branches: [main]` and that a push scan completed successfully.

See the [architecture guide](./ARCHITECTURE.md) for scan behavior and the [install guide](./INSTALL.md) for API health checks.

## Upgrade an existing database and Action

1. Back up the database and stop the API to avoid writes during fingerprint migration.
2. Apply `db/migrations/001-flow-integrity.sql` against that database. It is transactional
   and safe to rerun. Fresh databases continue to use `db/schema.sql` instead.
3. Deploy the new API, grant the App Contents read permission, and publish the rebuilt
   Action under a new release. Update customer workflows to that release together with
   `readySelector` (and `auth.success_selector` when using login). Do not mix old Actions
   with the version 2 API: they fail explicitly instead of changing baseline state.
4. Retrieve rotated keys for repositories that were removed and re-added. Keys for
   continuously active installations are preserved.
5. Run a current default-branch scan and inspect the linked report and evidence coverage.

The migration maps each old fingerprint to its latest recorded first selector and keeps
its first-seen and last-resolution dates. The original fingerprint is retained in
`legacy_fingerprint`; old violation rows are unchanged. Additional nodes that the old
scanner discarded cannot be grandfathered safely and may now block PRs. Structured
iframe/shadow selectors and changed exact selectors can also appear as new findings.
Unmappable legacy baseline rows remain unchanged and are shown outside verified coverage.
Do not delete those rows or silently accept current findings just to get a green check.

Older resolution/reopening cycles were overwritten by the old schema and cannot be
reconstructed. Evidence labels the imported snapshot; all future cycles are retained.
Restoring the database backup and previous API/Action is the rollback path; do not run
old ingestion code against migrated fingerprints. No deployment or migration is run by
the repository's test/build commands.

For SQL tests against a disposable Postgres instance, set `INTYGY_TEST_DATABASE_URL` and
run `pnpm test`. See `ARCHITECTURE.md` for embedded versus multi-connection test scope.

## Maintainers: release the Action

Customer repos use the Action as `Inn-Keeper/intygy@v1`. After changing `packages/action/src`:

```bash
pnpm build:action
git add packages/action/dist && git commit -m "Build action" && git push
```

CI fails if the committed `dist/` is stale. Then publish a GitHub Release tagged `vX.Y.Z`;
the release workflow moves the `vX` tag to it. Tick **Publish this Action to the GitHub
Marketplace** on the release form to list it.
