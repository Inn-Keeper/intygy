# Intygy

Intygy checks web pages for accessibility regressions in GitHub Actions and keeps a dated
record of findings, scan coverage, and fixes.

[Intygy website](https://intygy-landing.vercel.app/) · [Try it on your repository](docs/QUICKSTART.md) · [Self-host the API](docs/INSTALL.md) · [See a real PR](https://github.com/Inn-Keeper/innkeeper-forge/pull/1#issuecomment-6804225570)

## How it works

1. The Action scans configured routes and viewports with Playwright and axe-core. The
   first successful scan establishes a baseline and passes even when it finds existing issues.
2. On subsequent same-repository PRs, new findings fail the check. Make the check required
   in GitHub to block merging. The GitHub App can post the affected elements and fix guidance.
3. A scan of the current default-branch commit updates the baseline. An open finding
   resolves when the scan covers the same route, viewport, and ruleset and the finding is gone. The HTML evidence dossier shows coverage,
   dated issue history, and a partial register of 15 criteria for accessibility review.

Automated checks cover part of WCAG. Assessing WCAG or EN 301 549 conformance also
requires human review. Each GitHub repository needs its own manually issued project key.
Anyone with a signed dashboard, report, or evidence link can read the project for up to 30 days.

## Development

```sh
pnpm install --frozen-lockfile
pnpm --filter @intygy/action exec playwright install --with-deps chromium
pnpm test
pnpm typecheck
pnpm build:action  # rebuild the checked-in bundle after Action changes
```

For local API startup, configure the database, GitHub App, public URL, webhook and
link-signing secrets in the [install guide](docs/INSTALL.md), then run `pnpm dev:api`.

[Architecture and test setup](docs/ARCHITECTURE.md) · [Database upgrades](docs/OPERATIONS.md#upgrade-an-existing-database-and-action) · [Changelog](CHANGELOG.md) · [Presentation (PDF)](docs/Intygy-overview.pdf)
