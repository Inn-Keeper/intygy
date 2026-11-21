# Intygy

Intygy checks web pages for accessibility regressions in GitHub Actions and keeps a dated
record of findings, scan coverage, and fixes.

[Try it on your repository](docs/QUICKSTART.md) · [Self-host the API](docs/INSTALL.md) · [See a real PR](https://github.com/Inn-Keeper/innkeeper-forge/pull/1#issuecomment-6804225570)

## How it works

1. The Action scans configured routes and viewports with Playwright and axe-core. The
   first successful scan establishes a baseline, so existing findings can be tracked immediately.
2. On subsequent same-repository PRs, new findings fail the check. Make the check required
   in GitHub to block merging. The GitHub App can post the affected elements and fix guidance.
3. A verified default-branch head scan updates the baseline. An open finding resolves
   when it disappears within matching coverage. The HTML evidence dossier shows coverage,
   dated issue history, and a partial register of 15 criteria for accessibility review.

Automated checks cover part of WCAG. Assessing WCAG or EN 301 549 conformance also
requires human review. Intygy supports GitHub, with manual project key delivery.
Anyone with a signed dashboard, report, or evidence link can read the project for up to 30 days.

## Development

```sh
pnpm install
pnpm test          # SQL and browser tests; install Chromium first
pnpm typecheck
pnpm build:action  # rebuild the checked-in bundle after Action changes
```

For local API startup, configure the database, GitHub App, public URL, webhook and
link-signing secrets in the [install guide](docs/INSTALL.md), then run `pnpm dev:api`.

[Architecture and test setup](docs/ARCHITECTURE.md) · [Database upgrades](docs/INSTALL.md#upgrade-an-existing-database-and-action) · [Changelog](CHANGELOG.md) · [Presentation (PDF)](docs/Intygy-overview.pdf)
