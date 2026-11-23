# Intygy dependencies

## GitHub Action

- `@actions/core` — Reads workflow inputs, requests OIDC tokens, and reports results to GitHub Actions.
- `@actions/github` — Reads GitHub event context such as the repository, commit, and pull request.
- `playwright` — Opens the target application in a browser for scanning.
- `axe-core` — Runs automated accessibility checks on the loaded pages.
- `yaml` — Parses the customer's `intygy.yml` configuration.

## API

- `hono` — Defines HTTP routes and middleware for the API.
- `@hono/node-server` — Runs the Hono API on Node.js.
- `jose` — Verifies GitHub Actions OIDC tokens.
- `octokit` — Authenticates as the GitHub App and posts pull request comments.
- `pg` — Connects to PostgreSQL and runs queries and transactions.

## Shared and development tooling

- `zod` — Validates Action configuration and API inputs at runtime.
- `@electric-sql/pglite` — Runs PostgreSQL in-process for database tests.
- `tsx` — Runs TypeScript directly for API startup, local development, and tests.
- `typescript` — Type-checks the Action and API.
- `@types/node` — Provides TypeScript declarations for Node.js APIs.
- `@types/pg` — Provides TypeScript declarations for the PostgreSQL client.
- `@vercel/ncc` — Bundles the Action entry point into `dist/index.js`.
